// Readiness from daily health samples: pure functions over rows of { date, metric, value }, shared by the /health
// page, loadReadiness (home page, /api/home) and scripts/health-profile.mjs (the Coach AI context).
//
// Rules (simple on purpose, so the page can explain them):
// - HRV: Garmin's overnight RMSSD (hrv_night_avg_ms) when the window has it, else Apple Health's SDNN
//   (hrv_sdnn_ms); the two measures are never mixed. The 7-day mean against the 60-day baseline (the 60 days before those 7). Below when more than one
//   standard deviation (at least 5%) under the baseline mean; above when over it by as much.
// - Resting HR: the 7-day mean against the 60-day baseline. Elevated when over it by one standard deviation and
//   at least 2 bpm.
// - Sleep: last night (the newest sleep day, today or yesterday). Short under 6 h.
// - Weight: the 7-day mean against the 7-day mean four weeks before.
// - Garmin's own scores (sleep score, Body Battery, training readiness, HRV status) are shown as they are, from
//   today or yesterday; they raise no flag here.
// Readiness: "good" with no flag, "ok" with one, "low" with two or more; "unknown" without HRV, resting HR or sleep.

export const BASELINE_DAYS = 60;
export const RECENT_DAYS = 7;
const MIN_BASELINE_DAYS = 14;
const SHORT_SLEEP_MIN = 360;
const HRV_STATUS = ['none', 'poor', 'low', 'unbalanced', 'balanced'];

/** @typedef {{ date: string, metric: string, value: number }} SampleRow */
/**
 * @typedef {{ avg7: number, latest: number | null, latestDate: string | null, days7: number, baseline: number | null, sd: number | null, baselineDays: number }} BaselineCompare
 * @typedef {BaselineCompare & { status: 'below' | 'normal' | 'above' | 'no baseline', pct: number | null, metric: 'hrv_night_avg_ms' | 'hrv_sdnn_ms', measure: 'RMSSD' | 'SDNN' }} HrvReadiness
 * @typedef {{ date: string, value: number }} Dated
 * @typedef {{ sleepScore: Dated | null, bodyBattery: { date: string, high: number | null, low: number | null } | null, trainingReadiness: Dated | null, hrvStatus: { date: string, code: number, label: string } | null, hrvWeeklyAvg: Dated | null }} GarminScores
 * @typedef {BaselineCompare & { status: 'elevated' | 'normal' | 'low' | 'no baseline', delta: number | null }} RestingHrReadiness
 * @typedef {{ date: string, totalMin: number, deepMin: number | null, remMin: number | null, coreMin: number | null, awakeMin: number | null, avg7: number, status: 'short' | 'normal' }} SleepReadiness
 * @typedef {{ latest: number, latestDate: string, avg7: number, change28: number | null }} WeightReadiness
 * @typedef {{ today: string, status: 'good' | 'ok' | 'low' | 'unknown', flags: string[], hrv: HrvReadiness | null, restingHr: RestingHrReadiness | null, sleep: SleepReadiness | null, weight: WeightReadiness | null, garmin: GarminScores }} ReadinessSummary
 */

/** @param {string} d @param {number} n @returns {string} */
export const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
function sd(xs) {
  const m = mean(xs);
  if (m === null || xs.length < 2) return null;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

/**
 * Rows of one metric, sorted by date, as [{ date, value }].
 * @param {SampleRow[]} rows @param {string} metric @param {string} [from] @param {string} [to]
 * @returns {{ date: string, value: number }[]}
 */
export function seriesOf(rows, metric, from = '0000-00-00', to = '9999-99-99') {
  return rows
    .filter((r) => r.metric === metric && r.date >= from && r.date <= to)
    .map((r) => ({ date: r.date, value: Number(r.value) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * The 7-day mean of `metric` against its 60-day baseline before those 7 days.
 * @returns {BaselineCompare | null}
 */
export function baselineCompare(rows, metric, today) {
  const recentFrom = addDays(today, -(RECENT_DAYS - 1));
  const recent = seriesOf(rows, metric, recentFrom, today);
  const base = seriesOf(rows, metric, addDays(recentFrom, -BASELINE_DAYS), addDays(recentFrom, -1));
  const latest = recent.at(-1) ?? null;
  if (!recent.length) return null;
  const avg7 = mean(recent.map((p) => p.value));
  const enough = base.length >= MIN_BASELINE_DAYS;
  return {
    avg7,
    latest: latest?.value ?? null,
    latestDate: latest?.date ?? null,
    days7: recent.length,
    baseline: enough ? mean(base.map((p) => p.value)) : null,
    sd: enough ? sd(base.map((p) => p.value)) : null,
    baselineDays: base.length,
  };
}

/**
 * The HRV metric to use: Garmin's overnight RMSSD when `rows` has any, else Apple Health's SDNN.
 * @param {SampleRow[]} rows
 * @returns {'hrv_night_avg_ms' | 'hrv_sdnn_ms'}
 */
export function hrvMetricOf(rows) {
  return rows.some((r) => r.metric === 'hrv_night_avg_ms') ? 'hrv_night_avg_ms' : 'hrv_sdnn_ms';
}

/**
 * The newest value of `metric` from today or yesterday.
 * @param {SampleRow[]} rows @param {string} metric @param {string} today
 * @returns {Dated | null}
 */
export function recentValue(rows, metric, today) {
  const p = seriesOf(rows, metric, addDays(today, -1), today).at(-1);
  return p ?? null;
}

/**
 * Today's readiness from the rows of the last ~70 days.
 * @param {SampleRow[]} rows
 * @param {string} today YYYY-MM-DD in the viewer's zone
 * @returns {ReadinessSummary}
 */
export function readinessFrom(rows, today) {
  /** @type {string[]} */
  const flags = [];

  const hrvMetric = hrvMetricOf(rows);
  const measure = hrvMetric === 'hrv_night_avg_ms' ? 'RMSSD' : 'SDNN';
  const h = baselineCompare(rows, hrvMetric, today);
  let hrv = null;
  if (h) {
    let status = 'no baseline';
    if (h.baseline !== null && h.sd !== null) {
      const band = Math.max(h.sd, h.baseline * 0.05);
      status = h.avg7 < h.baseline - band ? 'below' : h.avg7 > h.baseline + band ? 'above' : 'normal';
      if (status === 'below') flags.push(`HRV (${measure}) 7-day ${Math.round(h.avg7)} ms is below the 60-day baseline ${Math.round(h.baseline)} ms`);
    }
    hrv = { ...h, status, pct: h.baseline ? (h.avg7 - h.baseline) / h.baseline : null, metric: hrvMetric, measure };
  }

  const r = baselineCompare(rows, 'resting_hr_bpm', today);
  let restingHr = null;
  if (r) {
    let status = 'no baseline';
    if (r.baseline !== null && r.sd !== null) {
      const over = r.avg7 - r.baseline;
      status = over > Math.max(r.sd, 2) ? 'elevated' : over < -Math.max(r.sd, 2) ? 'low' : 'normal';
      if (status === 'elevated') flags.push(`Resting HR 7-day ${Math.round(r.avg7)} bpm is above the 60-day baseline ${Math.round(r.baseline)} bpm`);
    }
    restingHr = { ...r, status, delta: r.baseline === null ? null : r.avg7 - r.baseline };
  }

  const nights = seriesOf(rows, 'sleep_total_min', addDays(today, -(RECENT_DAYS - 1)), today);
  const lastNight = nights.at(-1);
  let sleep = null;
  if (lastNight && lastNight.date >= addDays(today, -1)) {
    const stage = (m) => rows.find((x) => x.metric === m && x.date === lastNight.date)?.value ?? null;
    sleep = {
      date: lastNight.date,
      totalMin: lastNight.value,
      deepMin: stage('sleep_deep_min'),
      remMin: stage('sleep_rem_min'),
      coreMin: stage('sleep_core_min'),
      awakeMin: stage('sleep_awake_min'),
      avg7: mean(nights.map((n) => n.value)),
      status: lastNight.value < SHORT_SLEEP_MIN ? 'short' : 'normal',
    };
    if (sleep.status === 'short') flags.push(`Last night's sleep was ${fmtDuration(lastNight.value)} (under 6 h)`);
  }

  const w = seriesOf(rows, 'weight_kg', addDays(today, -40), today);
  let weight = null;
  if (w.length) {
    const latest = w.at(-1);
    const now7 = w.filter((p) => p.date > addDays(latest.date, -RECENT_DAYS));
    const then7 = w.filter((p) => p.date > addDays(latest.date, -35) && p.date <= addDays(latest.date, -28));
    weight = {
      latest: latest.value,
      latestDate: latest.date,
      avg7: mean(now7.map((p) => p.value)),
      change28: then7.length ? mean(now7.map((p) => p.value)) - mean(then7.map((p) => p.value)) : null,
    };
  }

  const bbHigh = recentValue(rows, 'body_battery_high', today);
  const bbLow = recentValue(rows, 'body_battery_low', today);
  const bbDate = [bbHigh?.date, bbLow?.date].filter(Boolean).sort().at(-1);
  const status = recentValue(rows, 'hrv_status', today);
  const garmin = {
    sleepScore: recentValue(rows, 'sleep_score', today),
    bodyBattery: bbDate
      ? { date: bbDate, high: bbHigh?.date === bbDate ? bbHigh.value : null, low: bbLow?.date === bbDate ? bbLow.value : null }
      : null,
    trainingReadiness: recentValue(rows, 'training_readiness', today),
    hrvStatus: status ? { date: status.date, code: status.value, label: HRV_STATUS[status.value] ?? 'none' } : null,
    hrvWeeklyAvg: recentValue(rows, 'hrv_weekly_avg_ms', today),
  };

  const known = [hrv?.status, restingHr?.status].some((s) => s && s !== 'no baseline') || sleep !== null;
  const verdict = !known ? 'unknown' : flags.length === 0 ? 'good' : flags.length === 1 ? 'ok' : 'low';
  return { today, status: verdict, flags, hrv, restingHr, sleep, weight, garmin };
}

/** 412 → "6 h 52 min". @param {number} min */
export function fmtDuration(min) {
  const m = Math.round(min);
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}
