import { test } from 'node:test';
import assert from 'node:assert/strict';
import { peakCurve } from './peaks.mjs';

// Synthetic streams only.
const seconds = (n, step = 1) => Array.from({ length: n }, (_, i) => i * step);

test('peakCurve finds the best average for each duration', () => {
  const t = seconds(601);
  const hr = t.map((s) => (s >= 100 && s < 160 ? 180 : 140)); // one hard minute
  const curve = peakCurve(t, hr, [5, 60, 300]);
  assert.deepEqual(curve.map((p) => p.seconds), [5, 60, 300]);
  assert.equal(curve[0].value, 180);
  assert.equal(curve[1].value, 180);
  assert.equal(Math.round(curve[2].value), 148); // 60 s at 180 and 240 s at 140
});

test('peakCurve leaves out durations that are too short for the points or longer than the activity', () => {
  const t = seconds(61, 10); // a point every 10 s, 600 s in all
  const curve = peakCurve(t, t.map(() => 150), [5, 10, 20, 300, 900]);
  assert.deepEqual(curve.map((p) => p.seconds), [20, 300]);
});

test('peakCurve skips windows that are mostly gaps', () => {
  const t = seconds(121);
  const v = t.map((s) => (s < 60 ? null : 100));
  const curve = peakCurve(t, v, [30, 90]);
  assert.equal(curve[0].value, 100);
  assert.equal(curve.length, 1); // no 90 s window is 90 % valid
  assert.deepEqual(peakCurve(t, null), []);
});
