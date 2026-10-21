// @ts-check
import { addDays } from './readiness.mjs';

/**
 * The /health board: one value per day and metric for the chart window, which days the watch was worn, and each
 * metric's latest value against its normal range. Pure: the loader (garmin-pages.ts) passes health_samples rows.
 */

/** @typedef {{ date: string, metric: string, value: number }} SampleRow */
/** @typedef {'worn' | 'partial' | 'off' | 'pending'} Coverage */
/** @typedef {{ date: string, value: number }} Dated */
/** @typedef {{ latest: Dated | null, normal: { low: number, high: number, mean: number } | null, status: 'below' | 'normal' | 'above' | null }} Stat */

export const NORMAL_DAYS = 60; // the normal range: mean ± 1 SD of the 60 days before the latest value
const MIN_NORMAL = 14;
const FULL_DAY_MIN = 20 * 60; // wear_min below this is a partial day

/** Metrics the board reads (health_samples), and the series each fills. */
export const BOARD_METRICS = {
  hrv_night_avg_ms: 'hrv',
  hrv_baseline_low_ms: 'hrvLow',
  hrv_baseline_high_ms: 'hrvHigh',
  hrv_status: 'hrvStatus',
  resting_hr_bpm: 'rhr',
  sleep_total_min: 'sleep',
  sleep_deep_min: 'deep',
  sleep_core_min: 'light',
  sleep_rem_min: 'rem',
  sleep_awake_min: 'awake',
  sleep_score: 'sleepScore',
  body_battery_high: 'bbHigh',
  body_battery_low: 'bbLow',
  stress_avg: 'stress',
  training_readiness: 'readiness',
  respiratory_rate: 'respiration',
  steps: 'steps',
  intensity_minutes_moderate: 'moderate',
  intensity_minutes_vigorous: 'vigorous',
  weight_kg: 'weight',
  vo2max: 'vo2max',
  wear_min: 'wear',
};

/** Any of these on a day means the watch was on (for days before wear_min existed). */
const WORN_SIGNS = ['resting_hr_bpm', 'stress_avg', 'body_battery_high', 'sleep_total_min', 'hrv_night_avg_ms', 'steps', 'intensity_minutes_moderate', 'intensity_minutes_vigorous'];

/**
 * Whether the watch was worn each day. wear_min (minutes with heart rate, sent by the Garmin sync for every day it
 * fetched, 0 when not worn) wins; without it, any daily Garmin value means worn. Days after the last synced day are
 * 'pending'; synced days with nothing are 'off'.
 * @param {SampleRow[]} rows
 * @param {string[]} days
 * @param {string | null} syncedThrough YYYY-MM-DD, the Garmin sync's last day; null: the newest sample's day
 * @returns {Record<string, Coverage>}
 */
export function coverageOf(rows, days, syncedThrough) {
  /** @type {Map<string, { wear: number | null, sign: boolean }>} */
  const by = new Map();
  /** @type {string | null} */
  let newest = null;
  for (const r of rows) {
    const e = by.get(r.date) ?? { wear: null, sign: false };
    if (r.metric === 'wear_min') e.wear = Number(r.value);
    else if (WORN_SIGNS.includes(r.metric)) e.sign = true;
    else continue;
    by.set(r.date, e);
    if (!newest || r.date > newest) newest = r.date;
  }
  const through = syncedThrough ?? newest;
  /** @type {Record<string, Coverage>} */
  const out = {};
  for (const d of days) {
    const e = by.get(d);
    // wear_min alone decides: on a day without the watch Garmin still sends the phone's steps.
    if (e?.wear != null) out[d] = e.wear <= 0 ? 'off' : e.wear < FULL_DAY_MIN ? 'partial' : 'worn';
    else if (e?.sign) out[d] = 'worn';
    else out[d] = !through || d > through ? 'pending' : 'off';
  }
  return out;
}

/**
 * The latest value and its normal range: mean ± 1 SD of the values in the 60 days before it (at least 14).
 * @param {Dated[]} points oldest first
 * @returns {Stat}
 */
export function statOf(points) {
  const latest = points.at(-1) ?? null;
  if (!latest) return { latest: null, normal: null, status: null };
  const from = addDays(latest.date, -NORMAL_DAYS);
  const prior = points.filter((p) => p.date >= from && p.date < latest.date).map((p) => p.value);
  if (prior.length < MIN_NORMAL) return { latest, normal: null, status: null };
  const mean = prior.reduce((a, b) => a + b, 0) / prior.length;
  const sd = Math.sqrt(prior.reduce((a, b) => a + (b - mean) ** 2, 0) / (prior.length - 1));
  const normal = { low: mean - sd, high: mean + sd, mean };
  return { latest, normal, status: latest.value < normal.low ? 'below' : latest.value > normal.high ? 'above' : 'normal' };
}

/**
 * @param {SampleRow[]} rows health_samples for the window plus the 60 days before it
 * @param {{ today: string, days: number, syncedThrough: string | null }} opts
 */
export function boardOf(rows, { today, days: n, syncedThrough }) {
  const days = Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));
  const index = new Map(days.map((d, i) => [d, i]));
  /** @type {Record<string, (number | null)[]>} */
  const series = Object.fromEntries(Object.values(BOARD_METRICS).map((k) => [k, days.map(() => null)]));
  /** @type {Record<string, Dated[]>} */
  const points = {};
  for (const r of rows) {
    const key = /** @type {Record<string, string>} */ (BOARD_METRICS)[r.metric];
    const v = Number(r.value);
    if (!key || !Number.isFinite(v) || r.date > today) continue;
    (points[key] ??= []).push({ date: r.date, value: v });
    const i = index.get(r.date);
    if (i !== undefined) series[key][i] = v;
  }
  for (const p of Object.values(points)) p.sort((a, b) => a.date.localeCompare(b.date));
  // Intensity minutes as Garmin counts them: vigorous minutes count twice.
  series.intensity = days.map((_, i) => {
    const m = series.moderate[i];
    const g = series.vigorous[i];
    return m === null && g === null ? null : (m ?? 0) + 2 * (g ?? 0);
  });
  const stat = (/** @type {string} */ k) => statOf(points[k] ?? []);
  const weight = points.weight ?? [];
  const w = weight.at(-1);
  const w28 = w ? weight.filter((p) => p.date <= addDays(w.date, -28)).at(-1) ?? null : null;
  const coverage = coverageOf(rows, days, syncedThrough);
  const counts = { worn: 0, partial: 0, off: 0, pending: 0 };
  for (const d of days) counts[coverage[d]]++;
  // This week's intensity minutes (Monday to today) against Garmin's 150-minute goal.
  const dow = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  const week = series.intensity.slice(-(dow + 1)).reduce((a, b) => (a ?? 0) + (b ?? 0), 0) ?? 0;
  return {
    today,
    days,
    coverage,
    counts,
    series,
    stats: {
      hrv: stat('hrv'),
      rhr: stat('rhr'),
      sleep: stat('sleep'),
      sleepScore: stat('sleepScore'),
      bbHigh: stat('bbHigh'),
      stress: stat('stress'),
      readiness: stat('readiness'),
      respiration: stat('respiration'),
      weight: { ...stat('weight'), change28: w && w28 ? w.value - w28.value : null },
    },
    intensityWeek: week,
  };
}
