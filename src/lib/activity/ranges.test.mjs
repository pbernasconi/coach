import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bucketAtDistance, bucketOf, rangeOfIndexes, splitRanges } from './ranges.mjs';

// 10 buckets of 10 samples each (100 samples), 10 m per sample: bucket b starts at sample 10b, distance 100b m.
const series = { full: 100, bucketStart: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90], d: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900] };

test('bucketOf: the bucket that holds a stream index', () => {
  assert.equal(bucketOf(0, series.bucketStart), 0);
  assert.equal(bucketOf(9, series.bucketStart), 0);
  assert.equal(bucketOf(10, series.bucketStart), 1);
  assert.equal(bucketOf(99, series.bucketStart), 9);
  assert.equal(bucketOf(5, []), -1);
});

test('rangeOfIndexes: a lap → buckets → distances', () => {
  assert.deepEqual(rangeOfIndexes({ startIndex: 25, endIndex: 54 }, series), { from: 2, to: 5, fromM: 200, toM: 500 });
  // An end past the stream is clamped to the last sample.
  assert.deepEqual(rangeOfIndexes({ startIndex: 90, endIndex: 400 }, series), { from: 9, to: 9, fromM: 900, toM: 900 });
  // Without a distance stream the range has buckets only.
  assert.deepEqual(rangeOfIndexes({ startIndex: 0, endIndex: 19 }, { ...series, d: null }), { from: 0, to: 1, fromM: null, toM: null });
});

test('rangeOfIndexes: null for missing, reversed or outside indexes', () => {
  assert.equal(rangeOfIndexes({ startIndex: null, endIndex: 10 }, series), null);
  assert.equal(rangeOfIndexes({ startIndex: 30, endIndex: 20 }, series), null);
  assert.equal(rangeOfIndexes({ startIndex: 100, endIndex: 120 }, series), null);
  assert.equal(rangeOfIndexes({ startIndex: 0, endIndex: 5 }, null), null);
});

test('splitRanges: consecutive splits by distance', () => {
  const r = splitRanges([{ distance: 300 }, { distance: 300 }, { distance: 250 }], series);
  assert.deepEqual(r, [
    { from: 0, to: 3, fromM: 0, toM: 300 },
    { from: 3, to: 6, fromM: 300, toM: 600 },
    { from: 6, to: 9, fromM: 600, toM: 850 },
  ]);
  assert.deepEqual(splitRanges([{ distance: 100 }], { d: null }), [null]);
  assert.deepEqual(splitRanges([{ distance: 0 }], series), [null]);
});

test('bucketAtDistance: skips nulls, ends at the last bucket', () => {
  assert.equal(bucketAtDistance(150, [null, 100, 200]), 2);
  assert.equal(bucketAtDistance(5000, series.d), 9);
});
