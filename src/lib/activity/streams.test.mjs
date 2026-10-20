import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bestEffortsFromStreams, bucketMean, buckets, decodePolyline, gapSpeeds, gradeFactor, haversine, meanBetween,
  paceHistogram, smooth, splitsFromStreams, trimp, zoneIndex, zoneTimes,
} from './streams.mjs';

const range = (n, f = (i) => i) => Array.from({ length: n }, (_, i) => f(i));

test('gradeFactor: flat is 1, uphill costs more, downhill less, and the grade is clamped', () => {
  assert.equal(gradeFactor(0), 1);
  assert.ok(gradeFactor(0.05) > 1.2 && gradeFactor(0.05) < 1.35);
  assert.ok(gradeFactor(-0.05) < 1 && gradeFactor(-0.05) > 0.7);
  assert.equal(gradeFactor(0.9), gradeFactor(0.45));
  assert.equal(gradeFactor(NaN), 1);
});

test('gapSpeeds: flat keeps the speed, uphill is faster on GAP, nulls stay null', () => {
  const g = gapSpeeds([3, 3, null], [0, 5, 0]);
  assert.equal(g[0], 3);
  assert.ok(g[1] > 3);
  assert.equal(g[2], null);
});

test('smooth: a centered time window averages its neighbours and skips nulls', () => {
  const t = range(5);
  assert.deepEqual(smooth([0, 10, null, 10, 0], t, 2), [5, 5, 10, 5, 5]);
  assert.deepEqual(smooth([1, 2, 3], t, 0), [1, 2, 3]);
  assert.deepEqual(smooth([null, null], [0, 1], 4), [null, null]);
});

test('meanBetween: weights by time to the next sample and skips paused samples', () => {
  assert.equal(meanBetween([100, 200], [0, 3]), (100 * 3 + 200 * 1) / 4);
  assert.equal(meanBetween([100, 200, 300], [0, 1, 2], 0, 2, [true, false, true]), 200);
});

test('zoneTimes: seconds per zone, the open top zone, and pauses count 1 s', () => {
  const zones = [{ min: 0, max: 120 }, { min: 120, max: 150 }, { min: 150, max: -1 }];
  assert.deepEqual(zoneTimes([100, 130, 160, 200], [0, 2, 4, 100], zones), { z1: 2, z2: 2, z3: 2 });
  assert.equal(zoneTimes([], [], zones), null);
  assert.equal(zoneIndex(151, zones), 2);
  assert.equal(zoneIndex(150, zones), 1); // an edge value is in the lower zone, as on Strava
  assert.equal(zoneIndex(120, zones), 0);
});

test('splitsFromStreams: 1 km splits at 4 m/s, with a short last split', () => {
  const n = 626; // 2.5 km at 4 m/s
  const s = splitsFromStreams({ distance: range(n, (i) => i * 4), time: range(n), altitude: range(n, (i) => i / 10), heartrate: range(n, () => 150) });
  assert.equal(s.length, 3);
  assert.equal(s[0].distance, 1000);
  assert.equal(s[0].elapsed, 250);
  assert.equal(s[0].moving, 250);
  assert.equal(s[0].hr, 150);
  assert.equal(s[0].elevDiff, 25);
  assert.equal(s[2].distance, 500);
});

test('paceHistogram: time per 15 s bin, slow samples left out', () => {
  const v = [1000 / 300, 1000 / 300, 1000 / 310, 1000 / 900];
  assert.deepEqual(paceHistogram(v, [0, 1, 2, 3]), [{ from: 300, to: 315, seconds: 3 }]);
});

test('trimp: zero at rest, grows with HR, null without zones', () => {
  const t = range(3601);
  assert.equal(trimp(range(3601, () => 50), t, { restHr: 50, maxHr: 190 }), 0);
  const easy = trimp(range(3601, () => 130), t, { restHr: 50, maxHr: 190 });
  const hard = trimp(range(3601, () => 170), t, { restHr: 50, maxHr: 190 });
  assert.ok(easy > 40 && easy < 90, String(easy));
  assert.ok(hard > easy * 1.5);
  assert.equal(trimp([150], [0], {}), null);
});

test('bestEffortsFromStreams: finds the fast stretch and its indexes', () => {
  // 3 km: the middle km at 4 m/s, the rest at 2.5 m/s.
  const d = [0];
  for (let i = 1; d.at(-1) < 3000; i++) d.push(d.at(-1) + (d.at(-1) >= 1000 && d.at(-1) < 2000 ? 4 : 2.5));
  const efforts = bestEffortsFromStreams(d, range(d.length));
  const k = efforts.find((e) => e.label === '1K');
  assert.equal(k.seconds, 250);
  assert.ok(k.startIndex >= 399 && k.endIndex <= 651);
  assert.equal(efforts.find((e) => e.label === '5K'), undefined);
});

test('buckets and bucketMean: equal buckets that cover every sample', () => {
  const bs = buckets(10, 4);
  assert.equal(bs.length, 4);
  assert.equal(bs[0][0], 0);
  assert.equal(bs.at(-1)[1], 10);
  assert.deepEqual(bucketMean([1, 1, 3, 3, null, null, 5, 5, 5, 5], buckets(10, 5)), [1, 3, null, 5, 5]);
  assert.equal(buckets(3, 1000).length, 3);
});

test('decodePolyline and haversine', () => {
  assert.deepEqual(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'), [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]]);
  assert.deepEqual(decodePolyline(''), []);
  const m = haversine([36.05, 138.11], [36.06, 138.11]);
  assert.ok(m > 1100 && m < 1120);
});
