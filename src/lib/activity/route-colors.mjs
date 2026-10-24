// The route line coloured by a metric (pace, heart rate, zones, elevation, grade, power, cadence), as the map's
// "Colour by" button shows it on the web (RouteMap.tsx) and in the iPhone app (route.colored, lift/APP-API.md).
// Each metric gives every route point a bin (0 = low end of the scale) and the bins' colours. No framework imports.

import { pace } from './format.mjs';
import { bucketMean, buckets, smooth, zoneIndex } from './streams.mjs';

/** Low to high: blue, teal, green, yellow, orange, red, dark red. Faster, harder and higher are warmer. */
export const HEAT = ['#2c7bb6', '#00a6ca', '#00b38a', '#7cc242', '#d4c21a', '#f5a623', '#f06c1f', '#e0301e', '#a50f15'];
/** Zone 1 grey-blue (easy) to the top zone dark red. Five-zone models use the first two, green, orange and red. */
const ZONES_7 = ['#8a9bb0', '#2c7bb6', '#2fa84f', '#d4c21a', '#f5a623', '#e0301e', '#a50f15'];
const ZONES_5 = ['#8a9bb0', '#2c7bb6', '#2fa84f', '#f5a623', '#e0301e'];
/** Low ground green, high ground brown. */
export const TERRAIN = ['#1a9850', '#66bd63', '#a6d96a', '#d9c55a', '#c48a3a', '#8c510a', '#5a3206'];
/** Steep down blue, flat grey, steep up red. */
export const GRADE = ['#2166ac', '#4393c3', '#92c5de', '#a8a8a0', '#f4a582', '#d6604d', '#b2182b'];
/** The grade bins' inner edges, in percent. */
export const GRADE_EDGES = [-8, -4, -1.5, 1.5, 4, 8];
/** Grade over at least this many metres around a point. */
const GRADE_SPAN_M = 100;
/** The window the speed, heart rate, cadence and power are smoothed over, as the charts do. */
const SMOOTHING_S = 30;

const num = (v) => typeof v === 'number' && Number.isFinite(v);

/** The p-th percentile (0–1) of the numbers in `values`. */
function percentile(values, p) {
  const xs = values.filter(num).sort((a, b) => a - b);
  if (!xs.length) return null;
  return xs[Math.min(xs.length - 1, Math.max(0, Math.round(p * (xs.length - 1))))];
}

/** Gaps take the bin before them (the first ones the bin after), so the line stays whole through a stop. */
export function fillGaps(bins) {
  const out = [...bins];
  let last = null;
  for (let i = 0; i < out.length; i++) {
    if (out[i] == null) out[i] = last;
    else last = out[i];
  }
  let next = null;
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i] == null) out[i] = next;
    else next = out[i];
  }
  return out;
}

/**
 * Bins on a scale from the 5th to the 95th percentile, so a few odd samples do not wash out the rest.
 * @param {(number | null)[]} values
 * @param {number} count  bins
 * @returns {{ bins: (number | null)[], lo: number, hi: number } | null}
 */
export function scaleBins(values, count) {
  const lo = percentile(values, 0.05);
  const hi = percentile(values, 0.95);
  if (lo == null || hi == null) return null;
  const span = hi - lo;
  const mid = Math.floor(count / 2);
  const bins = values.map((v) => {
    if (!num(v)) return null;
    if (!(span > 0)) return mid;
    return Math.max(0, Math.min(count - 1, Math.floor(((v - lo) / span) * count)));
  });
  return { bins, lo, hi };
}

/** The grade bin for a grade in percent. */
export function gradeBin(g) {
  if (!num(g)) return null;
  let b = 0;
  while (b < GRADE_EDGES.length && g >= GRADE_EDGES[b]) b++;
  return b;
}

/**
 * Grade in percent at each point: the climb over at least GRADE_SPAN_M around it (wider where the points are far
 * apart, as on a long ride cut to 1000 points).
 * @param {(number | null)[]} alt
 * @param {(number | null)[]} d  metres
 */
export function gradeSeries(alt, d) {
  const n = Math.min(alt.length, d.length);
  const out = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (!num(d[i]) || !num(alt[i])) continue;
    let a = i;
    let b = i;
    while ((d[b] ?? 0) - (d[a] ?? 0) < GRADE_SPAN_M && (a > 0 || b < n - 1)) {
      if (a > 0 && num(d[a - 1]) && num(alt[a - 1])) a--;
      else if (a > 0) break;
      if (b < n - 1 && num(d[b + 1]) && num(alt[b + 1])) b++;
      else if (b < n - 1) break;
    }
    const run = /** @type {number} */ (d[b]) - /** @type {number} */ (d[a]);
    if (run >= 10) out[i] = ((/** @type {number} */ (alt[b]) - /** @type {number} */ (alt[a])) / run) * 100;
  }
  return out;
}

/**
 * Every metric the activity can colour its route by, on the route's points.
 * @param {{ t: number[], d?: (number|null)[] | null, lat: (number|null)[] | null, lng: (number|null)[] | null, alt?: (number|null)[] | null,
 *   speed?: (number|null)[] | null, gap?: (number|null)[] | null, hr?: (number|null)[] | null, cad?: (number|null)[] | null, watts?: (number|null)[] | null } | null} series
 * @param {{ foot: boolean, hrZones?: { min: number, max: number }[], powerZones?: { min: number, max: number }[], points?: number }} opts
 *   `points`: cut the series to at most this many points (the phone's 400); the web keeps the series' own points.
 * @returns {{ points: [number, number][], metrics: { key: string, label: string, unit: string, colors: string[], bins: (number | null)[], lowText: string, highText: string }[] } | null}
 */
export function routeColors(series, { foot, hrZones = [], powerZones = [], points = Infinity }) {
  if (!series?.lat || !series.lng || !series.t?.length) return null;
  const t = series.t;
  const sm = (v) => (v && v.some(num) ? smooth(v, t, SMOOTHING_S) : null);
  // Stops are gaps for pace and speed (the line keeps the colour from before the stop).
  const moving = (v) => (v ? v.map((x) => (num(x) && x >= (foot ? 0.5 : 1) ? x : null)) : null);
  const movingSpeed = moving(series.speed);
  const movingGap = foot ? moving(series.gap) : null;
  const onlyMoving = (smoothed, mv) => (smoothed && mv ? smoothed.map((x, i) => (num(mv[i]) ? x : null)) : null);
  const raw = {
    speed: onlyMoving(sm(movingSpeed), movingSpeed),
    gap: onlyMoving(sm(movingGap), movingGap),
    hr: sm(series.hr),
    cad: sm(series.cad ? series.cad.map((c) => (num(c) && c > 0 ? c : null)) : null),
    watts: series.watts?.some((x) => num(x) && x > 0) ? sm(series.watts) : null,
    alt: series.alt && series.alt.some(num) ? series.alt : null,
    grade: series.alt && series.d && series.alt.some(num) && series.d.some(num) ? gradeSeries(series.alt, series.d) : null,
  };

  // Cut to the phone's points: the middle point of each bucket, the mean of each value.
  const n = t.length;
  const bs = buckets(n, Math.min(n, points));
  const mid = ([a, b]) => Math.floor((a + b - 1) / 2);
  const lat = bs.map((b) => series.lat?.[mid(b)] ?? null);
  const lng = bs.map((b) => series.lng?.[mid(b)] ?? null);
  const keep = lat.map((la, i) => num(la) && num(lng[i]));
  if (keep.filter(Boolean).length < 2) return null;
  const cut = (v) => (v ? /** @type {(number | null)[]} */ (bucketMean(v, bs, 3)) : null);
  const vals = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, cut(v)]));
  const only = (arr) => arr.filter((_, i) => keep[i]);

  /** @type {{ key: string, label: string, unit: string, colors: string[], bins: (number | null)[], lowText: string, highText: string }[]} */
  const metrics = [];
  const add = (key, label, unit, colors, bins, lowText, highText) => {
    const kept = fillGaps(only(bins));
    if (kept.some((b) => b != null)) metrics.push({ key, label, unit, colors, bins: kept, lowText, highText });
  };
  const heat = (key, label, unit, v, text) => {
    if (!v) return;
    const s = scaleBins(v, HEAT.length);
    if (s) add(key, label, unit, HEAT, s.bins, text(s.lo), text(s.hi));
  };
  const zones = (key, label, v, zs) => {
    if (!v || zs.length < 2) return;
    const colors = zs.length <= 5 ? ZONES_5.slice(0, zs.length) : ZONES_7.slice(0, zs.length);
    add(key, label, '', colors, v.map((x) => (num(x) && x > 0 ? Math.min(colors.length - 1, zoneIndex(x, zs)) : null)), 'Z1', `Z${zs.length}`);
  };
  const round = (x) => String(Math.round(x));

  if (foot) heat('pace', 'Pace', '/km', vals.speed, pace);
  else heat('speed', 'Speed', 'km/h', vals.speed, (x) => (x * 3.6).toFixed(1));
  if (foot) heat('gap', 'Grade-adjusted pace', '/km', vals.gap, pace);
  heat('hr', 'Heart rate', 'bpm', vals.hr, round);
  zones('hrZones', 'Heart rate zones', vals.hr, hrZones);
  if (vals.watts) heat('power', 'Power', 'W', vals.watts, round);
  zones('powerZones', 'Power zones', vals.watts, powerZones);
  if (vals.alt) {
    const s = scaleBins(vals.alt, TERRAIN.length);
    // A flat route keeps a scale at least 20 m tall, so it does not look like a mountain.
    if (s) {
      const lo = Math.min(s.lo, (s.lo + s.hi) / 2 - 10);
      const hi = Math.max(s.hi, (s.lo + s.hi) / 2 + 10);
      const bins = vals.alt.map((x) => (num(x) ? Math.max(0, Math.min(TERRAIN.length - 1, Math.floor(((x - lo) / (hi - lo)) * TERRAIN.length))) : null));
      add('elevation', 'Elevation', 'm', TERRAIN, bins, round(lo), round(hi));
    }
  }
  if (vals.grade) add('grade', 'Grade', '%', GRADE, vals.grade.map(gradeBin), `${GRADE_EDGES[0]}`, `+${GRADE_EDGES[GRADE_EDGES.length - 1]}`);
  heat('cadence', 'Cadence', foot ? 'spm' : 'rpm', vals.cad, round);

  return { points: only(lat.map((la, i) => [round5(la), round5(lng[i])])), metrics };
}

const round5 = (x) => (num(x) ? Math.round(x * 1e5) / 1e5 : x);

/**
 * The line cut where its colour changes: one piece per run of the same bin. Each piece starts at the last point of
 * the one before, so the line has no gaps.
 * @template P
 * @param {P[]} points
 * @param {(number | null)[]} bins
 * @returns {{ bin: number | null, points: P[] }[]}
 */
export function routePieces(points, bins) {
  /** @type {{ bin: number | null, points: P[] }[]} */
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const bin = bins[i] ?? null;
    const last = out[out.length - 1];
    if (last && last.bin === bin) last.points.push(points[i]);
    else out.push({ bin, points: last ? [last.points[last.points.length - 1], points[i]] : [points[i]] });
  }
  return out.filter((p) => p.points.length > 1);
}

