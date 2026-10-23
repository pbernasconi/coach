// Display text of the activity page, shared by the web page (Sections.tsx, page.tsx) and the app API
// (app-api.mjs, lift/APP-API.md), so both show the same words and numbers. No framework or database imports, so
// node --test can run it (view.test.mjs). `v` is an ActivityView and `c` an ActivityContext (queries.ts).

import { toDate } from '../db-time.mjs';
import { zoneOf } from '../performance/form.mjs';
import { tssMethodLabel } from '../strava-sync/tss.mjs';
import { duration, int, km, kmh, pace, paceOfSeconds, signed, zoneRange } from './format.mjs';
import { compass, weatherLabel } from './weather.mjs';
import { watchStats } from './watch.mjs';


/** Under the header of an older activity whose details or streams are not stored yet (fillMissingParts adds them). */
export const NOT_LOADED_NOTE = 'The details of this older activity are still being imported.';

/**
 * The entries that are not false, null, undefined, 0 or '' (a typed `filter(Boolean)`).
 * @template T
 * @param {(T | false | null | undefined | 0 | '')[]} xs
 * @returns {T[]}
 */
const present = (xs) => /** @type {T[]} */ (xs.filter(Boolean));

/** 'Tuesday, October 14, 2026 at 6:34 AM' from the activity's own clock time ('YYYY-MM-DDTHH:MM:SS'). */
export function whenText(local) {
  const d = toDate(local); // a clock time with no zone: read as UTC, and shown in UTC
  if (!d) return local;
  const date = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
  return `${date} at ${time}`;
}

/**
 * The overview's stats as Strava shows them: `big` (distance, time, pace or speed, Relative Effort, Coach TSS) and
 * `small` (the rest). Each: { label, valueText, unit? }.
 */
export function overviewStats(v) {
  const foot = v.layout === 'run';
  const st = v.stats;
  const big = present([
    st.distance > 0 && { label: 'Distance', valueText: km(st.distance), unit: 'km' },
    { label: 'Moving Time', valueText: duration(st.moving) },
    foot && st.avgSpeed && { label: 'Pace', valueText: pace(st.avgSpeed), unit: '/km' },
    !foot && st.avgSpeed && st.distance > 0 && { label: 'Avg Speed', valueText: kmh(st.avgSpeed), unit: 'km/h' },
    v.effort.sufferScore != null && { label: 'Relative Effort', valueText: String(v.effort.sufferScore) },
    v.effort.tss != null && { label: 'Coach TSS', valueText: String(Math.round(v.effort.tss)) },
  ]);
  const small = present([
    st.elevGain > 0 && { label: 'Elevation', valueText: int(st.elevGain), unit: 'm' },
    { label: 'Elapsed Time', valueText: duration(st.elapsed) },
    st.calories != null && { label: 'Calories', valueText: int(st.calories) },
    foot && st.avgGapSpeed && { label: 'GAP', valueText: pace(st.avgGapSpeed), unit: '/km' },
    st.avgHr && { label: 'Avg Heart Rate', valueText: int(st.avgHr), unit: 'bpm' },
    st.maxHr && { label: 'Max Heart Rate', valueText: int(st.maxHr), unit: 'bpm' },
    st.avgCadence && { label: 'Cadence', valueText: int(st.avgCadence), unit: foot ? 'spm' : 'rpm' },
    st.avgWatts && { label: st.deviceWatts ? 'Avg Power' : 'Est. Avg Power', valueText: int(st.avgWatts), unit: 'W' },
    v.layout === 'ride' && st.np && { label: 'Weighted Avg Power', valueText: int(st.np), unit: 'W' },
    st.kj && v.layout === 'ride' && { label: 'Total Work', valueText: int(st.kj), unit: 'kJ' },
    !foot && st.maxSpeed && st.distance > 0 && { label: 'Max Speed', valueText: kmh(st.maxSpeed), unit: 'km/h' },
    st.avgTemp != null && { label: 'Device Temp', valueText: String(Math.round(st.avgTemp)), unit: '°C' },
    st.perceivedExertion != null && { label: 'Perceived Exertion', valueText: `${st.perceivedExertion}/10` },
    // The watch's own numbers (Garmin Connect), when the Garmin job has the activity.
    ...watchStats(v.watch ?? null, { foot, stravaPower: Boolean(st.avgWatts) }),
  ]);
  return { big, small };
}

/** '2 PRs · 5 achievements · 3 kudos', or null when all are zero. */
export function achievementsText(st) {
  const parts = present([
    st.prs ? `${st.prs} PR${st.prs > 1 ? 's' : ''}` : null,
    st.achievements ? `${st.achievements} achievement${st.achievements > 1 ? 's' : ''}` : null,
    st.kudos ? `${st.kudos} kudos` : null,
  ]);
  return parts.length ? parts.join(' · ') : null;
}

/** The weather card: 'Partly cloudy, 14 °C', its rows ({ label, valueText }) and the source line. */
export function weatherView(w) {
  return {
    headline: `${weatherLabel(w.code)}${w.tempC != null ? `, ${Math.round(w.tempC)} °C` : ''}`,
    rows: present([
      w.feelsLikeC != null && { label: 'Feels like', valueText: `${Math.round(w.feelsLikeC)} °C` },
      w.humidityPct != null && { label: 'Humidity', valueText: `${Math.round(w.humidityPct)}%` },
      w.windKmh != null && { label: 'Wind', valueText: `${w.windKmh.toFixed(1)} km/h ${compass(w.windDeg)}` },
      w.precipMm != null && w.precipMm > 0 && { label: 'Rain', valueText: `${w.precipMm} mm/h` },
    ]),
    source: `Open-Meteo${String(w.source ?? '').includes('archive') ? ' archive' : ''}, the hour nearest the start`,
  };
}

/** The gear line: { label: 'Bike' | 'Shoes', name, distanceText: '(4,210 km)' | null }. */
export function gearView(v) {
  if (!v.gear) return null;
  return {
    label: v.layout === 'ride' ? 'Bike' : 'Shoes',
    name: v.gear.name,
    distanceText: v.gear.distance != null ? `(${int(v.gear.distance / 1000)} km)` : null,
  };
}

/** One row of the splits table: km label ('3', or '0.4' for a short last split), pace, GAP, elevation, HR. */
export function splitRow(s) {
  return {
    label: s.distance < 950 ? (s.distance / 1000).toFixed(2) : String(s.index),
    paceText: pace(s.speed ?? (s.moving ? s.distance / s.moving : 0)),
    gapText: s.gapSpeed ? pace(s.gapSpeed) : '–',
    elevText: s.elevDiff != null ? signed(s.elevDiff) : '–',
    hrText: s.hr ? String(Math.round(s.hr)) : '–',
  };
}

/** This activity and the others on its route, fastest (per meter) first. `isThis` marks this activity. */
export function sameRouteRows(v, c) {
  if (!c?.sameRoute?.length) return [];
  const foot = v.layout === 'run';
  const rows = [{ stravaId: v.stravaId, day: v.day, name: v.name, moving: v.stats.moving, distance: v.stats.distance }, ...c.sameRoute];
  return rows
    .sort((a, b) => a.moving / a.distance - b.moving / b.distance)
    .map((r) => ({
      ...r,
      isThis: r.stravaId === v.stravaId,
      distanceText: `${km(r.distance)} km`,
      timeText: duration(r.moving),
      paceText: foot ? pace(r.distance / r.moving) : `${kmh(r.distance / r.moving)} km/h`,
    }));
}

/** The planned workout line: '60 min planned · 45 TSS planned', and the compliance ratio line, or null. */
export function plannedTexts(p) {
  return {
    plannedText: [p.duration ? `${p.duration} min planned` : null, p.tss ? `${Math.round(p.tss)} TSS planned` : null].filter(Boolean).join(' · '),
    ratioText: p.compliance.ratio != null ? `${Math.round(p.compliance.ratio * 100)}% of the planned ${p.compliance.basis === 'tss' ? 'TSS' : p.compliance.basis === 'sets' ? 'sets' : 'time'}` : null,
  };
}

/** The load card: TSS text, its method, and fitness, fatigue, form after the day (with the change from the day before). */
export function loadView(v, d) {
  const tss = v.effort.tss;
  const delta = (after, before) => (d.before ? ` (${signed(after - before, 1)})` : '');
  return {
    tssText: tss != null ? String(Math.round(tss)) : '–',
    methodText: v.effort.tssMethod ? tssMethodLabel(v.effort.tssMethod) : null,
    rows: d
      ? [
          { key: 'ctl', label: 'Fitness (CTL)', value: d.after.ctl, valueText: `${Math.round(d.after.ctl)}${delta(d.after.ctl, d.before?.ctl)}` },
          { key: 'atl', label: 'Fatigue (ATL)', value: d.after.atl, valueText: `${Math.round(d.after.atl)}${delta(d.after.atl, d.before?.atl)}` },
          { key: 'tsb', label: 'Form (TSB)', value: d.after.tsb, valueText: `${signed(d.after.tsb)} ${zoneOf(d.after.tsb).toLowerCase()}${delta(d.after.tsb, d.before?.tsb)}` },
          ...(d.dayTss !== (tss ?? 0) ? [{ key: 'dayTss', label: 'TSS that day', value: d.dayTss, valueText: String(Math.round(d.dayTss)) }] : []),
        ]
      : [],
    emptyText: d ? null : `No load row for ${v.day}.`,
  };
}

/** Garmin's values for the day as rows ({ key, label, value, valueText }), in the web's order. */
export function garminRows(g) {
  if (!g) return [];
  return present([
    g.sleep_score != null && {
      key: 'sleep', label: 'Sleep the night before', value: g.sleep_score,
      valueText: `${Math.round(g.sleep_score)}${g.sleep_total_min ? ` · ${duration(g.sleep_total_min * 60).replace(/:\d\d$/, '')} h` : ''}`,
    },
    g.body_battery_high != null && { key: 'bodyBattery', label: 'Body Battery', value: g.body_battery_high, valueText: `${Math.round(g.body_battery_high)} high · ${Math.round(g.body_battery_low ?? 0)} low` },
    g.hrv_night_avg_ms != null && { key: 'hrv', label: 'HRV (night)', value: g.hrv_night_avg_ms, valueText: `${Math.round(g.hrv_night_avg_ms)} ms` },
    g.resting_hr_bpm != null && { key: 'restingHr', label: 'Resting HR', value: g.resting_hr_bpm, valueText: `${Math.round(g.resting_hr_bpm)} bpm` },
    g.training_readiness != null && { key: 'readiness', label: 'Training readiness', value: g.training_readiness, valueText: String(Math.round(g.training_readiness)) },
  ]);
}

/** The Analysis card's text when there are no streams. */
export function noStreamsText(fetch) {
  return fetch.needed ? 'The streams of this older activity are still being imported.' : fetch.note ? 'The streams did not load from Strava yet.' : 'Strava has no streams for this activity (no GPS or sensor data).';
}

/** The Relative Effort card: Strava's score, TRIMP, Coach TSS, TSS per hour, and the note on run power. */
export function effortView(v) {
  const e = v.effort;
  const st = v.stats;
  return {
    stats: [
      { label: 'Relative Effort (Strava)', valueText: e.sufferScore != null ? String(e.sufferScore) : '–' },
      { label: 'TRIMP (from HR)', valueText: e.trimp != null ? String(e.trimp) : '–' },
      { label: 'Coach TSS', valueText: e.tss != null ? String(Math.round(e.tss)) : '–' },
      { label: 'TSS per hour', valueText: e.tss != null && st.moving ? String(Math.round(e.tss / (st.moving / 3600))) : '–' },
    ],
    note:
      (e.tssMethod === 'power' || e.tssMethod === 'power_stream') && v.layout === 'run' && e.ftp
        ? `This TSS uses running power against the cycling FTP (${e.ftp} W), so it reads high for a run. TRIMP and Relative Effort come from heart rate.`
        : null,
  };
}

/** The Heart Rate card's note: "Strava's zones · avg 142 bpm · max 171 bpm". */
export function heartRateNote(st) {
  return `Strava's zones${st.avgHr ? ` · avg ${Math.round(st.avgHr)} bpm` : ''}${st.maxHr ? ` · max ${st.maxHr} bpm` : ''}`;
}

/** One zone row's texts: range ('123–153 bpm' as Strava), time ('12:30' or '–'). */
export function zoneTexts(z, unit) {
  return { rangeText: zoneRange(z.min, z.max, unit), timeText: z.seconds ? duration(z.seconds) : '–' };
}

/** One lap row's texts. */
export function lapRow(l, foot) {
  return {
    distanceText: `${km(l.distance)} km`,
    timeText: duration(l.moving || l.elapsed),
    paceText: foot ? `${pace(l.speed ?? 0)} /km` : `${kmh(l.speed ?? 0)} km/h`,
    gapText: l.gapSpeed ? `${pace(l.gapSpeed)} /km` : '–',
    elevText: l.elevGain != null ? `${int(l.elevGain)} m` : '–',
    hrText: l.hr ? `${Math.round(l.hr)} bpm` : '–',
    powerText: l.watts ? `${Math.round(l.watts)} W` : '–',
  };
}

/** A best effort's rank: 'PR', '2nd best', '3rd best' or ''. */
export function effortRankText(prRank) {
  return prRank === 1 ? 'PR' : prRank ? `${prRank === 2 ? '2nd' : '3rd'} best` : '';
}

/** The Best Efforts card's note. */
export function bestEffortsNote(source) {
  return source === 'streams' ? 'From the streams (Strava sent none)' : 'From Strava';
}

/** Segments with a PR or KOM rank first (best rank first), then the rest in ride order. */
export function rankedSegments(segments) {
  const rank = (x) => Math.min(x.prRank ?? 99, x.komRank ?? 99);
  return [...segments].sort((a, b) => rank(a) - rank(b));
}

/** The Segments card's note: '23 segments · PRs and top 10s first'. */
export function segmentsNote(segments) {
  return `${segments.length} segment${segments.length > 1 ? 's' : ''}${segments.some((x) => x.prRank || x.komRank) ? ' · PRs and top 10s first' : ''}`;
}

/** One segment row's texts. */
export function segmentRow(sg, foot) {
  return {
    distanceText: `${km(sg.distance)} km`,
    gradeText: sg.grade != null ? `${sg.grade.toFixed(1)}%` : '–',
    timeText: duration(sg.seconds),
    paceText: foot ? `${pace(sg.distance / sg.seconds)} /km` : `${kmh(sg.distance / sg.seconds)} km/h`,
    hrText: sg.hr ? String(Math.round(sg.hr)) : '–',
    rankText: sg.komRank ? `KOM #${sg.komRank}` : sg.prRank === 1 ? 'PR' : sg.prRank ? `#${sg.prRank}` : '',
  };
}

/** One best effort row's texts. */
export function bestEffortRow(e) {
  return { timeText: duration(e.seconds), paceText: `${pace(e.distance / e.seconds)} /km`, rankText: effortRankText(e.prRank) };
}

/**
 * The pace distribution: bins in reading order (fastest first), each labeled with its pace ('4:15'), and the bin
 * that holds the average pace (`avgIndex`, -1 when none) with its label ('avg 4:32').
 */
export function paceHistogramView(v) {
  const avgSpeed = v.stats.avgSpeed;
  const bins = v.paceBins.map((b) => ({ ...b, label: paceOfSeconds(b.from) }));
  const avgIndex = v.layout === 'run' && avgSpeed ? v.paceBins.findIndex((b) => 1000 / avgSpeed >= b.from && 1000 / avgSpeed < b.to) : -1;
  return { bins, avgIndex, avgLabel: avgIndex >= 0 ? `avg ${pace(avgSpeed)}` : null };
}

/** How the page lays out a sport: 'run' (pace) for foot sports, 'ride' (speed and power), 'basic' for the rest. */
export function layoutOf(sport) {
  return sport === 'run' || sport === 'hike' || sport === 'walk' ? 'run' : sport === 'ride' ? 'ride' : 'basic';
}
