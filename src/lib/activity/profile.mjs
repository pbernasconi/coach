// The route profile under the map (RouteProfile.tsx): elevation with pace over distance, and the values at the point
// under the cursor (time, distance, elevation, grade, pace, heart rate), as Strava shows them. No framework imports.

import { duration, pace } from './format.mjs';
import { smooth } from './streams.mjs';

/** Grade over this many metres around the point (Strava's grade is smoothed the same way). */
const GRADE_SPAN_M = 100;

/**
 * Grade in percent at index i: elevation change over the distance from GRADE_SPAN_M/2 before to after the point.
 * @param {(number | null)[]} alt
 * @param {(number | null)[]} d metres
 * @param {number} i
 */
export function gradeAt(alt, d, i) {
  const di = d[i];
  if (typeof di !== 'number') return null;
  let a = i;
  let b = i;
  while (a > 0 && typeof d[a - 1] === 'number' && di - /** @type {number} */ (d[a - 1]) <= GRADE_SPAN_M / 2) a--;
  while (b < d.length - 1 && typeof d[b + 1] === 'number' && /** @type {number} */ (d[b + 1]) - di <= GRADE_SPAN_M / 2) b++;
  const run = /** @type {number} */ (d[b]) - /** @type {number} */ (d[a]);
  const rise = typeof alt[b] === 'number' && typeof alt[a] === 'number' ? /** @type {number} */ (alt[b]) - /** @type {number} */ (alt[a]) : null;
  if (rise == null || run < 10) return null;
  return (rise / run) * 100;
}

/**
 * The series the profile draws: smoothed speed (30 s) beside the raw elevation. Pace for foot sports, speed else.
 * `minSpeed` (m/s): slower points are stops, null in the result.
 * @param {{ t: number[], d: (number|null)[] | null, alt: (number|null)[] | null, speed: (number|null)[] | null, hr: (number|null)[] | null }} s
 */
export function profileSeries(s, minSpeed = 0) {
  if (!s.speed) return { speed: null };
  // Stops (slower than minSpeed) are left out of the average and stay gaps, so the line breaks instead of diving.
  const moving = s.speed.map((v) => (typeof v === 'number' && v >= minSpeed ? v : null));
  const sm = smooth(moving, s.t, 30);
  return { speed: sm.map((v, i) => (moving[i] == null ? null : v)) };
}

/**
 * The tooltip at index i: a title (elapsed time) and rows ({ key, label, value }).
 * @param {{ t: number[], d: (number|null)[] | null, alt: (number|null)[] | null, hr: (number|null)[] | null }} s
 * @param {(number|null)[] | null} speed smoothed speed (m/s)
 * @param {number} i
 * @param {boolean} foot pace (/km) or speed (km/h)
 */
export function profileAt(s, speed, i, foot) {
  const rows = [];
  const d = s.d?.[i];
  if (typeof d === 'number') rows.push({ key: 'dist', label: 'Distance', value: `${(d / 1000).toFixed(2)} km` });
  const a = s.alt?.[i];
  if (typeof a === 'number') rows.push({ key: 'elev', label: 'Elevation', value: `${Math.round(a)} m` });
  const g = s.alt && s.d ? gradeAt(s.alt, s.d, i) : null;
  if (g != null) rows.push({ key: 'grade', label: 'Grade', value: `${(Math.round(g * 10) / 10).toFixed(1)}%` });
  const v = speed?.[i];
  if (typeof v === 'number' && v > 0.5) rows.push({ key: 'pace', label: foot ? 'Pace' : 'Speed', value: foot ? `${pace(v)} /km` : `${(v * 3.6).toFixed(1)} km/h` });
  const hr = s.hr?.[i];
  if (typeof hr === 'number') rows.push({ key: 'hr', label: 'Heart rate', value: `${Math.round(hr)} bpm` });
  return { title: duration(s.t[i] - s.t[0]), rows };
}
