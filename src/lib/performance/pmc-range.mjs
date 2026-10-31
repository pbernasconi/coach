// Timeframes for the fitness, fatigue and form chart: which past days to show, and how to mark the x axis for
// that span. Pure, so node --test can import it (pmc-range.test.mjs).

/** The chart's timeframes. `days: null` is all history. */
export const PMC_RANGES = [
  { id: '90', label: '90D', days: 90 },
  { id: '180', label: '180D', days: 180 },
  { id: '365', label: '1Y', days: 365 },
  { id: 'all', label: 'All', days: null },
];
export const DEFAULT_PMC_RANGE = '90';

/** @param {unknown} v @returns {v is string} */
export const isPmcRange = (v) => typeof v === 'string' && PMC_RANGES.some((r) => r.id === v);

const DAY_MS = 86400000;
/** @param {string} key @param {number} n */
const addDays = (key, n) => new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/**
 * The days the chart shows for a timeframe: the last `days` days up to today, then every projected day.
 * @template {{ date: string, projected: boolean }} D
 * @param {D[]} days @param {string} today @param {string} rangeId
 * @returns {D[]}
 */
export function daysInRange(days, today, rangeId) {
  const range = PMC_RANGES.find((r) => r.id === rangeId);
  if (!range || range.days === null) return days;
  const first = addDays(today, -range.days);
  return days.filter((d) => d.projected || d.date >= first);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The x axis for a span: vertical grid lines (Mondays on short spans, month starts on longer ones) and month
 * labels, thinned to quarters or years when months get too close. January reads as the year when the span
 * crosses a year.
 * @param {{ date: string }[]} days @param {number} plotWidth
 * @returns {{ grid: number[], labels: { i: number, text: string }[] }}
 */
export function pmcAxis(days, plotWidth) {
  const n = days.length;
  const pxPerDay = n > 1 ? plotWidth / (n - 1) : plotWidth;
  const monthPx = pxPerDay * 30.4;
  const months = [];
  days.forEach((d, i) => { if (d.date.endsWith('-01')) months.push({ i, m: Number(d.date.slice(5, 7)), y: d.date.slice(0, 4) }); });
  const crossesYear = n > 0 && days[0].date.slice(0, 4) !== days[n - 1].date.slice(0, 4);

  const grid = pxPerDay * 7 >= 12
    ? days.flatMap((d, i) => (new Date(`${d.date}T12:00:00Z`).getUTCDay() === 1 ? [i] : []))
    : months.filter(({ m }) => monthPx >= 10 || m % 3 === 1).map(({ i }) => i);

  const every = monthPx >= 36 ? 1 : monthPx * 3 >= 36 ? 3 : 12;
  const labels = months
    .filter(({ m }) => (m - 1) % every === 0)
    .map(({ i, m, y }) => ({ i, text: m === 1 && crossesYear ? y : MONTHS[m - 1] }));
  return { grid, labels };
}
