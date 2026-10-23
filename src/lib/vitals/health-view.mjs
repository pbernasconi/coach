// The display logic of the /health page (src/app/(dashboard)/health/page.tsx): the readiness verdict, the vitals
// row with its range bars and outliers, the board's per-metric captions, and the DEXA and Labs summaries. The web
// components and GET /api/app/health (app-health.mjs) both read it, so the page and the phone say the same. Pure:
// node --test (health-view.test.mjs).

import { shortDay } from './garmin.mjs';

/** "7:05" for 425 minutes. @param {number} m */
export const hm = (m) => `${Math.floor(Math.round(m) / 60)}:${String(Math.round(m) % 60).padStart(2, '0')}`;
/** "Oct 22" for "2026-10-22". @param {string} d */
export const fmtDay = (d) => shortDay(d);
/** "Oct 22, 2026". @param {string} d */
export const fmtDate = (d) => `${shortDay(d)}, ${d.slice(0, 4)}`;
/** @param {number} x */
const r0 = (x) => String(Math.round(x));
/** @param {number} x */
const r1 = (x) => Math.round(x * 10) / 10;

// ---- Readiness ----

/** The verdict of readinessFrom (readiness.mjs): its label and one sentence. */
export const VERDICT = /** @type {const} */ ({
  good: { label: 'Ready', text: 'HRV, resting heart rate and sleep are all near your normal.' },
  ok: { label: 'One flag', text: 'One signal is off. Keep the plan, but watch how the session feels.' },
  low: { label: 'Take it easy', text: 'Several signals are off. An easier day is a good idea.' },
  unknown: { label: 'Not enough data', text: 'Readiness needs HRV or resting heart rate with 14 days of history, or last night’s sleep.' },
});

/** @param {'good' | 'ok' | 'low' | 'unknown'} status */
export function verdictOf(status) {
  return { status, ...(VERDICT[status] ?? VERDICT.unknown) };
}

// ---- The vitals row ----

/**
 * @typedef {{ latest: { date: string, value: number } | null, normal: { low: number, high: number, mean?: number } | null,
 *   status: 'below' | 'normal' | 'above' | null }} Stat
 */

/**
 * The cells of the vitals row, in display order. `bad`: the direction that counts as off.
 * @type {readonly { key: string, label: string, stat: string, unit: string, bad?: 'low' | 'high', fmt: (v: number) => string }[]}
 */
export const VITALS = [
  { key: 'hrv', label: 'HRV', stat: 'hrv', unit: 'ms', bad: 'low', fmt: r0 },
  { key: 'rhr', label: 'Resting HR', stat: 'rhr', unit: 'bpm', bad: 'high', fmt: r0 },
  { key: 'sleep', label: 'Sleep', stat: 'sleep', unit: 'h', bad: 'low', fmt: hm },
  { key: 'score', label: 'Sleep score', stat: 'sleepScore', unit: '', bad: 'low', fmt: r0 },
  { key: 'bb', label: 'Body Battery', stat: 'bbHigh', unit: 'peak', bad: 'low', fmt: r0 },
  { key: 'ready', label: 'Readiness', stat: 'readiness', unit: '', bad: 'low', fmt: r0 },
  { key: 'stress', label: 'Stress', stat: 'stress', unit: 'avg', bad: 'high', fmt: r0 },
  { key: 'weight', label: 'Weight', stat: 'weight', unit: 'kg', fmt: (x) => x.toFixed(1) },
];

/**
 * Whether a value is outside its normal range in the bad direction.
 * @param {'low' | 'high' | undefined} bad
 * @param {Stat['status']} status
 */
export const isOff = (bad, status) => (bad === 'low' && status === 'below') || (bad === 'high' && status === 'above');

/**
 * The range bar's scale: the normal range with one range width on each side, widened to hold the value. Null
 * without a value or a normal range.
 * @param {Stat} stat
 * @returns {{ low: number, high: number, value: number, min: number, max: number } | null}
 */
export function rangeBar(stat) {
  if (!stat.latest || !stat.normal) return null;
  const { low, high } = stat.normal;
  const span = high - low;
  return { low, high, value: stat.latest.value, min: Math.min(low - span, stat.latest.value), max: Math.max(high + span, stat.latest.value) };
}

/**
 * The weight cell's foot: "trend 83.5 · ▼ 0.26/wk", or the day of the reading without a trend.
 * @param {{ latest: { date: string } | null, trend: { text: string, rate: { text: string } | null } | null }} w
 */
export function weightFoot(w) {
  if (!w.latest) return undefined;
  return w.trend ? [`trend ${w.trend.text}`, w.trend.rate?.text.replace(' kg/wk', '/wk')].filter(Boolean).join(' · ') : fmtDay(w.latest.date);
}

/**
 * The vitals row from the board (board.mjs boardOf). Each cell: the latest value's text, the foot ("normal 42–58",
 * "building normal", "No data", the weight trend), `staleText` (the day, when the value is older than yesterday),
 * the status against the normal range, `isOff`, and the range bar's scale. Weight has no normal range.
 * @param {{ days: string[], stats: Record<string, any> }} b
 */
export function vitalCells(b) {
  const yesterday = b.days[b.days.length - 2];
  return VITALS.map((c) => {
    const raw = b.stats[c.stat];
    /** @type {Stat} */
    const stat = c.key === 'weight' ? { ...raw, normal: null, status: null } : raw;
    const l = stat.latest;
    const foot = c.key === 'weight' ? weightFoot(raw) : undefined;
    return {
      key: c.key,
      label: c.label,
      unit: c.unit,
      valueText: l ? c.fmt(l.value) : '–',
      footText: !l ? 'No data' : foot ?? (stat.normal ? `normal ${c.fmt(stat.normal.low)}–${c.fmt(stat.normal.high)}` : 'building normal'),
      staleText: l && c.key !== 'weight' && yesterday && l.date < yesterday ? fmtDay(l.date) : null,
      status: stat.status,
      isOff: isOff(c.bad, stat.status),
      range: rangeBar(stat),
      hasValue: Boolean(l),
    };
  });
}

/**
 * "All within your normal", "Nothing worse than your normal" (some are past it on the good side), or "Outside your
 * normal: HRV low, Stress high".
 * @param {{ label: string, isOff: boolean, status: Stat['status'] }[]} cells
 */
export function outliersText(cells) {
  const off = cells.filter((c) => c.isOff);
  // A value past its range on the good side (resting HR below, readiness above) is not "within" it.
  const better = cells.some((c) => !c.isOff && (c.status === 'above' || c.status === 'below'));
  if (off.length === 0) return better ? 'Nothing worse than your normal' : 'All within your normal';
  return `Outside your normal: ${off.map((c) => `${c.label} ${c.status === 'above' ? 'high' : 'low'}`).join(', ')}`;
}

// ---- The board ----

/** Where each metric should ideally be: the Lean & Strong plan's 7.5 h of sleep, Garmin's own bands, 10k steps. */
export const GOALS = { sleepMin: 450, sleepScore: 80, bodyBattery: 75, readiness: 75, stress: 25, steps: 10000, intensityPerDay: 150 / 7 };

/** "8.4k" for 8 420 steps. @param {number} x */
export const kSteps = (x) => `${(Math.round(x / 100) / 10).toFixed(1)}k`;

/**
 * The board's charts, in display order: the series key (boardOf's `series`), the stat (its normal range, when it has
 * one), the trend key (the 30/90-day averages), the unit, the value format, what counts as off, the goal line, and
 * the chart's one-paragraph explanation.
 * @type {readonly { key: string, title: string, label: string, unit: string, fmt: (v: number) => string, stat?: string, trend?: string,
 *   noun?: string, bad?: 'low' | 'high', goal?: { value: number, label: string }, info?: string }[]}
 */
export const BOARD_CHARTS = [
  { key: 'sleep', title: 'Sleep', label: 'Sleep', unit: 'h', fmt: hm, stat: 'sleep', trend: 'sleep', noun: 'nights', bad: 'low', goal: { value: GOALS.sleepMin, label: 'goal 7:30' } },
  { key: 'hrv', title: 'HRV', label: 'HRV', unit: 'ms', fmt: r0, stat: 'hrv', trend: 'hrv', noun: 'nights', bad: 'low', info: "Overnight average (RMSSD, ms). Shaded: Garmin's balanced range for you. Amber and red dots: unbalanced or low nights." },
  { key: 'rhr', title: 'Resting HR', label: 'Resting HR', unit: 'bpm', fmt: r0, stat: 'rhr', trend: 'rhr', bad: 'high' },
  { key: 'sleepScore', title: 'Sleep score', label: 'Sleep score', unit: '', fmt: r0, stat: 'sleepScore', trend: 'sleepScore', noun: 'nights', bad: 'low', goal: { value: GOALS.sleepScore, label: 'good 80' }, info: "Garmin's 0–100 score for the night. 80+ good, 60–79 fair, under 60 poor." },
  { key: 'bbHigh', title: 'Body Battery', label: 'Body Battery', unit: 'peak', fmt: r0, stat: 'bbHigh', trend: 'bbHigh', bad: 'low', goal: { value: GOALS.bodyBattery, label: 'charged 75' }, info: "Each bar runs from the day's lowest to its highest Body Battery (0–100)." },
  { key: 'readiness', title: 'Training readiness', label: 'Readiness', unit: '', fmt: r0, stat: 'readiness', trend: 'readiness', bad: 'low', goal: { value: GOALS.readiness, label: 'high 75' }, info: "Garmin's morning score (0–100): 75+ high, 50–74 moderate, 25–49 low." },
  { key: 'stress', title: 'Stress', label: 'Stress', unit: 'avg', fmt: r0, stat: 'stress', trend: 'stress', bad: 'high', goal: { value: GOALS.stress, label: 'rest < 25' }, info: "Garmin's all-day average stress (0–100). Under 25 is rest." },
  { key: 'respiration', title: 'Respiration', label: 'Respiration', unit: 'brpm', fmt: (x) => x.toFixed(1), stat: 'respiration', trend: 'respiration', noun: 'nights', info: 'Average breaths per minute while asleep.' },
  { key: 'intensity', title: 'Intensity minutes', label: 'Intensity', unit: 'min', fmt: r0, trend: 'intensity', goal: { value: GOALS.intensityPerDay, label: '150/wk pace' }, info: 'Moderate minutes plus vigorous minutes counted twice, as Garmin does. The weekly goal is 150.' },
  { key: 'steps', title: 'Steps', label: 'Steps', unit: 'steps', fmt: kSteps, trend: 'steps', goal: { value: GOALS.steps, label: '10k' } },
  { key: 'weight', title: 'Weight', label: 'Weight', unit: 'kg', fmt: (x) => x.toFixed(1), info: 'Dots: each scale reading. Line: the trend, a smoothed average that moves 10% of the way to each new reading per day, so a salty dinner barely shifts it.' },
  { key: 'vo2max', title: 'VO2max', label: 'VO2max', unit: 'mL/kg/min', fmt: (x) => x.toFixed(1), info: 'Estimated by the watch after outdoor runs (mL/kg/min).' },
];

/** @param {string} key */
export const boardChart = (key) => {
  const c = BOARD_CHARTS.find((x) => x.key === key);
  if (!c) throw new Error(`no board chart ${key}`);
  return c;
};

/**
 * A chart's foot: "21/30 nights" (days with a value of the days synced) and "30d 45 · 90d 47".
 * @param {{ days: string[], coverage: Record<string, string>, series: Record<string, (number | null)[]>, trend: Record<string, any> }} b
 * @param {string} key a BOARD_CHARTS key
 */
export function boardFoot(b, key) {
  const c = boardChart(key);
  const synced = b.days.filter((d) => b.coverage[d] !== 'pending').length;
  const v = b.series[c.key] ?? [];
  const t = c.trend ? b.trend[c.trend] : null;
  return {
    recorded: `${v.filter((x) => x !== null).length}/${synced} ${c.noun ?? 'days'}`,
    compare: t && t.avg30 !== null && t.avg90 !== null ? `30d ${c.fmt(t.avg30)} · 90d ${c.fmt(t.avg90)}` : null,
  };
}

/** The resting HR chart's explanation, with the normal range when there is one. @param {{ low: number, high: number } | null} normal */
export const rhrInfo = (normal) => (normal ? `Beats per minute. Shaded: your normal, ${Math.round(normal.low)}–${Math.round(normal.high)} bpm (60 days).` : 'Beats per minute.');

/** The weight chart's aside: "trend 83.5 · ▼ 0.26 kg/wk". @param {{ text: string, rate: { text: string } | null } | null} t */
export const weightAside = (t) => (t ? `trend ${t.text}${t.rate ? ` · ${t.rate.text}` : ''}` : undefined);

// ---- DEXA ----

/**
 * A change between scans: the glyph and size ("▼ 0.6 pts since last") and its tone (good when it went the
 * measure's better way). Null without a change.
 * @param {{ digits: number, unit: string, better: 'up' | 'down' | null }} m
 * @param {number | null} value
 * @param {string} label
 * @returns {{ text: string, glyph: string, amountText: string, label: string, tone: 'good' | 'bad' | 'neutral' } | null}
 */
export function dexaChange(m, value, label) {
  if (value === null) return null;
  const flat = Math.abs(value) < 10 ** -m.digits / 2;
  const good = m.better === null || flat ? null : (value < 0) === (m.better === 'down');
  const glyph = flat ? '→' : value > 0 ? '▲' : '▼';
  const amountText = `${Math.abs(value).toFixed(m.digits)}${m.unit === '%' ? ' pts' : m.unit ? ` ${m.unit}` : ''}`;
  return { text: `${glyph} ${amountText}${label ? ` ${label}` : ''}`, glyph, amountText, label, tone: good === null ? 'neutral' : good ? 'good' : 'bad' };
}

/**
 * The DEXA section's line under its title.
 * @param {{ latest: { scanDate: string, location: string | null } | null, scans: unknown[] }} dexa
 */
export function dexaCaption(dexa) {
  const { latest, scans } = dexa;
  return latest
    ? `${scans.length} DEXA ${scans.length === 1 ? 'scan' : 'scans'} · latest ${fmtDate(latest.scanDate)}${latest.location ? ` · ${latest.location}` : ''}`
    : 'DEXA scans from BodySpec: body fat, visceral (belly) fat and lean mass per arm.';
}

// ---- Labs ----

/** A lab number: whole above 100, else 3 significant digits. @param {number} v */
export const labNum = (v) => (Math.abs(v) >= 100 ? String(Math.round(v)) : String(+v.toPrecision(3)));
/** @param {{ valueText: string | null, value: number | null }} r */
export const labReading = (r) => r.valueText ?? (r.value === null ? '-' : labNum(r.value));

/** "40–60", "≥ 30", "≤ 100", or null. @param {number | null} low @param {number | null} high */
export function labRangeText(low, high) {
  if (low !== null && high !== null) return `${labNum(low)}–${labNum(high)}`;
  if (low !== null) return `≥ ${labNum(low)}`;
  if (high !== null) return `≤ ${labNum(high)}`;
  return null;
}

export const LAB_STATUS = /** @type {const} */ ({
  out_of_range: { label: 'Out of range' },
  in_range: { label: 'In range' },
  optimal: { label: 'Optimal' },
  unknown: { label: 'No range' },
});

/**
 * The change since the previous draw (labs-highlights.mjs trend) as text: "▲ 12", "→ steady", with the earlier
 * draw's month ("Mar '26") and a tone (good toward the optimal range). Null with fewer than two numeric draws.
 * @param {{ delta: number, previous: number, previousOn: string, better: boolean | null } | null} t
 */
export function labTrendView(t) {
  if (!t) return null;
  const flat = Math.abs(t.delta) < Math.abs(t.previous) * 0.005;
  const [y, m] = t.previousOn.split('-');
  const month = shortDay(`${y}-${m}-01`).split(' ')[0];
  return {
    glyph: flat ? '→' : t.delta > 0 ? '▲' : '▼',
    amountText: flat ? 'steady' : labNum(Math.abs(t.delta)),
    sinceText: `vs ${month} '${y.slice(2, 4)}`,
    titleText: `${labNum(t.previous)} on ${fmtDate(t.previousOn)}`,
    tone: /** @type {'good' | 'bad' | 'neutral'} */ (flat || t.better === null ? 'neutral' : t.better ? 'good' : 'bad'),
  };
}

/**
 * The Labs summary: the latest draw, counts by status, and the out-of-range biomarkers (at most `limit`).
 * @param {{ category: string, outOfRange: number, biomarkers: { biomarker: string, unit: string | null, refLow: number | null, refHigh: number | null,
 *   latest: { value: number | null, valueText: string | null, status: string } }[] }[]} categories
 * @param {string[]} draws oldest first
 */
export function labsSummary(categories, draws, limit = 8) {
  const all = categories.flatMap((c) => c.biomarkers);
  const by = (s) => all.filter((b) => b.latest.status === s).length;
  const out = all.filter((b) => b.latest.status === 'out_of_range');
  const last = draws.at(-1) ?? null;
  return {
    drawDate: all.length ? last : null,
    drawDateText: all.length && last ? fmtDate(last) : null,
    drawCount: draws.length,
    counts: { total: all.length, inRange: by('in_range') + by('optimal'), outOfRange: out.length, noRange: by('unknown') },
    items: out.slice(0, limit).map((b) => ({
      name: b.biomarker,
      valueText: labReading(b.latest),
      unit: b.unit,
      rangeText: labRangeText(b.refLow, b.refHigh),
      status: b.latest.status,
      statusText: LAB_STATUS[/** @type {keyof typeof LAB_STATUS} */ (b.latest.status)]?.label ?? 'No range',
    })),
    moreCount: Math.max(0, out.length - limit),
  };
}

export { r1 };
