// Peak curves: the best average of a stream (heart rate, speed, power) for each duration, like the TrainingPeaks
// "Peak heart rate" and "Peak pace" charts. No framework imports, so node --test can run it (peaks.test.mjs).

/** The durations (s) on a peak curve. */
export const PEAK_DURATIONS = [5, 10, 20, 30, 60, 120, 300, 600, 1200, 1800, 3600, 5400, 7200];

/**
 * The best time-weighted average of `values` over each duration. A point's value holds until the next point, so a
 * stream with points every few seconds (or a downsampled one) gives the right average. A window with gaps (null
 * values) over 10 % of its time does not count. A duration shorter than two point gaps (too coarse to trust) or
 * longer than the activity is left out.
 * @param {number[]} t seconds from the start, ascending
 * @param {(number | null)[] | null | undefined} values
 * @param {number[]} [durations]
 * @returns {{ seconds: number, value: number }[]}
 */
export function peakCurve(t, values, durations = PEAK_DURATIONS) {
  if (!values || t.length < 2 || values.length !== t.length) return [];
  const n = t.length;
  // Prefix sums of value × time and of valid time, over the segments [t[i], t[i+1]).
  const sumV = new Float64Array(n);
  const sumT = new Float64Array(n);
  const gaps = [];
  for (let i = 0; i < n - 1; i++) {
    const dt = Math.max(0, t[i + 1] - t[i]);
    const v = values[i];
    const ok = v != null && Number.isFinite(v);
    sumV[i + 1] = sumV[i] + (ok ? v * dt : 0);
    sumT[i + 1] = sumT[i] + (ok ? dt : 0);
    if (dt > 0) gaps.push(dt);
  }
  gaps.sort((a, b) => a - b);
  const step = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 1;
  const total = t[n - 1] - t[0];
  const out = [];
  for (const d of durations) {
    if (d < 2 * step || d > total) continue;
    let best = -Infinity;
    let j = 0;
    for (let i = 0; i < n - 1; i++) {
      if (j < i) j = i;
      while (j < n - 1 && t[j] - t[i] < d) j++;
      if (t[j] - t[i] < d) break;
      const span = t[j] - t[i];
      const valid = sumT[j] - sumT[i];
      if (valid < 0.9 * span) continue;
      const mean = (sumV[j] - sumV[i]) / valid;
      if (mean > best) best = mean;
    }
    if (best > -Infinity) out.push({ seconds: d, value: best });
  }
  return out;
}
