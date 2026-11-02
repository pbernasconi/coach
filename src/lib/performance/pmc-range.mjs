// Timeframes for the fitness, fatigue and form chart: which past days to show, and how to mark the x axis for
// that span. Pure, so node --test can import it (pmc-range.test.mjs).

/** The chart's timeframes. `days: null` is all history. */
export const PMC_RANGES = [
  { id: '30', label: '30D', days: 30 },
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
 * Very short spans label each Monday with its date instead.
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

  // Zoomed in (30 days plus the projection): a dated label on each Monday.
  if (pxPerDay * 7 >= 60) {
    const labels = grid.map((i) => ({ i, text: `${MONTHS[Number(days[i].date.slice(5, 7)) - 1]} ${Number(days[i].date.slice(8, 10))}` }));
    return { grid, labels };
  }
  const every = monthPx >= 36 ? 1 : monthPx * 3 >= 36 ? 3 : 12;
  const labels = months
    .filter(({ m }) => (m - 1) % every === 0)
    .map(({ i, m, y }) => ({ i, text: m === 1 && crossesYear ? y : MONTHS[m - 1] }));
  return { grid, labels };
}

/**
 * The chart's days in a compact form for the page: one array per series instead of an object per day. "All" is
 * every day since the first activity (thousands of days), and as objects with their keys it was most of the
 * Today page's HTML. Dates are left out when they run day by day (the usual case), and projected days are the
 * tail. `unpackPmcDays` turns it back into the days.
 * @param {{ date: string, ctl: number, atl: number, tsb: number, tss: number, projected: boolean }[]} days
 */
export function packPmcDays(days) {
  const r1 = (/** @type {number} */ n) => Math.round(n * 10) / 10;
  const daily = days.every((d, i) => i === 0 || d.date === addDays(days[i - 1].date, 1));
  const firstProjected = days.findIndex((d) => d.projected);
  const tail = firstProjected < 0 || days.slice(firstProjected).every((d) => d.projected);
  return {
    start: days[0]?.date ?? '',
    ...(daily ? {} : { dates: days.map((d) => d.date) }),
    ...(tail ? { projectedFrom: firstProjected < 0 ? days.length : firstProjected } : { projected: days.map((d) => (d.projected ? 1 : 0)) }),
    ctl: days.map((d) => r1(d.ctl)),
    atl: days.map((d) => r1(d.atl)),
    tsb: days.map((d) => r1(d.tsb)),
    tss: days.map((d) => Math.round(d.tss)),
  };
}

/**
 * @param {ReturnType<typeof packPmcDays>} p
 * @returns {{ date: string, ctl: number, atl: number, tsb: number, tss: number, projected: boolean }[]}
 */
export function unpackPmcDays(p) {
  const out = [];
  let date = p.start;
  for (let i = 0; i < p.ctl.length; i++) {
    if (p.dates) date = p.dates[i];
    else if (i > 0) date = addDays(date, 1);
    const projected = p.projected ? p.projected[i] === 1 : i >= (p.projectedFrom ?? p.ctl.length);
    out.push({ date, ctl: p.ctl[i], atl: p.atl[i], tsb: p.tsb[i], tss: p.tss[i], projected });
  }
  return out;
}
