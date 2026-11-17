// Paolo's VO2 A run in Zurich, 2026-11-17 (Strava 21018438985): the watch ran the workout, so its laps are the steps
// (the warm-up and the clearance also lapped each km). Laps as Strava gave them; the series is made from the laps
// (one point every 4 s), enough for the adherence tests.

export const LAPS = [
  // [elapsed, moving, distance, speed, hr, maxHr]
  [338, 324, 1000, 3.086, 137, 149],
  [336, 336, 1000, 2.976, 151.3, 156],
  [240, 241, 691.33, 2.869, 150, 156],
  [179, 180, 528.61, 2.937, 152.9, 158],
  [180, 180, 530.31, 2.946, 155.6, 157],
  [180, 180, 622.08, 3.456, 166.3, 171],
  [194, 180, 495.66, 2.754, 154, 171],
  [180, 180, 603.04, 3.35, 166.3, 174],
  [180, 180, 469.05, 2.606, 154.6, 173],
  [180, 180, 605.05, 3.361, 165.4, 172],
  [180, 180, 517.79, 2.877, 159.7, 171],
  [180, 180, 663.17, 3.684, 173.5, 181],
  [180, 180, 518.05, 2.878, 164.4, 180],
  [331, 331, 1000, 3.021, 162.1, 166],
  [335, 335, 1000, 2.985, 161.8, 164],
  [234, 234, 703.24, 3.005, 163.6, 167],
  [305, 301, 906.77, 3.013, 162.8, 167],
];

export function fixture() {
  const t = [];
  const d = [];
  const speed = [];
  const hr = [];
  const laps = [];
  let time = 0;
  let dist = 0;
  let prev = null;
  for (const [i, [elapsed, moving, distance, sp, h, maxHr]] of LAPS.entries()) {
    const startIndex = t.length;
    const n = Math.round(elapsed / 4);
    for (let k = 0; k < n; k++) {
      t.push(time + k * 4);
      d.push(dist + (distance * k) / n);
      speed.push(sp);
      // Heart rate climbs to the lap's max in a lap faster than the one before, and falls from the last lap's max in
      // a slower one (a recovery), with the lap's average.
      const from = prev && sp < prev.sp - 0.2 ? prev.maxHr : 2 * h - maxHr;
      hr.push(Math.round(from + (k / n) * 2 * (h - from)));
    }
    laps.push({ index: i + 1, elapsed, moving, distance, speed: sp, gapSpeed: sp, hr: h, maxHr, watts: null, startIndex, endIndex: t.length - 1 });
    prev = { sp, maxHr };
    time += elapsed;
    dist += distance;
  }
  const series = { full: t.length, bucketStart: t.map((_, i) => i), t, d, speed, gap: speed, hr, watts: null };
  return { series, laps };
}
