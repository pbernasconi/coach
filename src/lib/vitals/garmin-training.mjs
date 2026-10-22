// Parsers for Garmin's performance payloads (garmin_raw) and helpers over health_samples, for /health/training and
// the /health page sections. Pure and defensive like garmin-day.mjs: a missing field gives null or an empty list.
// node:test: garmin-training.test.mjs.

import { gmtMs, num, words } from './garmin-day.mjs';
import { TRAINING_STATUS as STATUS_CODES } from './metrics.mjs';

const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const list = (v) => (Array.isArray(v) ? v : []);
const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Training status labels, by Coach's own code (TRAINING_STATUS in metrics.mjs, stored as `training_status`). The
 * label of a raw payload comes from its feedback phrase ("PRODUCTIVE_9"); the code is the fallback.
 */
export const TRAINING_STATUS = STATUS_CODES.map((s) => s.charAt(0).toUpperCase() + s.slice(1));
const TONE = { Detraining: 'warn', Recovery: 'neutral', Maintaining: 'neutral', Unproductive: 'warn', Productive: 'good', Peaking: 'good', Overreaching: 'bad', Strained: 'bad', Paused: 'neutral' };

/** "PRODUCTIVE_1" → "Productive"; "NO_STATUS" → "No status"; anything else → null. */
export function statusFromPhrase(phrase) {
  const t = text(phrase);
  if (!t) return null;
  const head = t.replace(/_\d+$/, '').toUpperCase();
  const hit = TRAINING_STATUS.find((s) => s.toUpperCase().replace(/ /g, '_') === head);
  return hit ?? null;
}

/** A training status label and a tone for its badge: good, warn, bad or neutral. */
export function trainingStatusOf(code, phrase = null) {
  const label = statusFromPhrase(phrase) ?? (num(code) === null ? null : TRAINING_STATUS[Math.round(num(code))] ?? null);
  return label ? { label, tone: TONE[label] ?? 'neutral' } : null;
}

/** The entry of a Garmin per-device map: the primary training device's, else the newest. */
function deviceEntry(map) {
  const entries = Object.values(obj(map) ?? {}).map(obj).filter(Boolean);
  if (!entries.length) return null;
  return entries.find((e) => e.primaryTrainingDevice === true) ?? entries.sort((a, b) => String(b.calendarDate ?? '').localeCompare(String(a.calendarDate ?? '')))[0];
}

/** A value with its target range, or null when the value is missing. */
function targeted(o, key) {
  const value = num(o[key]);
  if (value === null) return null;
  const min = num(o[`${key}TargetMin`]);
  const max = num(o[`${key}TargetMax`]);
  return { value, min, max: max !== null && min !== null && max >= min ? max : null };
}

/**
 * get_training_status → status, acute and chronic load, the ratio and its band, and the 4-week load focus with
 * Garmin's target ranges.
 */
export function parseTrainingStatus(payload) {
  const p = obj(payload);
  if (!p) return null;
  const s = deviceEntry(obj(p.mostRecentTrainingStatus)?.latestTrainingStatusData);
  const acute = obj(s?.acuteTrainingLoadDTO);
  const lb = deviceEntry(obj(p.mostRecentTrainingLoadBalance)?.metricsTrainingLoadBalanceDTOMap);
  const status = trainingStatusOf(s?.trainingStatus, s?.trainingStatusFeedbackPhrase);
  const focus = lb
    ? [
        { key: 'anaerobic', label: 'Anaerobic', ...targeted(lb, 'monthlyLoadAnaerobic') },
        { key: 'high', label: 'High aerobic', ...targeted(lb, 'monthlyLoadAerobicHigh') },
        { key: 'low', label: 'Low aerobic', ...targeted(lb, 'monthlyLoadAerobicLow') },
      ].filter((f) => typeof f.value === 'number')
    : [];
  if (!s && !focus.length) return null;
  return {
    date: text(s?.calendarDate) ?? text(lb?.calendarDate),
    status,
    phrase: text(s?.trainingStatusFeedbackPhrase),
    acute: num(acute?.dailyTrainingLoadAcute),
    chronic: num(acute?.dailyTrainingLoadChronic),
    ratio: num(acute?.dailyAcuteChronicWorkloadRatio),
    ratioStatus: words(text(acute?.acwrStatus)),
    chronicMin: num(acute?.minTrainingLoadChronic),
    chronicMax: num(acute?.maxTrainingLoadChronic),
    tunnelMin: num(s?.loadTunnelMin),
    tunnelMax: num(s?.loadTunnelMax),
    focus,
    focusFeedback: words(text(lb?.trainingBalanceFeedbackPhrase)?.replace(/_\d+$/, '') ?? null),
  };
}

/** Garmin's acute:chronic ratio bands. */
export const RATIO_BANDS = [
  { from: 0, to: 0.8, label: 'Low' },
  { from: 0.8, to: 1.5, label: 'Optimal' },
  { from: 1.5, to: 2.0, label: 'High' },
  { from: 2.0, to: 3.0, label: 'Very high' },
];
export const ratioLabel = (r) => (num(r) === null ? null : (RATIO_BANDS.find((b) => r < b.to) ?? RATIO_BANDS[RATIO_BANDS.length - 1]).label);

const ENDURANCE_CLASSES = ['Recreational', 'Intermediate', 'Trained', 'Well-trained', 'Expert', 'Superior', 'Elite'];
const LIMIT_KEYS = ['Intermediate', 'Trained', 'WellTrained', 'Expert', 'Superior', 'Elite'];

/** get_endurance_score (one day or a range) → the newest score, its class, and the class limits. */
export function parseEnduranceScore(payload) {
  const p = obj(payload);
  if (!p) return null;
  const dto = obj(p.enduranceScoreDTO) ?? p;
  const score = num(dto.overallScore);
  if (score === null) return null;
  const limits = LIMIT_KEYS.map((k, i) => ({ label: ENDURANCE_CLASSES[i + 1], from: num(dto[`classificationLowerLimit${k}`]) })).filter((l) => l.from !== null);
  const cls = num(dto.classification);
  const byLimit = [...limits].reverse().find((l) => score >= l.from)?.label ?? (limits.length ? ENDURANCE_CLASSES[0] : null);
  return {
    date: text(dto.calendarDate),
    score,
    classification: byLimit ?? (cls !== null ? ENDURANCE_CLASSES[Math.round(cls) - 1] ?? null : null),
    limits,
    gaugeMin: num(dto.gaugeLowerLimit),
    gaugeMax: num(dto.gaugeUpperLimit),
  };
}

/** get_hill_score (one day or a range) → the newest overall, strength and endurance parts. */
export function parseHillScore(payload) {
  const p = obj(payload);
  if (!p) return null;
  const rows = list(p.hillScoreDTOList).map(obj).filter(Boolean);
  const dto = rows.sort((a, b) => String(b.calendarDate ?? '').localeCompare(String(a.calendarDate ?? '')))[0] ?? p;
  const overall = num(dto.overallScore);
  if (overall === null) return null;
  return { date: text(dto.calendarDate), overall, strength: num(dto.strengthScore), endurance: num(dto.enduranceScore) };
}

/** Seconds → "h:mm:ss" or "m:ss". */
export function fmtTime(sec) {
  const s = num(sec);
  if (s === null || s < 0) return '-';
  const r = Math.round(s);
  const h = Math.floor(r / 3600);
  const m = Math.floor((r % 3600) / 60);
  const ss = String(r % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Seconds per km → "4:32/km". */
export const fmtPace = (secPerKm) => (num(secPerKm) === null ? '-' : `${fmtTime(secPerKm)}/km`);

// get_personal_record typeId → label and how to read `value` (seconds, meters or a count).
const PR_TYPES = {
  1: ['Run 1 km', 'time'],
  2: ['Run 1 mile', 'time'],
  3: ['Run 5 km', 'time'],
  4: ['Run 10 km', 'time'],
  5: ['Run half marathon', 'time'],
  6: ['Run marathon', 'time'],
  7: ['Longest run', 'distance'],
  8: ['Longest ride', 'distance'],
  9: ['Ride total ascent', 'elevation'],
  10: ['Ride max 20-min power', 'power'],
  11: ['Ride 40 km', 'time'],
  12: ['Most steps in a day', 'count'],
  13: ['Most steps in a week', 'count'],
  14: ['Most steps in a month', 'count'],
  15: ['Longest step-goal streak', 'days'],
  16: ['Current step-goal streak', 'days'],
  17: ['Longest swim', 'distance'],
};

function prValue(kind, v) {
  if (kind === 'time') return fmtTime(v);
  if (kind === 'distance') return v >= 1000 ? `${(v / 1000).toFixed(v >= 100_000 ? 0 : 1)} km` : `${Math.round(v)} m`;
  if (kind === 'elevation') return `${Math.round(v)} m`;
  if (kind === 'power') return `${Math.round(v)} W`;
  if (kind === 'days') return `${Math.round(v)} days`;
  return Math.round(v).toLocaleString('en-US');
}

/** get_personal_record → [{ key, label, value, date, activity, activityId }], known types first, in type order. */
export function parsePersonalRecords(payload) {
  const out = [];
  for (const item of list(payload)) {
    const o = obj(item);
    const type = num(o?.typeId);
    const v = num(o?.value);
    if (!o || type === null || v === null) continue;
    const [label, kind] = PR_TYPES[type] ?? [words(text(o.prTypeLabelKey)?.replace(/^pr\.label\./i, '').replace(/\./g, '_').toUpperCase() ?? null) ?? `Record ${type}`, 'count'];
    // The local day of the record (activityStartDateTimeLocal is local time written as epoch ms); GMT as a fallback.
    const when = gmtMs(o.prStartTimeLocal ?? o.activityStartDateTimeLocal ?? o.prStartTimeGmt ?? o.activityStartDateTimeInGMT);
    out.push({
      key: `${type}-${o.id ?? out.length}`,
      type,
      label,
      value: prValue(kind, v),
      date: when === null ? null : new Date(when).toISOString().slice(0, 10),
      activity: text(o.activityName),
      activityId: num(o.activityId),
    });
  }
  return out.sort((a, b) => a.type - b.type);
}

// ---- health_samples helpers ----

/** @typedef {{ date: string, metric: string, value: number }} SampleRow */

/** Series of `metric` as [{ date, value }], sorted. */
export function series(rows, metric) {
  return rows
    .filter((r) => r.metric === metric && DAY_RE.test(r.date) && num(r.value) !== null)
    .map((r) => ({ date: r.date, value: Number(r.value) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Each point replaced by the mean of the points in the `days` days ending on it (that day included). Daily
 * weigh-ins swing about a kilogram with water and food; the average shows the trend.
 */
export function trailingAverage(points, days = 7) {
  return points.map((p, i) => {
    const from = Date.parse(`${p.date}T00:00:00Z`) - (days - 1) * 864e5;
    let sum = 0;
    let n = 0;
    for (let j = i; j >= 0 && Date.parse(`${points[j].date}T00:00:00Z`) >= from; j--) {
      sum += points[j].value;
      n++;
    }
    return { date: p.date, value: sum / n };
  });
}

/** The newest point of a series and the change against the point nearest to `days` before it. */
export function latestWithChange(points, days = 28) {
  const last = points.at(-1);
  if (!last) return null;
  const target = Date.parse(`${last.date}T00:00:00Z`) - days * 864e5;
  let before = null;
  for (const p of points) if (Date.parse(`${p.date}T00:00:00Z`) <= target) before = p;
  return { ...last, change: before ? last.value - before.value : null, since: before?.date ?? null };
}

const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const mondayOf = (d) => {
  const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
  return addDays(d, wd === 0 ? -6 : 1 - wd);
};

/**
 * Intensity minutes per week (Monday weeks), the way Garmin counts them against the weekly goal: moderate minutes
 * once, vigorous minutes twice. The newest week is the current one, still in progress.
 */
export function intensityWeeks(rows, today, weeks = 12) {
  const first = addDays(mondayOf(today), -7 * (weeks - 1));
  const out = Array.from({ length: weeks }, (_, i) => ({ week: addDays(first, 7 * i), moderate: 0, vigorous: 0, total: 0, days: 0 }));
  const seen = new Set();
  for (const r of rows) {
    if ((r.metric !== 'intensity_minutes_moderate' && r.metric !== 'intensity_minutes_vigorous') || !DAY_RE.test(r.date) || r.date < first || r.date > today) continue;
    const w = out[Math.floor((Date.parse(`${r.date}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / (7 * 864e5))];
    const v = num(r.value);
    if (!w || v === null) continue;
    if (r.metric === 'intensity_minutes_moderate') w.moderate += v;
    else w.vigorous += v;
    if (!seen.has(r.date)) {
      seen.add(r.date);
      w.days += 1;
    }
  }
  for (const w of out) w.total = w.moderate + 2 * w.vigorous;
  return out;
}

/** Sleep stages per night for the last `nights` nights ending `today`; nights without data are left out. */
export function sleepNights(rows, today, nights = 30) {
  const from = addDays(today, -(nights - 1));
  const by = new Map();
  const key = { sleep_deep_min: 'deep', sleep_core_min: 'light', sleep_rem_min: 'rem', sleep_awake_min: 'awake', sleep_total_min: 'total', sleep_score: 'score' };
  for (const r of rows) {
    const k = key[r.metric];
    const v = num(r.value);
    if (!k || v === null || !DAY_RE.test(r.date) || r.date < from || r.date > today) continue;
    if (!by.has(r.date)) by.set(r.date, { date: r.date, deep: null, light: null, rem: null, awake: null, total: null, score: null });
    by.get(r.date)[k] = v;
  }
  return [...by.values()].filter((n) => n.deep !== null || n.light !== null || n.rem !== null || n.total !== null).sort((a, b) => a.date.localeCompare(b.date));
}

const HRV_LABEL = ['No status', 'Poor', 'Low', 'Unbalanced', 'Balanced'];
export const hrvStatusLabel = (code) => (num(code) === null ? null : HRV_LABEL[Math.round(num(code))] ?? null);

/** Nightly HRV with Garmin's baseline band and status for each night. */
export function hrvNights(rows) {
  const by = new Map();
  for (const r of rows) {
    const k = { hrv_night_avg_ms: 'value', hrv_baseline_low_ms: 'low', hrv_baseline_high_ms: 'high', hrv_status: 'status' }[r.metric];
    const v = num(r.value);
    if (!k || v === null || !DAY_RE.test(r.date)) continue;
    if (!by.has(r.date)) by.set(r.date, { date: r.date, value: null, low: null, high: null, status: null });
    by.get(r.date)[k] = v;
  }
  return [...by.values()]
    .filter((n) => n.value !== null)
    .map((n) => ({ ...n, statusLabel: hrvStatusLabel(n.status) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
