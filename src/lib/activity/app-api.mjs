// GET /api/app/activities and /api/app/activities/:id (lift/APP-API.md, "Activities"): the activity list and the
// activity page for the Lift iPhone app, with every display text computed here from the web page's own helpers
// (view.mjs, format.mjs), so the phone renders it and never ports activity logic. Pure: the loader (app-api.ts)
// reads the rows. No framework or database imports; node --test (app-api.test.mjs).

import { duration, km, kmh, pace, percents } from './format.mjs';

export { percents };
import { bucketMean, buckets, smooth } from './streams.mjs';
import { routeColors } from './route-colors.mjs';
import {
  achievementsText, bestEffortRow, bestEffortsNote, effortView, garminRows, gearView, heartRateNote, lapRow, layoutOf, loadView,
  noStreamsText, overviewStats, paceHistogramView, plannedTexts, rankedSegments, sameRouteRows, segmentRow, segmentsNote, splitRow,
  weatherView, whenText, zoneTexts,
} from './view.mjs';
import { plainTitle } from '../plan/calendar.mjs';
import { sportOfStrava, todayIn } from '../plan/week.mjs';
import { zoneOrDefault } from '../plan/week-api.mjs';

export const LIST_DEFAULT = 30;
export const LIST_MAX = 100;
/** Chart points per stream: the web's 1000 buckets cut again for a phone. */
export const CHART_POINTS = 300;
/** The web's default smoothing window for the stream charts (StreamCharts.tsx). */
export const CHART_SMOOTHING_S = 30;
/** The web's window for the "smoothed" pace line (PaceBars.tsx). */
export const PACE_LINE_SMOOTHING_S = 60;
export const ROUTE_POINTS = 500;
/** Points on the route coloured by a metric (route.colored): each carries a bin per metric. */
export const ROUTE_COLOR_POINTS = 400;
export const TOP_SEGMENTS = 15;
const ID = /^[A-Za-z0-9_-]{1,40}$/;

/** The phone's six headline numbers in order (a list: the first that the activity has); other stats fill the rest. */
const GRID_ORDER = {
  run: ['Distance', 'Pace', 'Moving Time', 'Elevation', 'Avg Heart Rate', 'Coach TSS'],
  ride: ['Distance', 'Moving Time', 'Avg Speed', 'Elevation', ['Weighted Avg Power', 'Avg Power', 'Est. Avg Power'], 'Coach TSS'],
  basic: ['Moving Time', 'Coach TSS', 'Avg Heart Rate', 'Distance', 'Calories', 'Max Heart Rate'],
};
export const GRID_SIZE = 6;

/**
 * The phone's stat grid: six headline stats in the sport's order (`grid`), and every other stat (`more`), from the
 * web's tiles (`overviewStats`). Strava's Relative Effort stays in `more`: Coach TSS is the load number.
 * @param {{ big: Array<{label: string}>, small: Array<{label: string}> }} stats
 * @param {string} layout  'run' | 'ride' | 'basic'
 */
export function overviewGrid({ big, small }, layout) {
  const all = [...big, ...small];
  const order = GRID_ORDER[layout] ?? GRID_ORDER.basic;
  const picked = order.map((want) => [want].flat().map((label) => all.find((s) => s.label === label)).find(Boolean)).filter(Boolean);
  const fill = all.filter((s) => !picked.includes(s) && s.label !== 'Relative Effort');
  const grid = [...picked, ...fill].slice(0, GRID_SIZE);
  return { grid, more: all.filter((s) => !grid.includes(s)) };
}

/** Outdoors with a real track: the phone leads the page with the map. Not trainer rides and not Zwift's made-up maps. */
export function isOutdoor(v) {
  return !v.trainer && !/^Virtual/i.test(String(v.sportType ?? '')) && v.route.length > 1;
}

export { NOT_LOADED_NOTE } from './view.mjs';
import { heroStats, statGroups } from './summary.mjs';
import { NOT_LOADED_NOTE } from './view.mjs';

// ===== Queries =====

/**
 * The list query: `before` (an activityId cursor, from `nextCursor`), `limit` (1–100, default 30), `tz`.
 * @param {URLSearchParams} params
 * @returns {{ before: string | null, limit: number, timeZone: string, today: string } | { error: string }}
 */
export function parseListQuery(params, now = new Date()) {
  const timeZone = zoneOrDefault(params.get('tz'));
  const before = params.get('before');
  if (before != null && !ID.test(before)) return { error: 'before must be an activityId' };
  const raw = params.get('limit');
  const limit = raw == null ? LIST_DEFAULT : Number(raw);
  if (raw != null && (!/^\d+$/.test(raw) || limit < 1 || limit > LIST_MAX)) return { error: `limit must be 1 to ${LIST_MAX}` };
  return { before: before || null, limit, timeZone, today: todayIn(timeZone, now) };
}

/**
 * The detail query: the id the web accepts (a Strava id, a row id, or `latest`) and `tz`.
 * @returns {{ id: string, timeZone: string, today: string } | { error: string }}
 */
export function parseDetailQuery(rawId, params, now = new Date()) {
  const id = decodeURIComponent(String(rawId ?? ''));
  if (!ID.test(id)) return { error: 'id must be a Strava id, a row id or latest' };
  const timeZone = zoneOrDefault(params.get('tz'));
  return { id, timeZone, today: todayIn(timeZone, now) };
}

// ===== Small helpers =====

/** A raw number rounded for the payload (display text comes from the unrounded value). */
const round = (v, digits = 3) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10 ** digits) / 10 ** digits : null);
const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** 'Tue, Oct 14 · 6:34 AM' from the activity's own clock ('YYYY-MM-DDTHH:MM:SS'), for list rows. */
export function shortWhenText(local) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(String(local ?? ''));
  if (!m) return String(local ?? '');
  const d = new Date(`${m[1]}T00:00:00Z`);
  const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  const h = Number(m[2]);
  return `${date} · ${h % 12 || 12}:${m[3]} ${h < 12 ? 'AM' : 'PM'}`;
}

/** A curve duration as the web's axis: '5s', '1m', '1.5h'. */
export function curveLabel(s) {
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.round((s / 3600) * 10) / 10}h`;
}

/** The section, or `{ ok: false }` when building it throws (one bad value must not blank the screen). */
function section(label, build) {
  try {
    const value = build();
    return value == null ? null : { ok: true, ...value };
  } catch (error) {
    console.error(`[app activity] ${label} failed:`, error);
    return { ok: false };
  }
}

// ===== Route =====

/** Perpendicular distance (in degrees, lng scaled by cos lat) from p to the segment a–b. */
function offset(p, a, b, k) {
  const ax = a[1] * k, ay = a[0], bx = b[1] * k, by = b[0], px = p[1] * k, py = p[0];
  const dx = bx - ax, dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Douglas–Peucker with a tolerance (degrees). Iterative, so a long route cannot overflow the stack. */
function douglasPeucker(points, tolerance, k) {
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let best = -1, far = tolerance;
    for (let i = a + 1; i < b; i++) {
      const d = offset(points[i], points[a], points[b], k);
      if (d > far) { far = d; best = i; }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/**
 * The route as at most `max` [lat, lng] points (5 decimals, about 1 m): Douglas–Peucker with the smallest
 * tolerance that fits. Points that are not numbers are dropped.
 * @param {[number, number][]} route
 */
export function simplifyRoute(route, max = ROUTE_POINTS) {
  const pts = (route ?? []).filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  const near1m = (p) => [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5];
  if (pts.length <= max) return pts.map(near1m);
  const k = Math.cos((pts[0][0] * Math.PI) / 180);
  let lo = 0, hi = 0.01; // degrees: 0.01 ≈ 1 km
  while (douglasPeucker(pts, hi, k).length > max) hi *= 2;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (douglasPeucker(pts, mid, k).length > max) lo = mid;
    else hi = mid;
  }
  return douglasPeucker(pts, hi, k).map(near1m);
}

// ===== Chart series =====

const paceOf = (v) => (typeof v === 'number' && v > 0.5 ? 1000 / v : null);

/**
 * The web's stream panels (StreamCharts.tsx), smoothed with its default window on the web's 1000-point series and
 * cut to `points` buckets with `buckets`/`bucketMean`. x: distance (km, carried over gaps) and time (s from the
 * start). Only present streams, in the web's panel order. Pace is in s/km (`invert`: faster is higher).
 * @param {object} series  ActivityView.series
 * @param {'run' | 'ride' | 'basic'} layout
 * @param {{ speed, gap, hr, cad, watts, temp }} avgs  the averages the web prints on each panel
 */
export function chartSeries(series, layout, avgs, points = CHART_POINTS, smoothingS = CHART_SMOOTHING_S) {
  const t = series.t;
  const n = t.length;
  const bs = buckets(n, points);
  const t0 = t[0] ?? 0;
  const sm = (v) => (v ? smooth(v, t, smoothingS) : null);
  const foot = layout === 'run';
  const count = (v) => (v ?? []).filter((x) => typeof x === 'number').length;
  const stream = (key, label, unit, full, digits, fmt, avg, extra = {}) => {
    if (!full || count(full) < 2) return null;
    return { key, label, unit, values: bucketMean(full, bs, digits), avg: round(avg, 2), avgText: avg != null ? fmt(avg) : null, ...extra };
  };
  const roundText = (v) => String(Math.round(v));
  const watts = (avgs.watts ?? null);
  const list = [
    foot && series.speed ? stream('pace', 'Pace', '/km', sm(series.speed).map(paceOf), 0, duration, avgs.speed ? 1000 / avgs.speed : null, { invert: true }) : null,
    foot && series.speed && series.gap ? stream('gap', 'GAP', '/km', sm(series.gap).map(paceOf), 0, duration, avgs.gap ? 1000 / avgs.gap : null, { invert: true, overlayOf: 'pace' }) : null,
    !foot && series.speed && series.speed.some((v) => (v ?? 0) > 0)
      ? stream('speed', 'Speed', 'km/h', sm(series.speed).map((v) => (v == null ? null : v * 3.6)), 1, (v) => v.toFixed(1), avgs.speed ? avgs.speed * 3.6 : null)
      : null,
    layout === 'ride' && series.watts ? stream('watts', 'Power', 'W', sm(series.watts), 0, roundText, watts) : null,
    series.hr ? stream('hr', 'Heart rate', 'bpm', sm(series.hr), 0, roundText, avgs.hr) : null,
    series.cad ? stream('cad', 'Cadence', foot ? 'spm' : 'rpm', sm(series.cad), 0, roundText, avgs.cad) : null,
    layout === 'run' && series.watts ? stream('watts', 'Power', 'W', sm(series.watts), 0, roundText, watts) : null,
    series.temp ? stream('temp', 'Temperature', '°C', series.temp, 1, (v) => v.toFixed(0), avgs.temp) : null,
    series.alt ? stream('alt', 'Elevation', 'm', series.alt, 0, roundText, null, { area: true }) : null,
  ].filter(Boolean);
  // A GAP overlay without its pace panel has nothing to sit on.
  const streams = list.filter((s) => s.key !== 'gap' || list.some((p) => p.key === 'pace'));
  const hasDistance = Boolean(series.d?.some((v) => typeof v === 'number' && v > 0));
  let last = 0;
  const distanceKm = hasDistance
    ? bucketMean(series.d, bs, 0).map((v) => (typeof v === 'number' ? (last = Math.round(v) / 1000) : last))
    : null;
  return { points: bs.length, smoothingS, x: { distanceKm, timeS: bs.map(([a]) => Math.round(t[a] - t0)) }, streams };
}

// ===== Pace bars =====

/** The web's pace analysis bars (PaceBars.tsx): per split and per lap, as wide as the distance, as tall as the speed. */
export function paceBarsView(v, line) {
  const foot = v.layout === 'run';
  const fmt = (s) => (foot ? pace(s) : kmh(s));
  const bar = (b) => ({
    label: b.label,
    width: b.width,
    value: round(b.speed),
    valueText: b.speed ? fmt(b.speed) : '–',
    gap: foot ? round(b.gap) : null,
    gapText: foot && b.gap ? fmt(b.gap) : null,
    timeText: duration(b.time),
    distanceText: (b.distance / 1000).toFixed(2),
    hrText: b.hr ? String(Math.round(b.hr)) : null,
  });
  const avg = (vals) => {
    const xs = vals.filter((x) => typeof x === 'number');
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  const mode = (key, bars) => {
    const a = avg(bars.map((b) => b.value));
    const g = foot ? avg(bars.map((b) => b.gap)) : null;
    return { key, bars, avg: round(a), avgText: a != null ? fmt(a) : null, gapAvg: round(g), gapAvgText: g != null ? fmt(g) : null };
  };
  const modes = [];
  if (v.splits.length) {
    modes.push(mode('splits', v.splits.map((s) => bar({ label: `Km ${s.index}`, width: s.distance, speed: s.speed, gap: s.gapSpeed, hr: s.hr, time: s.moving, distance: s.distance }))));
  }
  if (v.laps.length > 1) {
    modes.push(mode('laps', v.laps.map((l) => bar({ label: l.name || `Lap ${l.index}`, width: l.distance || l.moving, speed: l.speed, gap: l.gapSpeed, hr: l.hr, time: l.moving, distance: l.distance }))));
  }
  if (line) modes.push({ key: 'smoothed', ...line });
  return {
    title: foot ? 'Pace Analysis' : 'Speed Analysis',
    unit: foot ? '/km' : 'km/h',
    hasGap: foot && (v.splits.some((s) => s.gapSpeed) || v.laps.some((l) => l.gapSpeed)),
    modes,
  };
}

/** The "smoothed" mode: the 60 s speed (and GAP) line over the chart's time axis, in m/s. */
function smoothedLine(series, timeS, points = CHART_POINTS) {
  if (!series?.speed) return null;
  const bs = buckets(series.t.length, points);
  const one = (src) => {
    const out = bucketMean(smooth(src, series.t, PACE_LINE_SMOOTHING_S), bs, 2);
    return out.map((x) => (typeof x === 'number' && x >= 0.5 ? x : null));
  };
  return { timeS, values: one(series.speed), gapValues: series.gap ? one(series.gap) : null };
}

// ===== Zones =====

function zoneRows(zones, unit) {
  const pct = percents(zones.map((z) => z.seconds));
  return zones.map((z, i) => ({ zone: z.zone, name: z.name, min: z.min, max: z.max, ...zoneTexts(z, unit), seconds: z.seconds, percent: pct[i] }));
}

// ===== List =====

/**
 * One list row from a strava_activities row (app-api.ts selects the columns).
 * @param {Record<string, unknown>} r
 * @param {string | null} plannedTitle  the plan workout this activity completed (the plan's own matching)
 * @param {(type: string) => string} typeLabel  stravaTypeLabel (sports.ts)
 */
export function listRow(r, plannedTitle, typeLabel) {
  const sportType = String(r.sport_type ?? r.type ?? 'Workout');
  const sport = sportOfStrava(sportType);
  const layout = layoutOf(sport);
  const distance = num(r.distance) ?? 0;
  const moving = num(r.moving_time) ?? 0;
  const speed = num(r.average_speed) ?? (distance && moving ? distance / moving : null);
  const tss = num(r.tss);
  const startLocal = String(r.start_local ?? '');
  const distanceText = distance > 0 ? `${km(distance)} km` : null;
  const durationText = duration(moving || num(r.elapsed_time) || 0);
  const paceText = layout === 'run' && speed ? `${pace(speed)} /km` : null;
  const speedText = layout === 'ride' && speed && distance > 0 ? `${kmh(speed)} km/h` : null;
  const tssText = tss != null ? `${Math.round(tss)} TSS` : null;
  return {
    activityId: String(r.strava_activity_id),
    name: String(r.name ?? 'Activity'),
    sport,
    sportType,
    // Whether the page will lead with a map, so the app can open straight into that layout (the route itself is
    // only in the page's body). The same rule as `isOutdoor`, with a distance in place of the track.
    outdoor: !r.trainer && !/^Virtual/i.test(sportType) && distance > 0,
    typeText: typeLabel(sportType),
    startLocal,
    day: startLocal.slice(0, 10),
    startText: shortWhenText(startLocal),
    distance,
    distanceText,
    movingSeconds: moving,
    durationText,
    speed,
    paceText,
    speedText,
    tss,
    tssText,
    indoor: Boolean(r.trainer),
    commute: Boolean(r.commute),
    plannedTitle: plannedTitle ? plainTitle(plannedTitle) : null,
    subtitle: [distanceText, durationText, paceText ?? speedText, tssText].filter(Boolean).join(' · '),
  };
}

/**
 * The list response. `rows` holds up to `limit + 1` rows, newest first; the extra row only says there is a next page.
 * @param {{ timeZone: string, today: string, now: Date, rows: Record<string, unknown>[], limit: number,
 *           planned: { ok: boolean, titles: Map<string, string> }, typeLabel: (t: string) => string }} input
 */
export function listResponse({ timeZone, today, now, rows, limit, planned, typeLabel }) {
  const page = rows.slice(0, limit);
  return {
    generatedAt: now.toISOString(),
    timeZone,
    today,
    activities: page.map((r) => listRow(r, planned.titles.get(String(r.strava_activity_id)) ?? null, typeLabel)),
    plannedOk: planned.ok,
    nextCursor: rows.length > limit && page.length ? String(page[page.length - 1].strava_activity_id) : null,
  };
}

// ===== Detail =====

/**
 * The activity page as JSON, section by section in the web's order. A section the activity does not have is null;
 * a section that failed is `{ ok: false }`.
 * @param {{ v: object, context: { ok: true, value: object } | { ok: false }, timeZone: string, today: string, now: Date,
 *           typeLabel: (t: string) => string }} input  v: ActivityView, context: ActivityContext (queries.ts)
 */
export function detailResponse({ v, context, timeZone, today, now, typeLabel }) {
  const foot = v.layout === 'run';
  const st = v.stats;
  const c = context.ok ? context.value : null;
  const typeText = typeLabel(v.sportType);
  const when = whenText(v.startLocal);
  const analysis = section('analysis', () =>
    v.series
      ? {
          ...chartSeries(v.series, v.layout, {
            speed: st.avgSpeed, gap: st.avgGapSpeed, hr: st.avgHr, cad: st.avgCadence,
            watts: st.avgWatts && (v.layout === 'ride' || st.deviceWatts) ? st.avgWatts : null, temp: st.avgTemp,
          }),
          note: foot ? 'Pace is upside down: faster is higher.' : null,
          emptyText: null,
        }
      : { points: 0, smoothingS: CHART_SMOOTHING_S, x: null, streams: [], note: null, emptyText: noStreamsText(v.fetch) }
  );
  const hrTotal = v.hrZones.reduce((n, z) => n + z.seconds, 0);

  return {
    generatedAt: now.toISOString(),
    timeZone,
    today,
    activityId: v.stravaId,
    header: section('header', () => ({
      activityId: v.stravaId,
      name: v.name,
      sport: v.sport,
      sportType: v.sportType,
      typeText,
      startLocal: v.startLocal,
      day: v.day,
      whenText: when,
      place: v.place,
      indoor: v.trainer,
      commute: v.commute,
      outdoor: isOutdoor(v),
      subtitle: `${when}${v.place ? ` · ${v.place}` : ''} · ${typeText}${v.trainer ? ' · indoor' : ''}${v.commute ? ' · commute' : ''}`,
      description: v.description,
      prevId: v.prevId,
      nextId: v.nextId,
      stravaUrl: `https://www.strava.com/activities/${v.stravaId}`,
      fetch: { pending: Boolean(v.fetch.needed), note: v.fetch.note ?? (v.fetch.needed ? NOT_LOADED_NOTE : null) },
    })),
    overview: section('overview', () => {
      const stats = overviewStats(v);
      return { ...stats, ...overviewGrid(stats, v.layout), hero: heroStats(v), groups: statGroups(v), achievementsText: achievementsText(st) };
    }),
    weather: section('weather', () => (v.weather ? weatherView(v.weather) : null)),
    equipment: section('equipment', () => (v.device || v.gear ? { device: v.device, gear: gearView(v) } : null)),
    splits: section('splits', () =>
      v.splits.length
        ? {
            note: v.splitsSource === 'streams' ? 'from the streams' : null,
            rows: v.splits.map((s) => ({ index: s.index, distance: s.distance, speed: s.speed, gapSpeed: s.gapSpeed, ...splitRow(s) })),
          }
        : null
    ),
    route: section('route', () =>
      v.route.length > 1
        ? { points: simplifyRoute(v.route), colored: routeColors(v.series, { foot, hrZones: v.hrZones, powerZones: v.powerZones, points: ROUTE_COLOR_POINTS }) }
        : null
    ),
    sameRoute: !context.ok
      ? { ok: false }
      : section('same route', () => {
          const rows = sameRouteRows(v, c);
          if (!rows.length) return null;
          return {
            title: `${foot ? 'Runs' : 'Activities'} on this route`,
            note: 'same start within 250 m, distance within 10 %, fastest first',
            rows: rows.map((r) => ({
              activityId: r.stravaId, isThis: r.isThis, day: r.day, name: r.isThis ? 'This activity' : r.name,
              distance: r.distance, movingSeconds: r.moving, distanceText: r.distanceText, timeText: r.timeText, paceText: r.paceText,
            })),
          };
        }),
    coach: !context.ok
      ? { ok: false }
      : section("coach's view", () => {
          const load = loadView(v, c.load);
          const planned = c.planned ? { ...c.planned, title: plainTitle(c.planned.title), ...plannedTexts(c.planned) } : null;
          return {
            planned,
            plannedEmptyText: planned ? null : 'Not matched to a planned workout.',
            load: { tss: v.effort.tss, method: v.effort.tssMethod, ...load },
            garmin: { day: v.day, rows: garminRows(c.garmin), emptyText: c.garmin ? null : `No Garmin data for ${v.day}.` },
          };
        }),
    analysis,
    paceBars: section('pace bars', () => {
      if (v.layout === 'basic' || !(v.splits.length || v.laps.length > 1 || v.series?.speed)) return null;
      const timeS = analysis?.ok && analysis.x ? analysis.x.timeS : null;
      const line = timeS ? smoothedLine(v.series, timeS) : null;
      return paceBarsView(v, line);
    }),
    paceHistogram: section('pace histogram', () => {
      if (!foot || !v.paceBins.length) return null;
      const h = paceHistogramView(v);
      const pct = percents(h.bins.map((b) => b.seconds));
      return {
        note: 'Moving time per 15 s of pace',
        unit: '/km',
        bins: h.bins.map((b, i) => ({ fromS: b.from, toS: b.to, label: b.label, seconds: b.seconds, timeText: duration(b.seconds), percent: pct[i] })),
        avgIndex: h.avgIndex >= 0 ? h.avgIndex : null,
        avgText: h.avgLabel,
      };
    }),
    relativeEffort: section('relative effort', () => ({
      sufferScore: v.effort.sufferScore, trimp: v.effort.trimp, tss: v.effort.tss, ...effortView(v),
    })),
    heartRate: section('heart rate', () => (hrTotal > 0 ? { note: heartRateNote(st), zones: zoneRows(v.hrZones, 'bpm') } : null)),
    power: section('power', () => {
      if (!v.powerZones.length && !v.powerCurve.length) return null;
      const ftp = v.effort.ftp;
      return {
        ftp,
        ftpText: ftp ? `FTP ${ftp} W` : null,
        curve: v.powerCurve.length > 1
          ? v.powerCurve.map((p) => ({
              seconds: p.seconds, label: curveLabel(p.seconds), durationText: duration(p.seconds), watts: p.watts, wattsText: `${p.watts} W`,
              ftpPercent: ftp ? Math.round((p.watts / ftp) * 100) : null,
            }))
          : [],
        zones: zoneRows(v.powerZones, 'W'),
      };
    }),
    laps: section('laps', () =>
      v.laps.length > 1
        ? {
            hasPower: v.laps.some((l) => l.watts),
            hasGap: foot,
            rows: v.laps.map((l) => ({ index: l.index, name: l.name, distance: l.distance, movingSeconds: l.moving, speed: l.speed, ...lapRow(l, foot) })),
          }
        : null
    ),
    bestEfforts: section('best efforts', () =>
      v.bestEfforts.length
        ? {
            note: bestEffortsNote(v.bestEffortsSource),
            rows: v.bestEfforts.map((e) => ({ label: e.label, distance: e.distance, seconds: e.seconds, prRank: e.prRank, ...bestEffortRow(e) })),
          }
        : null
    ),
    segments: section('segments', () =>
      v.segments.length
        ? {
            count: v.segments.length,
            note: segmentsNote(v.segments),
            rows: rankedSegments(v.segments)
              .slice(0, TOP_SEGMENTS)
              .map((sg) => ({ id: sg.id, name: sg.name, distance: sg.distance, seconds: sg.seconds, prRank: sg.prRank, komRank: sg.komRank, ...segmentRow(sg, foot) })),
          }
        : null
    ),
  };
}
