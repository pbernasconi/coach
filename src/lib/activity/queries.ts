import { sql } from '@/db';
import { cached } from '@/lib/data-cache';
import { toDay } from '@/lib/db-time.mjs';
import { complianceOf } from '@/lib/plan/compliance.mjs';
import { loadWeek } from '@/lib/plan/queries';
import { addDays, matchActivityId, mondayOf, sportOf, sportOfStrava } from '@/lib/plan/week.mjs';
import { bestPower } from '@/lib/performance/peaks.mjs';
import type { SportId } from '@/lib/sports';
import { HR_ZONE_NAMES, POWER_ZONE_NAMES } from './format.mjs';
import { missingParts } from './fetch.mjs';
import { layoutOf as layoutOfSport } from './view.mjs';
import { MATCH_SECONDS, watchValues } from './watch.mjs';
import {
  BEST_EFFORT_DISTANCES, CURVE_DURATIONS, bestEffortsFromStreams, bucketMean, buckets, decodePolyline, gapSpeeds, haversine,
  meanBetween, paceHistogram, splitsFromStreams, trimp, zoneTimes,
} from './streams.mjs';

/**
 * The loader for /activities/[id]: one Strava activity with its laps, splits, streams (cut to chart resolution),
 * zones, best efforts, segments and weather, and Coach's view of it (the planned workout, TSS, fitness and
 * fatigue, the Garmin night before). Owner-scoped. Reads the database only, through the data cache (tag
 * `activities`, cleared by every writer of activities): a view does not wait for Neon to wake up. The parts come
 * from the Strava webhook at once (src/lib/strava-sync/ingest.mjs); `fetch.needed` says an older activity still
 * waits for the background fill (fillMissingParts).
 */

type Row = Record<string, unknown>;
const num = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const arr = (v: unknown) => (Array.isArray(v) ? (v as (number | null)[]) : null);

/** How the page lays out a sport: pace for foot sports, speed and power for rides, a reduced page for the rest. */
export type Layout = 'run' | 'ride' | 'basic';
export const layoutOf = (sport: SportId): Layout => layoutOfSport(sport) as Layout;

export type Zone = { zone: number; name: string; min: number; max: number; seconds: number };
export type Split = { index: number; distance: number; moving: number; elapsed: number; speed: number | null; gapSpeed: number | null; elevDiff: number | null; hr: number | null };
export type Lap = Split & { name: string; maxHr: number | null; cadence: number | null; watts: number | null; elevGain: number | null; startIndex: number | null; endIndex: number | null };
export type Effort = { label: string; distance: number; seconds: number; prRank: number | null; startIndex: number | null; endIndex: number | null };
export type Segment = { id: string; name: string; distance: number; seconds: number; grade: number | null; prRank: number | null; komRank: number | null; hr: number | null; watts: number | null; startIndex: number | null; endIndex: number | null };
export type Weather = { source: string; time: string; code: number | null; tempC: number | null; feelsLikeC: number | null; humidityPct: number | null; windKmh: number | null; windDeg: number | null; precipMm: number | null };

/** The streams at chart resolution. Every array has `t.length` entries; `full` is the stream length before the cut. */
export type Series = {
  full: number;
  bucketStart: number[]; // the first full-resolution index of each point
  t: number[];
  d: (number | null)[] | null;
  lat: (number | null)[] | null;
  lng: (number | null)[] | null;
  alt: (number | null)[] | null;
  speed: (number | null)[] | null;
  gap: (number | null)[] | null;
  hr: (number | null)[] | null;
  cad: (number | null)[] | null;
  watts: (number | null)[] | null;
  temp: (number | null)[] | null;
};

export type ActivityView = {
  id: string;
  stravaId: string;
  name: string;
  description: string | null;
  sportType: string;
  sport: SportId;
  layout: Layout;
  startLocal: string; // 'YYYY-MM-DDTHH:MM:SS', the activity's own clock
  day: string;
  place: string | null;
  trainer: boolean;
  commute: boolean;
  stats: {
    distance: number; moving: number; elapsed: number; elevGain: number; avgSpeed: number | null; maxSpeed: number | null;
    avgHr: number | null; maxHr: number | null; avgCadence: number | null; avgWatts: number | null; np: number | null; maxWatts: number | null;
    deviceWatts: boolean; kj: number | null; calories: number | null; avgTemp: number | null; elevHigh: number | null; elevLow: number | null;
    avgGapSpeed: number | null; kudos: number; achievements: number; prs: number; perceivedExertion: number | null;
  };
  device: string | null;
  gear: { name: string; distance: number | null } | null;
  weather: Weather | null;
  splits: Split[];
  splitsSource: 'strava' | 'streams' | null;
  laps: Lap[];
  series: Series | null;
  route: [number, number][];
  hrZones: Zone[];
  powerZones: Zone[];
  paceBins: { from: number; to: number; seconds: number }[];
  powerCurve: { seconds: number; watts: number }[];
  bestEfforts: Effort[];
  bestEffortsSource: 'strava' | 'streams' | null;
  segments: Segment[];
  effort: { sufferScore: number | null; trimp: number | null; tss: number | null; tssMethod: string | null; ftp: number | null };
  startLatlng: [number, number] | null;
  prevId: string | null;
  nextId: string | null;
  fetch: { needed: boolean; note: string | null };
  /** The watch's own numbers from Garmin Connect (watch.mjs), null until the Garmin job has the activity. */
  watch: ReturnType<typeof watchValues>;
};

const ACTIVITY_COLUMNS = `
  a.id, a.user_id, a.strava_activity_id, a.name, a.description, a.sport_type, a.type, a.distance, a.moving_time, a.elapsed_time,
  a.total_elevation_gain, a.average_speed, a.max_speed, a.average_cadence, a.average_watts, a.weighted_average_watts, a.max_watts,
  a.device_watts, a.average_heartrate, a.max_heartrate, a.kilojoules, a.average_temp, a.trainer, a.commute, a.gear_id, a.start_latlng,
  a.location_city, a.location_state, a.location_country, a.elev_high, a.elev_low, a.achievement_count, a.pr_count, a.kudos_count,
  a.suffer_score, a.tss, a.tss_method, a.zone_times,
  to_char(a.start_date_local, 'YYYY-MM-DD"T"HH24:MI:SS') AS start_local,
  to_char(a.start_date, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS start_utc`;

/** The activity row for a Strava id, a row id, or 'latest' (the newest activity). */
async function activityRow(userId: string, id: string): Promise<Row | null> {
  const rows =
    id === 'latest'
      ? await sql.query(`SELECT ${ACTIVITY_COLUMNS} FROM strava_activities a WHERE a.user_id = $1 ORDER BY a.start_date DESC NULLS LAST LIMIT 1`, [userId])
      : await sql.query(`SELECT ${ACTIVITY_COLUMNS} FROM strava_activities a WHERE a.user_id = $1 AND (a.strava_activity_id = $2 OR a.id = $2) LIMIT 1`, [userId, id]);
  return (rows as Row[])[0] ?? null;
}

function zonesFrom(spec: unknown, names: string[], times: Record<string, number> | null): Zone[] {
  const zones = (spec as { zones?: { min: number; max: number }[] } | null)?.zones;
  if (!zones?.length) return [];
  return zones.map((z, i) => ({ zone: i + 1, name: names[i] ?? `Zone ${i + 1}`, min: z.min, max: z.max, seconds: times?.[`z${i + 1}`] ?? 0 }));
}

function seriesOf(s: Record<string, (number | null)[] | null>, latlng: [number, number][] | null, foot: boolean): Series | null {
  const time = s.time as number[] | null;
  if (!time?.length) return null;
  const bs = buckets(time.length, 1000);
  const gap = foot && s.velocity_smooth && s.grade_smooth ? gapSpeeds(s.velocity_smooth, s.grade_smooth) : null;
  const cadence = s.cadence && foot ? s.cadence.map((c) => (typeof c === 'number' ? c * 2 : null)) : s.cadence;
  return {
    full: time.length,
    bucketStart: bs.map(([a]) => a),
    t: bs.map(([a]) => time[a]),
    d: bucketMean(s.distance, bs, 1),
    lat: latlng ? bs.map(([a, b]) => latlng[Math.floor((a + b - 1) / 2)]?.[0] ?? null) : null,
    lng: latlng ? bs.map(([a, b]) => latlng[Math.floor((a + b - 1) / 2)]?.[1] ?? null) : null,
    alt: bucketMean(s.altitude, bs, 1),
    speed: bucketMean(s.velocity_smooth, bs, 3),
    gap: bucketMean(gap, bs, 3),
    hr: bucketMean(s.heartrate, bs, 0),
    cad: bucketMean(cadence, bs, 0),
    watts: bucketMean(s.watts, bs, 0),
    temp: bucketMean(s.temp, bs, 1),
  };
}

async function readActivity(userId: string, id: string): Promise<ActivityView | null> {
  const a = await activityRow(userId, id);
  if (!a) return null;
  const rowId = String(a.id);
  const [details, gear, laps, splits, streamRows, profile, need, garmin] = await Promise.all([
    sql`SELECT * FROM strava_activity_details WHERE activity_id = ${rowId}` as Promise<Row[]>,
    a.gear_id ? (sql`SELECT name, distance FROM strava_gear WHERE id = ${String(a.gear_id)}` as Promise<Row[]>) : Promise.resolve([] as Row[]),
    sql`SELECT * FROM strava_activity_laps WHERE activity_id = ${rowId} ORDER BY lap_index` as Promise<Row[]>,
    sql`SELECT * FROM strava_activity_splits WHERE activity_id = ${rowId} ORDER BY split_index` as Promise<Row[]>,
    sql`SELECT stream_type, data FROM strava_activity_streams WHERE activity_id = ${rowId}` as Promise<Row[]>,
    sql`SELECT hr_zones, power_zones, ftp, sex FROM strava_athlete_profile WHERE user_id = ${userId} LIMIT 1` as Promise<Row[]>,
    missingParts(sql, rowId),
    a.start_utc
      ? (sql`
          SELECT garmin_activity_id, summary, detail, series FROM garmin_activities
           WHERE user_id = ${userId}
             AND start_utc BETWEEN ${String(a.start_utc)}::timestamptz - make_interval(secs => ${MATCH_SECONDS})
                               AND ${String(a.start_utc)}::timestamptz + make_interval(secs => ${MATCH_SECONDS})
           ORDER BY abs(extract(epoch FROM start_utc - ${String(a.start_utc)}::timestamptz)) LIMIT 1` as Promise<Row[]>)
      : Promise.resolve([] as Row[]),
  ]);
  const d = details[0] ?? null;
  const p = profile[0] ?? null;
  const sportType = String(a.sport_type ?? a.type ?? 'Workout');
  const sport = sportOfStrava(sportType) as SportId;
  const layout = layoutOf(sport);
  const foot = layout === 'run';
  const startLocal = String(a.start_local ?? '');
  const day = toDay(startLocal.slice(0, 10)) ?? startLocal.slice(0, 10);

  // ----- Streams -----
  const s: Record<string, (number | null)[] | null> = {};
  let latlng: [number, number][] | null = null;
  let moving: boolean[] | null = null;
  for (const r of streamRows) {
    const type = String(r.stream_type);
    if (type === 'latlng') latlng = Array.isArray(r.data) ? (r.data as [number, number][]) : null;
    else if (type === 'moving') moving = Array.isArray(r.data) ? (r.data as boolean[]) : null;
    else s[type] = arr(r.data);
  }
  const time = s.time as number[] | undefined;
  const series = seriesOf(s, latlng, foot);
  const route: [number, number][] = latlng?.length
    ? latlng.filter((_, i) => i % Math.max(1, Math.floor(latlng!.length / 1500)) === 0)
    : decodePolyline(String(d?.polyline ?? d?.summary_polyline ?? ''));

  const gapFull = foot && s.velocity_smooth && s.grade_smooth ? gapSpeeds(s.velocity_smooth, s.grade_smooth) : null;
  const movingFlags = moving ?? undefined;

  // ----- Splits and laps -----
  let splitList: Split[] = splits.map((r) => ({
    index: Number(r.split_index),
    distance: num(r.distance) ?? 0,
    moving: num(r.moving_time) ?? 0,
    elapsed: num(r.elapsed_time) ?? 0,
    speed: num(r.average_speed),
    gapSpeed: num(r.average_grade_adjusted_speed),
    elevDiff: num(r.elevation_difference),
    hr: num(r.average_heartrate),
  }));
  let splitsSource: ActivityView['splitsSource'] = splitList.length ? 'strava' : null;
  if (!foot) splitList = [];
  if (foot && !splitList.length && s.distance && time) {
    splitList = splitsFromStreams({
      distance: s.distance as number[], time, altitude: s.altitude as number[] | undefined, heartrate: s.heartrate ?? undefined,
      velocity: s.velocity_smooth ?? undefined, grade: s.grade_smooth ?? undefined, moving: movingFlags,
    }).map((x) => ({ index: x.index, distance: x.distance, moving: x.moving, elapsed: x.elapsed, speed: x.moving ? x.distance / x.moving : null, gapSpeed: x.gapSpeed, elevDiff: x.elevDiff, hr: x.hr }));
    splitsSource = splitList.length ? 'streams' : null;
  }
  // Strava's split GAP is missing on splits stored before it was kept: fill it from the streams.
  if (foot && gapFull && time && splitList.some((x) => x.gapSpeed == null) && s.distance) {
    const fromStreams = splitsFromStreams({ distance: s.distance as number[], time, velocity: s.velocity_smooth ?? undefined, grade: s.grade_smooth ?? undefined, moving: movingFlags });
    splitList = splitList.map((x, i) => ({ ...x, gapSpeed: x.gapSpeed ?? fromStreams[i]?.gapSpeed ?? null }));
  }
  const lapList: Lap[] = laps.map((r) => {
    const si = num(r.start_index);
    const ei = num(r.end_index);
    const gapSpeed = gapFull && time && si != null && ei != null ? meanBetween(gapFull, time, si, ei, movingFlags) : null;
    return {
      index: Number(r.lap_index),
      name: String(r.name ?? `Lap ${r.lap_index}`),
      distance: num(r.distance) ?? 0,
      moving: num(r.moving_time) ?? 0,
      elapsed: num(r.elapsed_time) ?? 0,
      speed: num(r.average_speed),
      gapSpeed,
      elevDiff: null,
      elevGain: num(r.total_elevation_gain),
      hr: num(r.average_heartrate),
      maxHr: num(r.max_heartrate),
      cadence: num(r.average_cadence) != null ? Number(r.average_cadence) * (foot ? 2 : 1) : null,
      watts: num(r.average_watts),
      startIndex: si,
      endIndex: ei,
    };
  });

  // ----- Zones, distribution, curve -----
  const hrTimes = s.heartrate && time ? zoneTimes(s.heartrate, time, (p?.hr_zones as { zones?: { min: number; max: number }[] } | null)?.zones ?? []) : (a.zone_times as Record<string, number> | null);
  const hrZones = zonesFrom(p?.hr_zones, HR_ZONE_NAMES, hrTimes);
  const powerTimes = layout === 'ride' && s.watts && time && a.device_watts ? zoneTimes(s.watts, time, (p?.power_zones as { zones?: { min: number; max: number }[] } | null)?.zones ?? []) : null;
  const powerZones = powerTimes ? zonesFrom(p?.power_zones, POWER_ZONE_NAMES, powerTimes) : [];
  const paceBins = foot && s.velocity_smooth && time ? paceHistogram(s.velocity_smooth, time, { moving: movingFlags, slowestS: sport === 'run' ? 600 : 1500 }) : [];
  const powerCurve =
    layout === 'ride' && s.watts && time && a.device_watts
      ? (bestPower(s.watts, time, CURVE_DURATIONS) as { durationS: number; watts: number }[]).map((x) => ({ seconds: x.durationS, watts: x.watts }))
      : [];

  // ----- Best efforts and segments -----
  const stravaEfforts = (Array.isArray(d?.best_efforts) ? (d!.best_efforts as Row[]) : []).map((e) => ({
    label: String(e.name), distance: Number(e.distance), seconds: Number(e.elapsedTime), prRank: num(e.prRank), startIndex: num(e.startIndex), endIndex: num(e.endIndex),
  }));
  let bestEfforts: Effort[] = stravaEfforts;
  let bestEffortsSource: ActivityView['bestEffortsSource'] = stravaEfforts.length ? 'strava' : null;
  if (!bestEfforts.length && sport === 'run' && s.distance && time) {
    bestEfforts = bestEffortsFromStreams(s.distance as number[], time, BEST_EFFORT_DISTANCES).map((e) => ({ ...e, prRank: null }));
    bestEffortsSource = bestEfforts.length ? 'streams' : null;
  }
  const segments: Segment[] = (Array.isArray(d?.segment_efforts) ? (d!.segment_efforts as Row[]) : []).map((e) => ({
    id: String(e.id), name: String(e.name ?? 'Segment'), distance: Number(e.distance ?? 0), seconds: Number(e.elapsedTime ?? 0),
    grade: num(e.averageGrade), prRank: num(e.prRank), komRank: num(e.komRank), hr: num(e.hr), watts: num(e.watts),
    startIndex: num(e.startIndex), endIndex: num(e.endIndex),
  }));

  // ----- Effort -----
  const { restHr, maxHr } = await heartRange(userId, day);
  const trimpValue = s.heartrate && time ? trimp(s.heartrate, time, { restHr, maxHr, sex: p?.sex as string | undefined }) : null;

  const neighbours = await neighboursOf(userId, rowId);

  const place = d?.place ? String(d.place) : [a.location_city, a.location_state, a.location_country].filter(Boolean).join(', ') || null;
  let note: string | null = null;
  // Weather alone does not count: the page is complete without it.
  const needed = (need.detail || need.streams) && !need.retryLater;
  if (d?.fetch_error) {
    const e = String(d.fetch_error);
    note = / 429 /.test(e)
      ? "Strava's rate limit was full at the last fetch. Coach tries again an hour after it."
      : `The last fetch from Strava failed (${e.slice(0, 80)}). Coach tries again an hour after it.`;
  }

  return {
    id: rowId,
    stravaId: String(a.strava_activity_id),
    name: String(a.name ?? 'Activity'),
    description: a.description ? String(a.description) : null,
    sportType,
    sport,
    layout,
    startLocal,
    day,
    place,
    trainer: Boolean(a.trainer),
    commute: Boolean(a.commute),
    stats: {
      distance: num(a.distance) ?? 0,
      moving: num(a.moving_time) ?? 0,
      elapsed: num(a.elapsed_time) ?? 0,
      elevGain: num(a.total_elevation_gain) ?? 0,
      avgSpeed: num(a.average_speed),
      maxSpeed: num(a.max_speed),
      avgHr: num(a.average_heartrate),
      maxHr: num(a.max_heartrate),
      avgCadence: num(a.average_cadence) != null ? Number(a.average_cadence) * (foot ? 2 : 1) : null,
      avgWatts: num(a.average_watts),
      np: num(a.weighted_average_watts),
      maxWatts: num(a.max_watts),
      deviceWatts: Boolean(a.device_watts),
      kj: num(a.kilojoules),
      calories: num(d?.calories),
      avgTemp: num(a.average_temp),
      elevHigh: num(a.elev_high),
      elevLow: num(a.elev_low),
      avgGapSpeed: gapFull && time ? meanBetween(gapFull, time, 0, gapFull.length - 1, movingFlags) : null,
      kudos: num(a.kudos_count) ?? 0,
      achievements: num(a.achievement_count) ?? 0,
      prs: num(a.pr_count) ?? 0,
      perceivedExertion: num(d?.perceived_exertion),
    },
    device: d?.device_name ? String(d.device_name) : null,
    gear: gear[0]?.name ? { name: String(gear[0].name), distance: num(gear[0].distance) } : null,
    weather: (d?.weather as Weather | null) ?? null,
    splits: splitList,
    splitsSource,
    laps: lapList,
    series,
    route,
    hrZones,
    powerZones,
    paceBins,
    powerCurve,
    bestEfforts,
    bestEffortsSource,
    segments,
    effort: { sufferScore: num(a.suffer_score), trimp: trimpValue, tss: num(a.tss), tssMethod: a.tss_method ? String(a.tss_method) : null, ftp: num(p?.ftp) },
    startLatlng: Array.isArray(a.start_latlng) && a.start_latlng.length === 2 ? (a.start_latlng as [number, number]) : null,
    prevId: neighbours.prev,
    nextId: neighbours.next,
    fetch: { needed, note },
    watch: watchValues((garmin[0] as Parameters<typeof watchValues>[0]) ?? null),
  };
}

/** One activity for its page, the plan modal and the Lift app: readActivity through the data cache. */
export const loadActivity = cached(readActivity, 'activity-view', 'activities');

/** Coach's view of an activity and the runs on its route: optional parts, loaded apart from the activity. */
export type ActivityContext = {
  planned: { title: string; duration: number | null; tss: number | null; date: string; compliance: { level: string; label: string; ratio: number | null; basis: string | null } } | null;
  load: { before: { ctl: number; atl: number; tsb: number } | null; after: { ctl: number; atl: number; tsb: number }; dayTss: number } | null;
  garmin: Record<string, number> | null;
  sameRoute: { stravaId: string; day: string; name: string; moving: number; distance: number }[];
};

export async function loadActivityContext(userId: string, v: ActivityView, today: string): Promise<ActivityContext> {
  const [planned, load, garmin, sameRoute] = await Promise.all([
    plannedFor(userId, v.stravaId, v.day, today, v.stats.moving, v.effort.tss),
    loadAround(userId, v.day),
    garminDay(userId, v.day),
    sameRouteRuns(userId, v),
  ]);
  return { planned, load, garmin, sameRoute };
}

/** For TRIMP: the resting HR (Garmin, the day or the week before) and the highest HR of the last year (Strava). */
async function heartRange(userId: string, day: string): Promise<{ restHr: number | null; maxHr: number | null }> {
  const [rest, max] = await Promise.all([
    sql`
      SELECT value FROM health_samples WHERE user_id = ${userId} AND metric IN ('resting_hr_bpm', 'resting_hr_7d_avg_bpm')
        AND date <= ${day}::date AND date >= ${addDays(day, -7)}::date ORDER BY date DESC LIMIT 1` as Promise<Row[]>,
    sql`
      SELECT max(max_heartrate) AS max FROM strava_activities
       WHERE user_id = ${userId} AND start_date_local >= ${addDays(day, -365)}::date AND start_date_local < ${addDays(day, 1)}::date` as Promise<Row[]>,
  ]);
  return { restHr: num(rest[0]?.value), maxHr: num(max[0]?.max) };
}

/** The planned workout this activity completed (the plan's own matching), with its compliance. */
async function plannedFor(userId: string, stravaId: string, day: string, today: string, moving: number | null, tss: number | null) {
  const week = await loadWeek(userId, mondayOf(day), today);
  const w = week.workouts.find((x) => matchActivityId(x.match) === stravaId);
  if (!w) return null;
  const c = complianceOf(w, w.state, { min: moving != null ? Math.round(moving / 60) : null, tss }, { rest: sportOf(w) === 'rest' }) as {
    level: string; label: string; ratio: number | null; basis: string | null;
  };
  return { title: w.title, duration: w.duration, tss: w.tss, date: w.date, compliance: c };
}

/** Fitness, fatigue and form at the end of the day before and of the activity's day. */
async function loadAround(userId: string, day: string) {
  const rows = (await sql`
    SELECT date, tss, ctl, atl, tsb FROM daily_training_load
    WHERE user_id = ${userId} AND date IN (${addDays(day, -1)}, ${day})`) as Row[];
  const at = (d: string) => rows.find((r) => String(r.date) === d);
  const after = at(day);
  if (!after) return null;
  const before = at(addDays(day, -1));
  const pick = (r: Row) => ({ ctl: Number(r.ctl), atl: Number(r.atl), tsb: Number(r.tsb) });
  return { before: before ? pick(before) : null, after: pick(after), dayTss: Number(after.tss) };
}

const GARMIN_METRICS = ['sleep_score', 'sleep_total_min', 'body_battery_high', 'body_battery_low', 'hrv_night_avg_ms', 'resting_hr_bpm', 'training_readiness'];

/** Garmin's values for the day: the sleep that ended that morning, Body Battery, HRV, readiness. */
async function garminDay(userId: string, day: string) {
  const rows = (await sql`
    SELECT metric, value FROM health_samples
    WHERE user_id = ${userId} AND date = ${day}::date AND metric = ANY(${GARMIN_METRICS}::text[])`) as Row[];
  if (!rows.length) return null;
  return Object.fromEntries(rows.map((r) => [String(r.metric), Number(r.value)]));
}

/** Other activities of the same sport that start within 250 m and are within 10 % of the distance. */
async function sameRouteRuns(userId: string, v: ActivityView) {
  const ll = v.startLatlng;
  const dist = v.stats.distance;
  if (!ll || !dist || dist < 500 || v.trainer) return [];
  const rows = (await sql`
    SELECT strava_activity_id, name, sport_type, distance, moving_time, start_latlng,
           to_char(start_date_local, 'YYYY-MM-DD') AS day
      FROM strava_activities
     WHERE user_id = ${userId} AND id <> ${v.id} AND start_latlng IS NOT NULL
       AND distance BETWEEN ${dist * 0.9} AND ${dist * 1.1}
       AND abs((start_latlng->>0)::float - ${ll[0]}) < 0.005 AND abs((start_latlng->>1)::float - ${ll[1]}) < 0.007
     ORDER BY start_date DESC LIMIT 40`) as Row[];
  return rows
    .filter((r) => sportOfStrava(r.sport_type) === v.sport && haversine(r.start_latlng as [number, number], ll) <= 250)
    .slice(0, 10)
    .map((r) => ({ stravaId: String(r.strava_activity_id), day: String(r.day), name: String(r.name ?? ''), moving: Number(r.moving_time ?? 0), distance: Number(r.distance ?? 0) }));
}

async function neighboursOf(userId: string, rowId: string) {
  const [r] = (await sql`
    WITH me AS (SELECT start_date FROM strava_activities WHERE id = ${rowId})
    SELECT
      (SELECT strava_activity_id FROM strava_activities, me WHERE user_id = ${userId} AND strava_activities.start_date < me.start_date ORDER BY strava_activities.start_date DESC LIMIT 1) AS prev,
      (SELECT strava_activity_id FROM strava_activities, me WHERE user_id = ${userId} AND strava_activities.start_date > me.start_date ORDER BY strava_activities.start_date ASC LIMIT 1) AS next`) as Row[];
  return { prev: r?.prev ? String(r.prev) : null, next: r?.next ? String(r.next) : null };
}
