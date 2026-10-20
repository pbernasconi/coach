// Ranges of an activity (a lap, a split, a segment, a best effort) on the chart series, so the page can highlight
// one on the stream charts and the map. The series is the stream cut into buckets (queries.ts `Series`):
// `bucketStart[b]` is the first full-resolution index of bucket b, and `d[b]` its distance in meters.
// No framework or database imports, so node --test can run it (ranges.test.mjs).

/**
 * The bucket that holds a full-resolution stream index: the last bucket whose start is at or before it.
 * @param {number} index
 * @param {number[]} bucketStart  rising
 */
export function bucketOf(index, bucketStart) {
  let lo = 0;
  let hi = bucketStart.length - 1;
  if (hi < 0) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (bucketStart[mid] <= index) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** The first bucket at or past a distance (meters), or the last bucket. Nulls in `d` are skipped. */
export function bucketAtDistance(meters, d) {
  for (let b = 0; b < d.length; b++) if (typeof d[b] === 'number' && d[b] >= meters) return b;
  return d.length - 1;
}

/**
 * A range from stream indexes: buckets `from`–`to` (inclusive) and the distance at both ends (meters, or null
 * without a distance stream). Null when the indexes are missing or outside the stream.
 * @param {{ startIndex: number | null, endIndex: number | null }} item
 * @param {{ full: number, bucketStart: number[], d: (number | null)[] | null }} series
 * @returns {{ from: number, to: number, fromM: number | null, toM: number | null } | null}
 */
export function rangeOfIndexes(item, series) {
  const { startIndex: s, endIndex: e } = item;
  if (!series?.bucketStart?.length || s == null || e == null || !(e >= s) || s >= series.full) return null;
  const from = bucketOf(s, series.bucketStart);
  const to = bucketOf(Math.min(e, series.full - 1), series.bucketStart);
  return { from, to, fromM: series.d?.[from] ?? null, toM: series.d?.[to] ?? null };
}

/**
 * Ranges of consecutive splits from their distances (Strava's splits have no stream indexes): split k covers the
 * distance from the sum of the splits before it to that sum plus its own distance.
 * @param {{ distance: number }[]} splits
 * @param {{ d: (number | null)[] | null }} series
 * @returns {({ from: number, to: number, fromM: number, toM: number } | null)[]}
 */
export function splitRanges(splits, series) {
  const d = series?.d;
  if (!d?.length) return splits.map(() => null);
  const start = d.find((v) => typeof v === 'number') ?? 0;
  let at = start;
  return splits.map((s) => {
    const fromM = at;
    const toM = at + (s.distance || 0);
    at = toM;
    if (!(toM > fromM)) return null;
    return { from: bucketAtDistance(fromM, d), to: bucketAtDistance(toM, d), fromM, toM };
  });
}
