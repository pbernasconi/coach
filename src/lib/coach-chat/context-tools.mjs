// @ts-check
// More read tools for the Coach chat (lift/COACH-CHAT.md, "Tools"): the plan and the calendar for any days (the
// context only has this week and the next), his health days (sleep, HRV, resting HR, readiness, weight), his labs
// and his DEXA scans. Before these, Coach said "the next heavy barbell day isn't in the plan yet" and had only the
// profile's one-line readiness (Paolo, 2026-11-03). Pure: the definitions, the input checks and the text of each
// answer. context-tools.ts runs the reads.

import { addDays } from '../plan/week.mjs';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** The widest range of one call, in days. */
export const PLAN_MAX_DAYS = 63;
export const CALENDAR_MAX_DAYS = 42;
export const HEALTH_MAX_DAYS = 90;
/** Calendar events in one answer. */
export const CALENDAR_MAX_EVENTS = 80;

export const PLAN_TOOL = {
  name: 'get_plan',
  description:
    'His planned and done workouts between two days (at most 63 days apart), past or future, one per line: id, day, ' +
    'time, what it is and its state (DONE, SKIPPED, MISSED, planned). <plan> already has this week and the next: use ' +
    'this for other weeks ("what did I do last month", "is the long ride on the plan in three weeks"). Workouts from ' +
    'here can go on the change card by id only when they are today or later.',
  input_schema: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'YYYY-MM-DD, first day.' },
      to: { type: 'string', description: 'YYYY-MM-DD, last day.' },
    },
    required: ['from', 'to'],
  },
};

export const CALENDAR_TOOL = {
  name: 'get_calendar',
  description:
    'His Google Calendar events between two days (at most 42 days apart): time, title, place, and which calendar ' +
    '(me, family, training). The profile has the next two weeks: use this for later weeks (travel, a race weekend) ' +
    'or past days ("why did I miss Tuesday").',
  input_schema: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'YYYY-MM-DD, first day.' },
      to: { type: 'string', description: 'YYYY-MM-DD, last day.' },
    },
    required: ['from', 'to'],
  },
};

export const HEALTH_TOOL = {
  name: 'get_health',
  description:
    'His health by day from Garmin, the Apple Watch and the scale (at most 90 days): sleep (hours, score, deep and REM), ' +
    'overnight HRV, resting HR, training readiness, body battery, weight and VO2 max, with his 60-day HRV and resting ' +
    'HR baselines. Use it for "how am I sleeping", "am I recovered", "is my HRV down", "how is my weight trending", and ' +
    'before you blame a bad session on fatigue.',
  input_schema: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'YYYY-MM-DD, first day (default 14 days ago).' },
      to: { type: 'string', description: 'YYYY-MM-DD, last day (default today).' },
    },
  },
};

export const LABS_TOOL = {
  name: 'get_labs',
  description:
    'His blood test results (Function Health): without a marker, the latest draw\'s out-of-range and key markers ' +
    '(ferritin, vitamin D, lipids, testosterone, HbA1c…) with ranges; with a marker, its every reading. Use it for ' +
    'questions about his bloodwork, iron and endurance, recovery, or nutrition. Not a diagnosis: point to his doctor ' +
    'for what is out of range.',
  input_schema: {
    type: 'object',
    properties: { marker: { type: 'string', description: 'A biomarker name, like "Ferritin" or "Vitamin D".' } },
  },
};

export const DEXA_TOOL = {
  name: 'get_dexa',
  description:
    'His DEXA scans (BodySpec): body fat %, fat and lean mass, visceral fat, arms and legs lean mass, bone density and ' +
    'resting metabolic rate, each scan with the change since the last one. Use it for body composition, "am I ' +
    'building muscle", and to set weight or fat-loss goals.',
  input_schema: { type: 'object', properties: {} },
};

export const CONTEXT_READ_TOOLS = [PLAN_TOOL, CALENDAR_TOOL, HEALTH_TOOL, LABS_TOOL, DEXA_TOOL];

/**
 * @typedef {{ tool: 'get_plan' | 'get_calendar' | 'get_health', from: string, to: string }
 *   | { tool: 'get_labs', marker: string | null } | { tool: 'get_dexa' }} ContextCall
 */

/**
 * A call's input, checked. A bad input answers the problem, which goes back to Claude to fix.
 * @param {string} name @param {any} input @param {string} today
 * @returns {{ ok: true, value: ContextCall } | { ok: false, problem: string }}
 */
export function checkContextCall(name, input, today) {
  if (name === LABS_TOOL.name) {
    const marker = typeof input?.marker === 'string' && input.marker.trim() ? input.marker.trim().slice(0, 60) : null;
    return { ok: true, value: { tool: 'get_labs', marker } };
  }
  if (name === DEXA_TOOL.name) return { ok: true, value: { tool: 'get_dexa' } };
  const max = name === PLAN_TOOL.name ? PLAN_MAX_DAYS : name === CALENDAR_TOOL.name ? CALENDAR_MAX_DAYS : name === HEALTH_TOOL.name ? HEALTH_MAX_DAYS : 0;
  if (!max) return { ok: false, problem: 'unknown tool' };
  const to = input?.to ? String(input.to) : today;
  const from = input?.from ? String(input.from) : name === HEALTH_TOOL.name ? addDays(to, -13) : '';
  if (!DATE.test(from) || !DATE.test(to)) return { ok: false, problem: 'from and to must be YYYY-MM-DD' };
  if (from > to) return { ok: false, problem: 'from is after to' };
  if (addDays(from, max - 1) < to) return { ok: false, problem: `at most ${max} days per call` };
  if (name === HEALTH_TOOL.name && from > today) return { ok: false, problem: 'health days are in the past: from is after today' };
  return { ok: true, value: { tool: /** @type {'get_plan' | 'get_calendar' | 'get_health'} */ (name), from, to } };
}

// ----- Calendar -----

/**
 * @typedef {{ title: string, start: string, end: string, allDay: boolean, location: string, calendar: string }} CalEvent
 * @param {CalEvent[]} events @param {{ from: string, to: string }} range @param {string} timeZone
 */
export function calendarText(events, range, timeZone) {
  const head = `Calendar ${range.from} to ${range.to} (${timeZone}):`;
  if (!events.length) return `${head}\nNo events.`;
  const lines = events.slice(0, CALENDAR_MAX_EVENTS).map((e) => {
    const when = e.allDay
      ? `${e.start.slice(0, 10)} all day${e.end && e.end.slice(0, 10) > addDays(e.start.slice(0, 10), 1) ? ` to ${addDays(e.end.slice(0, 10), -1)}` : ''}`
      : `${localDay(e.start, timeZone)} ${localTime(e.start, timeZone)}–${localTime(e.end, timeZone)}`;
    const place = e.location ? ` @ ${e.location.split('\n')[0].slice(0, 60)}` : '';
    return `${when}  ${e.title || '(no title)'}${place}  [${e.calendar}]`;
  });
  const more = events.length > CALENDAR_MAX_EVENTS ? `\n…and ${events.length - CALENDAR_MAX_EVENTS} more: ask for fewer days.` : '';
  return `${head}\n${lines.join('\n')}${more}`;
}

/** @param {string} iso @param {string} timeZone */
function localDay(iso, timeZone) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const p = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(d);
  const get = (/** @type {string} */ t) => p.find((x) => x.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('weekday')}`;
}

/** @param {string} iso @param {string} timeZone */
function localTime(iso, timeZone) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}

// ----- Health -----

/** The metrics get_health shows, in column order. */
export const HEALTH_COLUMNS = /** @type {const} */ ([
  { metric: 'sleep_total_min', label: 'sleep', fmt: (/** @type {number} */ v) => `${Math.floor(v / 60)}h${String(Math.round(v % 60)).padStart(2, '0')}` },
  { metric: 'sleep_score', label: 'score', fmt: (/** @type {number} */ v) => String(Math.round(v)) },
  { metric: 'sleep_deep_min', label: 'deep', fmt: (/** @type {number} */ v) => `${Math.round(v)}m` },
  { metric: 'sleep_rem_min', label: 'REM', fmt: (/** @type {number} */ v) => `${Math.round(v)}m` },
  { metric: 'hrv', label: 'HRV', fmt: (/** @type {number} */ v) => `${Math.round(v)}ms` },
  { metric: 'resting_hr_bpm', label: 'RHR', fmt: (/** @type {number} */ v) => String(Math.round(v)) },
  { metric: 'training_readiness', label: 'ready', fmt: (/** @type {number} */ v) => String(Math.round(v)) },
  { metric: 'body_battery_high', label: 'battery', fmt: (/** @type {number} */ v) => String(Math.round(v)) },
  { metric: 'weight_kg', label: 'kg', fmt: (/** @type {number} */ v) => v.toFixed(1) },
  { metric: 'vo2max', label: 'VO2', fmt: (/** @type {number} */ v) => v.toFixed(0) },
]);

/** The metrics to read for get_health. */
export const HEALTH_METRICS = ['sleep_total_min', 'sleep_score', 'sleep_deep_min', 'sleep_rem_min', 'hrv_night_avg_ms', 'hrv_sdnn_ms', 'resting_hr_bpm', 'training_readiness', 'body_battery_high', 'weight_kg', 'vo2max'];

/**
 * Health days as a table, newest first, with averages and the baselines. Days without any value are left out; a
 * column without any value is left out too.
 * @param {{ date: string, metric: string, value: number }[]} rows
 * @param {{ from: string, to: string }} range
 * @param {{ hrv: { mean: number, sd: number } | null, restingHr: { mean: number, sd: number } | null }} baselines
 */
export function healthText(rows, range, baselines) {
  // One HRV per night: RMSSD (Garmin) when there is any, else SDNN (Apple Watch). They are not comparable.
  const rmssd = rows.some((r) => r.metric === 'hrv_night_avg_ms');
  const hrvMetric = rmssd ? 'hrv_night_avg_ms' : 'hrv_sdnn_ms';
  /** @type {Map<string, Map<string, number>>} */
  const byDay = new Map();
  for (const r of rows) {
    if (r.date < range.from || r.date > range.to || !Number.isFinite(Number(r.value))) continue;
    const metric = r.metric === hrvMetric ? 'hrv' : r.metric;
    if (!HEALTH_COLUMNS.some((c) => c.metric === metric)) continue;
    if (!byDay.has(r.date)) byDay.set(r.date, new Map());
    /** @type {Map<string, number>} */ (byDay.get(r.date)).set(metric, Number(r.value));
  }
  const head = `Health ${range.from} to ${range.to}`;
  if (!byDay.size) return `${head}: no health data on these days.`;
  const cols = HEALTH_COLUMNS.filter((c) => [...byDay.values()].some((d) => d.has(c.metric)));
  const days = [...byDay.keys()].sort().reverse();
  const lines = days.map((d) => {
    const v = /** @type {Map<string, number>} */ (byDay.get(d));
    return `${d}  ${cols.map((c) => `${c.label} ${v.has(c.metric) ? c.fmt(/** @type {number} */ (v.get(c.metric))) : '–'}`).join(', ')}`;
  });
  const avg = cols.map((c) => {
    const vals = days.map((d) => byDay.get(d)?.get(c.metric)).filter((x) => x !== undefined).map(Number);
    return vals.length ? `${c.label} ${c.fmt(vals.reduce((a, b) => a + b, 0) / vals.length)}` : null;
  }).filter(Boolean);
  const base = [
    baselines.hrv ? `HRV ${Math.round(baselines.hrv.mean)} ± ${Math.round(baselines.hrv.sd)} ms (${rmssd ? 'RMSSD' : 'SDNN'})` : null,
    baselines.restingHr ? `resting HR ${Math.round(baselines.restingHr.mean)} ± ${Math.round(baselines.restingHr.sd)}` : null,
  ].filter(Boolean);
  return [
    `${head} (newest first; HRV is ${rmssd ? 'overnight RMSSD from Garmin' : 'SDNN from the Apple Watch'}):`,
    ...lines,
    `Average: ${avg.join(', ')}`,
    base.length ? `60-day baseline: ${base.join('; ')}. Below the band for HRV, or above it for resting HR, means less recovered.` : '',
  ].filter(Boolean).join('\n');
}

// ----- Labs -----

/**
 * @typedef {{ collectedOn: string, value: number | null, valueText: string | null, status: string }} LabReading
 * @typedef {{ biomarker: string, category: string, unit: string | null, refLow: number | null, refHigh: number | null,
 *   optimalLow: number | null, optimalHigh: number | null, latest: LabReading, history: LabReading[] }} LabMarker
 */

/** Markers that matter to an endurance athlete, shown even when in range. */
export const KEY_LAB_MARKERS = ['ferritin', 'iron', 'vitamin d', 'hemoglobin', 'hematocrit', 'hba1c', 'glucose', 'testosterone', 'cortisol', 'tsh', 'ldl', 'hdl', 'triglycerides', 'apob', 'crp', 'magnesium', 'b12', 'creatine kinase'];

/** @param {LabMarker} b */
function markerLine(b) {
  const r = b.latest;
  const value = r.value !== null ? `${r.value}${b.unit ? ` ${b.unit}` : ''}` : (r.valueText ?? '–');
  const range = b.refLow !== null || b.refHigh !== null ? `, range ${b.refLow ?? ''}–${b.refHigh ?? ''}` : '';
  const optimal = b.optimalLow !== null || b.optimalHigh !== null ? `, optimal ${b.optimalLow ?? ''}–${b.optimalHigh ?? ''}` : '';
  const prev = b.history.length > 1 ? b.history[b.history.length - 2] : null;
  const was = prev && prev.value !== null ? `, was ${prev.value} on ${prev.collectedOn}` : '';
  return `${b.biomarker}: ${value} (${r.status.replace(/_/g, ' ')}${range}${optimal}${was})`;
}

/**
 * The latest draw's out-of-range and key markers, or one marker's every reading.
 * @param {LabMarker[]} markers @param {string[]} draws @param {string | null} marker
 */
export function labsText(markers, draws, marker) {
  if (!markers.length) return 'No lab results.';
  if (marker) {
    const q = marker.toLowerCase();
    const hits = markers.filter((b) => b.biomarker.toLowerCase().includes(q));
    if (!hits.length) return `No marker like "${marker}". Some markers: ${markers.slice(0, 30).map((b) => b.biomarker).join(', ')}.`;
    return hits.slice(0, 5).map((b) => [
      markerLine(b),
      ...b.history.map((h) => `  ${h.collectedOn}: ${h.value ?? h.valueText ?? '–'} (${h.status.replace(/_/g, ' ')})`),
    ].join('\n')).join('\n');
  }
  const out = markers.filter((b) => b.latest.status === 'out_of_range');
  const key = markers.filter((b) => b.latest.status !== 'out_of_range' && KEY_LAB_MARKERS.some((k) => b.biomarker.toLowerCase().includes(k)));
  return [
    `Draws: ${draws.join(', ') || '–'}. ${markers.length} markers.`,
    out.length ? `Out of range (${out.length}):\n${out.map(markerLine).join('\n')}` : 'Nothing out of range.',
    key.length ? `Key markers:\n${key.slice(0, 25).map(markerLine).join('\n')}` : '',
    'Ask with a marker for its every reading.',
  ].filter(Boolean).join('\n');
}

// ----- DEXA -----

/**
 * @typedef {{ key: string, label: string, unit: string, value: number | null, sincePrevious: number | null,
 *   sinceFirst: number | null }} DexaMeasure
 * @param {{ scans: { scanDate: string, location: string | null, boneDensity: number | null, rmrKcal: number | null }[],
 *   measures: DexaMeasure[] }} view
 */
export function dexaText(view) {
  if (!view.scans.length) return 'No DEXA scans.';
  const latest = view.scans[view.scans.length - 1];
  const lines = view.measures
    .filter((m) => m.value !== null)
    .map((m) => {
      const since = [m.sincePrevious !== null ? `${signed(m.sincePrevious)} since the last scan` : null, m.sinceFirst !== null ? `${signed(m.sinceFirst)} since the first` : null].filter(Boolean);
      return `${m.label}: ${m.value}${m.unit ? ` ${m.unit}` : ''}${since.length ? ` (${since.join(', ')})` : ''}`;
    });
  return [
    `${view.scans.length} scan${view.scans.length === 1 ? '' : 's'}: ${view.scans.map((s) => s.scanDate).join(', ')}. Latest ${latest.scanDate}${latest.location ? ` (${latest.location})` : ''}:`,
    ...lines,
    latest.boneDensity !== null ? `Bone density: ${latest.boneDensity} g/cm²` : '',
    latest.rmrKcal !== null ? `Resting metabolic rate: ${Math.round(latest.rmrKcal)} kcal/day` : '',
  ].filter(Boolean).join('\n');
}

/** @param {number} n */
const signed = (n) => (n > 0 ? `+${n}` : String(n));
