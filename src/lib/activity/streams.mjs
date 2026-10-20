// Stream maths for the activity page. No framework or database imports, so node --test can run it (streams.test.mjs).

/**
 * Seconds in each zone. Each sample counts for the time to the next sample (gaps over 30 s count 1 s: a pause).
 * @param {(number | null)[]} values  heart rate or watts
 * @param {number[] | undefined} time  seconds from the start
 * @param {{ min: number, max: number }[]} zones  max -1 = open-ended (Strava's format)
 * @returns {Record<string, number> | null}  { z1: s, z2: s, … }
 */
export function zoneTimes(values, time, zones) {
  if (!values?.length || !zones?.length) return null;
  const out = Object.fromEntries(zones.map((_, i) => [`z${i + 1}`, 0]));
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (typeof v !== 'number' || !(v > 0)) continue;
    let dt = 1;
    if (time && i + 1 < time.length) dt = time[i + 1] - time[i];
    if (!Number.isFinite(dt) || dt <= 0 || dt > 30) dt = 1;
    out[`z${zoneIndex(v, zones) + 1}`] += dt;
  }
  return out;
}

/**
 * The 0-based zone for a value. Strava's zones share their edges ({min: 122, max: 153}, {min: 153, max: 168}) and
 * a value on an edge belongs to the lower zone: Strava shows Z3 as 154–168, so 153 bpm is Z2.
 */
export function zoneIndex(v, zones) {
  let z = 0;
  for (let i = 1; i < zones.length; i++) if (v > zones[i].min) z = i;
  return z;
}

// ===== Grade-adjusted pace =====

/**
 * The cost of running on a grade relative to flat ground (Minetti et al. 2002, the energy cost of running per
 * meter, J/kg/m, divided by its flat value 3.6). Grade is a fraction (0.05 = 5 %), clamped to ±45 %.
 */
export function gradeFactor(grade) {
  const i = Math.max(-0.45, Math.min(0.45, Number.isFinite(grade) ? grade : 0));
  const cost = 155.4 * i ** 5 - 30.4 * i ** 4 - 43.3 * i ** 3 + 46.3 * i ** 2 + 19.5 * i + 3.6;
  return cost / 3.6;
}

/**
 * Grade-adjusted speed (m/s): the flat speed with the same effort. `gradePct` is Strava's grade_smooth (percent).
 * @param {(number | null)[]} velocity  m/s
 * @param {(number | null)[]} gradePct
 */
export function gapSpeeds(velocity, gradePct) {
  return velocity.map((v, i) => (typeof v === 'number' ? v * gradeFactor((gradePct?.[i] ?? 0) / 100) : null));
}

// ===== Smoothing and summaries =====

/**
 * A centered moving average over a time window (seconds). Nulls are skipped; a window with no values gives null.
 * windowS <= 0 returns the values unchanged.
 * @param {(number | null)[]} values
 * @param {number[]} time  seconds, rising
 */
export function smooth(values, time, windowS) {
  if (!(windowS > 0) || !values?.length) return values ?? [];
  const n = values.length;
  const half = windowS / 2;
  const out = new Array(n).fill(null);
  let lo = 0;
  let hi = -1;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    const t = time?.[i] ?? i;
    while (hi + 1 < n && (time?.[hi + 1] ?? hi + 1) <= t + half) {
      hi++;
      if (typeof values[hi] === 'number') { sum += values[hi]; count++; }
    }
    while ((time?.[lo] ?? lo) < t - half) {
      if (typeof values[lo] === 'number') { sum -= values[lo]; count--; }
      lo++;
    }
    out[i] = count ? sum / count : null;
  }
  return out;
}

/** The time-weighted mean of a stream between two indexes (inclusive), ignoring nulls and paused samples. */
export function meanBetween(values, time, from = 0, to = (values?.length ?? 0) - 1, moving) {
  let sum = 0;
  let w = 0;
  for (let i = Math.max(0, from); i <= Math.min(to, values.length - 1); i++) {
    const v = values[i];
    if (typeof v !== 'number' || (moving && moving[i] === false)) continue;
    let dt = time && i + 1 < time.length ? time[i + 1] - time[i] : 1;
    if (!(dt > 0) || dt > 30) dt = 1;
    sum += v * dt;
    w += dt;
  }
  return w ? sum / w : null;
}

/**
 * Splits of `splitM` meters from the distance and time streams (for activities without Strava's splits). Each:
 * distance (m), elapsed (s), moving (s), the elevation change (m), mean HR and mean grade-adjusted speed when given.
 * @param {{ distance: number[], time: number[], altitude?: (number | null)[], heartrate?: (number | null)[],
 *           velocity?: (number | null)[], grade?: (number | null)[], moving?: boolean[] }} streams
 * @param {number} [splitM]
 */
export function splitsFromStreams({ distance, time, altitude, heartrate, velocity, grade, moving }, splitM = 1000) {
  const n = Math.min(distance?.length ?? 0, time?.length ?? 0);
  const out = [];
  if (n < 2) return out;
  const gap = velocity && grade ? gapSpeeds(velocity, grade) : null;
  let start = 0;
  let next = distance[0] + splitM;
  const push = (end) => {
    let mov = 0;
    for (let i = start; i < end; i++) {
      const dt = time[i + 1] - time[i];
      if (dt > 0 && (!moving || moving[i + 1] !== false)) mov += dt;
    }
    out.push({
      index: out.length + 1,
      distance: distance[end] - distance[start],
      elapsed: time[end] - time[start],
      moving: mov,
      elevDiff: altitude ? altitude[end] - altitude[start] : null,
      hr: heartrate ? meanBetween(heartrate, time, start, end) : null,
      gapSpeed: gap ? meanBetween(gap, time, start, end, moving) : null,
      startIndex: start,
      endIndex: end,
    });
    start = end;
  };
  for (let i = 1; i < n; i++) {
    if (distance[i] >= next) {
      push(i);
      next += splitM;
    }
  }
  if (start < n - 1 && distance[n - 1] - distance[start] >= 50) push(n - 1);
  return out;
}

/**
 * Time spent per pace bin while moving. Pace is seconds per km; bins are `binS` wide. Very slow samples (slower
 * than `slowestS`, walking or standing) are left out.
 * @param {(number | null)[]} velocity
 * @param {number[]} time
 * @param {{ binS?: number, slowestS?: number, fastestS?: number, moving?: boolean[] }} [opts]
 * @returns {{ from: number, to: number, seconds: number }[]}  fastest bin first
 */
export function paceHistogram(velocity, time, { binS = 15, slowestS = 600, fastestS = 150, moving } = {}) {
  const bins = new Map();
  for (let i = 0; i < (velocity?.length ?? 0); i++) {
    const v = velocity[i];
    if (!(v > 0) || (moving && moving[i] === false)) continue;
    const pace = 1000 / v;
    if (pace > slowestS || pace < fastestS) continue;
    let dt = time && i + 1 < time.length ? time[i + 1] - time[i] : 1;
    if (!(dt > 0) || dt > 30) dt = 1;
    const from = Math.floor(pace / binS) * binS;
    bins.set(from, (bins.get(from) ?? 0) + dt);
  }
  return [...bins.entries()].sort((a, b) => a[0] - b[0]).map(([from, seconds]) => ({ from, to: from + binS, seconds }));
}

/**
 * Banister's TRIMP from heart rate: minutes × HR reserve fraction × 0.64·e^(k·fraction), k 1.92 (men) or 1.67 (women).
 * Returns null without a rest and max HR.
 */
export function trimp(heartrate, time, { restHr, maxHr, sex } = {}) {
  if (!heartrate?.length || !(maxHr > restHr) || !(restHr > 0)) return null;
  const k = sex === 'F' ? 1.67 : 1.92;
  let total = 0;
  for (let i = 0; i < heartrate.length; i++) {
    const hr = heartrate[i];
    if (!(hr > 0)) continue;
    let dt = time && i + 1 < time.length ? time[i + 1] - time[i] : 1;
    if (!(dt > 0) || dt > 30) dt = 1;
    const x = Math.max(0, Math.min(1, (hr - restHr) / (maxHr - restHr)));
    total += (dt / 60) * x * 0.64 * Math.exp(k * x);
  }
  return Math.round(total);
}

// ===== Series for the charts =====

/**
 * Indexes that cut `n` samples into at most `target` buckets: [start, end) pairs. The charts and the map share
 * these buckets, so one hover index means the same place in both.
 */
export function buckets(n, target = 1000) {
  const count = Math.max(1, Math.min(n, target));
  const out = [];
  for (let b = 0; b < count; b++) {
    const s = Math.floor((b * n) / count);
    const e = Math.max(s + 1, Math.floor(((b + 1) * n) / count));
    out.push([s, e]);
  }
  return out;
}

/** The mean of each bucket (nulls skipped; an empty bucket gives null), rounded to `digits`. */
export function bucketMean(values, bs, digits = 2) {
  if (!values) return null;
  const f = 10 ** digits;
  return bs.map(([s, e]) => {
    let sum = 0;
    let c = 0;
    for (let i = s; i < e; i++) if (typeof values[i] === 'number') { sum += values[i]; c++; }
    return c ? Math.round((sum / c) * f) / f : null;
  });
}

// ===== Map =====

/** Decodes a Google encoded polyline into [lat, lng] pairs. */
export function decodePolyline(str) {
  const out = [];
  if (!str) return out;
  let i = 0;
  let lat = 0;
  let lng = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let b;
    do {
      b = str.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && i < str.length + 1);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < str.length) {
    lat += next();
    lng += next();
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}

/** Meters between two [lat, lng] points (haversine). */
export function haversine(a, b) {
  const R = 6371e3;
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ===== Best efforts =====

/** Strava's run best-effort distances (meters). */
export const BEST_EFFORT_DISTANCES = [
  { meters: 400, label: '400m' }, { meters: 805, label: '1/2 mile' }, { meters: 1000, label: '1K' },
  { meters: 1609, label: '1 mile' }, { meters: 3219, label: '2 mile' }, { meters: 5000, label: '5K' },
  { meters: 10000, label: '10K' }, { meters: 15000, label: '15K' }, { meters: 16093, label: '10 mile' },
  { meters: 20000, label: '20K' }, { meters: 21097.5, label: 'Half-Marathon' }, { meters: 30000, label: '30K' },
  { meters: 42195, label: 'Marathon' },
];

/**
 * The fastest time over each distance, from the distance and time streams, with the indexes of the stretch.
 * @returns {{ label: string, distance: number, seconds: number, startIndex: number, endIndex: number }[]}
 */
export function bestEffortsFromStreams(distance, time, distances = BEST_EFFORT_DISTANCES) {
  const n = Math.min(distance?.length ?? 0, time?.length ?? 0);
  const out = [];
  if (n < 2) return out;
  for (const { meters, label } of distances) {
    if (distance[n - 1] - distance[0] < meters) continue;
    let best = Infinity;
    let at = null;
    let i = 0;
    for (let j = 1; j < n; j++) {
      const target = distance[j] - meters;
      if (target < distance[0]) continue;
      while (i + 1 < j && distance[i + 1] <= target) i++;
      const d0 = distance[i];
      const d1 = distance[i + 1];
      const frac = d1 > d0 ? Math.min(1, Math.max(0, (target - d0) / (d1 - d0))) : 0;
      const secs = time[j] - (time[i] + frac * (time[i + 1] - time[i]));
      if (secs > 0 && secs < best && meters / secs <= 7) {
        best = secs;
        at = [i, j];
      }
    }
    if (at) out.push({ label, distance: meters, seconds: Math.round(best), startIndex: at[0], endIndex: at[1] });
  }
  return out;
}

/** Power-curve durations (seconds). */
export const CURVE_DURATIONS = [1, 5, 10, 15, 30, 60, 120, 180, 300, 480, 600, 1200, 1800, 2700, 3600, 5400, 7200, 10800];
