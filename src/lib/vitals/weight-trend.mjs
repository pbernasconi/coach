// @ts-check
// The weight trend every weight view shows (Lift's weigh-in screen and Today card, the web's home rail and Health):
// the scale's reading is noisy (water, salt, food in the gut), so the views lead with the reading and then read the
// smoothed trend under it, like MacroFactor, Happy Scale and Libra. Pure; no database.

/** Share of the gap between trend and reading that one day closes (the Hacker's Diet uses 0.1). */
export const ALPHA = 0.1;
/** The rate is the slope of the trend over this many days. */
const RATE_DAYS = 14;
/** The normal swing is measured over this many days of readings. */
const SWING_DAYS = 28;
/** The swing is never shown smaller than this: a scale reads to 0.1 kg and bodies move more than that. */
const MIN_SWING = 0.3;

const DAY = 864e5;
const t = (/** @type {string} */ d) => Date.parse(`${d}T00:00:00Z`);
const r1 = (/** @type {number} */ v) => Math.round(v * 10) / 10;
const r2 = (/** @type {number} */ v) => Math.round(v * 100) / 100;

/**
 * @typedef {{ date: string, value: number }} Reading
 * @typedef {Reading & { trend: number }} TrendPoint
 */

/**
 * Each reading with the trend through it: an exponential moving average per day, so a gap of n days without a
 * reading moves the trend as far as n daily steps would (1 - (1 - α)^n). The first reading starts the trend.
 * @param {Reading[]} readings oldest first, one per day
 * @returns {TrendPoint[]}
 */
export function withTrend(readings) {
  /** @type {TrendPoint[]} */
  const out = [];
  for (const p of readings) {
    const prev = out.at(-1);
    if (!prev) {
      out.push({ ...p, trend: p.value });
      continue;
    }
    const gap = Math.max(1, Math.round((t(p.date) - t(prev.date)) / DAY));
    const a = 1 - (1 - ALPHA) ** gap;
    out.push({ ...p, trend: prev.trend + a * (p.value - prev.trend) });
  }
  return out;
}

/**
 * kg a week: the least-squares slope of the trend over the last 14 days, or null with fewer than 2 readings or
 * less than a week between the first and last of them.
 * @param {TrendPoint[]} points
 */
export function trendRate(points) {
  const last = points.at(-1);
  if (!last) return null;
  const from = t(last.date) - RATE_DAYS * DAY;
  const win = points.filter((p) => t(p.date) >= from);
  if (win.length < 2 || (t(last.date) - t(win[0].date)) / DAY < 7) return null;
  const xs = win.map((p) => (t(p.date) - from) / DAY);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = win.reduce((a, p) => a + p.trend, 0) / win.length;
  let num = 0;
  let den = 0;
  win.forEach((p, i) => {
    num += (xs[i] - mx) * (p.trend - my);
    den += (xs[i] - mx) ** 2;
  });
  return den === 0 ? null : (num / den) * 7;
}

/**
 * The usual distance between a reading and the trend: 1.5 × the root mean square of reading minus trend over the
 * last 4 weeks (about 9 days in 10 fall inside it), at least 0.3 kg, to 0.1. Null with fewer than 5 readings.
 * @param {TrendPoint[]} points
 */
export function normalSwing(points) {
  const last = points.at(-1);
  if (!last) return null;
  const from = t(last.date) - SWING_DAYS * DAY;
  const off = points.filter((p) => t(p.date) >= from).map((p) => p.value - p.trend);
  if (off.length < 5) return null;
  // Root mean square, not a standard deviation: a trend that lags a steady loss is part of the distance.
  const rms = Math.sqrt(off.reduce((a, b) => a + b * b, 0) / off.length);
  return r1(Math.max(MIN_SWING, 1.5 * rms));
}

/**
 * The rate for display. Down is good: the goal is losing fat (COACH.md).
 * @param {number | null} perWeek
 */
export function rateView(perWeek) {
  if (perWeek == null) return null;
  const v = r2(perWeek);
  const flat = Math.abs(v) < 0.05;
  return {
    kgPerWeek: v,
    /** "▼ 0.26 kg/wk", "± 0.02 kg/wk". */
    text: `${flat ? '±' : v < 0 ? '▼' : '▲'} ${Math.abs(v).toFixed(2)} kg/wk`,
    tone: flat ? 'neutral' : v < 0 ? 'good' : 'bad',
  };
}

/**
 * One plain sentence on where a reading sits against the trend.
 * @param {number} off reading minus trend, kg
 * @param {number | null} swing
 */
export function offTrendText(off, swing) {
  const kg = Math.abs(r1(off));
  if (kg === 0) return 'Today is right on your trend.';
  const where = `Today is ${kg.toFixed(1)} kg ${off < 0 ? 'under' : 'over'} your trend`;
  if (swing == null) return `${where}. The trend moves slowly, so one reading only nudges it.`;
  if (kg <= swing) return `${where}, inside your normal ±${swing.toFixed(1)} kg day-to-day swing. Read the line, not the dot.`;
  return off > 0
    ? `${where}, more than your usual ±${swing.toFixed(1)} kg swing. Salt, carbs or a late meal often do this; the trend barely moves.`
    : `${where}, more than your usual ±${swing.toFixed(1)} kg swing. Expect some of it back tomorrow; the trend barely moves.`;
}

/**
 * The trend as of the last reading in `readings`.
 * @param {Reading[]} readings oldest first
 */
export function weightTrend(readings) {
  const points = withTrend(readings);
  const last = points.at(-1);
  if (!last) return null;
  const swing = normalSwing(points);
  const off = last.value - last.trend;
  return {
    points,
    kg: r2(last.trend),
    /** "83.3". */
    text: last.trend.toFixed(1),
    rate: rateView(trendRate(points)),
    offKg: r1(off),
    swingKg: swing,
    noteText: points.length < 2 ? null : offTrendText(off, swing),
  };
}
