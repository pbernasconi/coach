import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillGaps, gradeBin, gradeSeries, HEAT, routeColors, routePieces, scaleBins } from './route-colors.mjs';

// A 600 s run: 3 m/s, then 4 m/s; heart rate climbing 120 → 179; up a 5 % hill and back down.
const n = 600;
const t = Array.from({ length: n }, (_, i) => i);
const speed = t.map((i) => (i < 300 ? 3 : 4));
const d = [];
speed.reduce((acc, v, i) => ((d[i] = acc), acc + v), 0);
const alt = d.map((x, i) => (i < 300 ? 10 + x * 0.05 : 10 + d[299] * 0.05 - (x - d[299]) * 0.05));
const series = {
  t, d, alt, speed, gap: speed, hr: t.map((i) => 120 + Math.floor(i / 10)), cad: t.map(() => 170), watts: null,
  lat: t.map((i) => 37.8 + i * 1e-5), lng: t.map((i) => -122.4 + i * 1e-5),
};
const hrZones = [{ min: 0, max: 130 }, { min: 130, max: 145 }, { min: 145, max: 160 }, { min: 160, max: 170 }, { min: 170, max: -1 }];

test('scaleBins: 5th to 95th percentile, clamped, gaps stay null', () => {
  const v = Array.from({ length: 101 }, (_, i) => i);
  const s = scaleBins([...v, null], 9);
  assert.equal(s.lo, 5);
  assert.equal(s.hi, 95);
  assert.equal(s.bins[0], 0);
  assert.equal(s.bins[100], 8);
  assert.equal(s.bins[101], null);
  assert.deepEqual(scaleBins([5, 5, 5], 9).bins, [4, 4, 4]);
  assert.equal(scaleBins([null], 9), null);
});

test('fillGaps: carries the bin before a gap, the first gaps take the bin after', () => {
  assert.deepEqual(fillGaps([null, 2, null, null, 5, null]), [2, 2, 2, 2, 5, 5]);
});

test('gradeBin and gradeSeries', () => {
  assert.equal(gradeBin(-10), 0);
  assert.equal(gradeBin(0), 3);
  assert.equal(gradeBin(5), 5);
  assert.equal(gradeBin(12), 6);
  assert.equal(gradeBin(null), null);
  const g = gradeSeries(alt, d);
  assert.equal(Math.round(g[100]), 5);
  assert.equal(Math.round(g[500]), -5);
});

test('routeColors: a run has pace, GAP, heart rate, zones, elevation, grade and cadence', () => {
  const r = routeColors(series, { foot: true, hrZones, points: 200 });
  assert.equal(r.points.length, 200);
  assert.deepEqual(r.metrics.map((m) => m.key), ['pace', 'gap', 'hr', 'hrZones', 'elevation', 'grade', 'cadence']);
  for (const m of r.metrics) assert.equal(m.bins.length, 200, m.key);
  const pace = r.metrics.find((m) => m.key === 'pace');
  // Faster is warmer: the 4 m/s half sits higher on the scale.
  assert.ok(pace.bins[190] > pace.bins[10]);
  assert.equal(pace.colors, HEAT);
  assert.equal(pace.lowText, '5:33');
  assert.equal(pace.highText, '4:10');
  const zones = r.metrics.find((m) => m.key === 'hrZones');
  assert.equal(zones.colors.length, 5);
  assert.equal(zones.bins[0], 0);
  assert.equal(zones.bins[199], 4);
  const grade = r.metrics.find((m) => m.key === 'grade');
  assert.equal(grade.bins[50], 5);
  assert.equal(grade.bins[150], 1);
});

test('routeColors: a ride has speed, no GAP; no power without a meter; null without a route', () => {
  const r = routeColors({ ...series, watts: t.map(() => 0) }, { foot: false });
  assert.equal(r.points.length, n);
  assert.deepEqual(r.metrics.map((m) => m.key), ['speed', 'hr', 'elevation', 'grade', 'cadence']);
  assert.equal(r.metrics[0].highText, '14.4');
  const p = routeColors({ ...series, watts: t.map((i) => 150 + i) }, { foot: false, powerZones: hrZones });
  assert.ok(p.metrics.some((m) => m.key === 'power'));
  assert.ok(p.metrics.some((m) => m.key === 'powerZones'));
  assert.equal(routeColors({ ...series, lat: null }, { foot: true }), null);
});

test('routePieces: one piece per run of a bin, joined end to start', () => {
  const pieces = routePieces(['a', 'b', 'c', 'd', 'e'], [1, 1, 2, 2, 1]);
  assert.deepEqual(pieces, [
    { bin: 1, points: ['a', 'b'] },
    { bin: 2, points: ['b', 'c', 'd'] },
    { bin: 1, points: ['d', 'e'] },
  ]);
});
