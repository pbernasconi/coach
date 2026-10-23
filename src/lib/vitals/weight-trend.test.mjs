import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalSwing, offTrendText, rateView, trendRate, weightTrend, withTrend } from './weight-trend.mjs';

const day = (n) => new Date(Date.UTC(2026, 8, 1) + n * 864e5).toISOString().slice(0, 10);

test('the trend starts at the first reading and closes 10% of the gap a day', () => {
  const p = withTrend([{ date: day(0), value: 84 }, { date: day(1), value: 83 }]);
  assert.equal(p[0].trend, 84);
  assert.ok(Math.abs(p[1].trend - 83.9) < 1e-9);
});

test('a gap of several days moves the trend as far as that many daily steps', () => {
  const gap = withTrend([{ date: day(0), value: 84 }, { date: day(3), value: 83 }]);
  // 1 - 0.9^3 = 0.271 of the way
  assert.ok(Math.abs(gap[1].trend - (84 - 0.271)) < 1e-9);
});

test('a steady loss of 0.05 kg a day reads as about 0.35 kg a week', () => {
  const readings = Array.from({ length: 60 }, (_, i) => ({ date: day(i), value: 85 - 0.05 * i }));
  const rate = trendRate(withTrend(readings));
  assert.ok(rate !== null && rate < -0.3 && rate > -0.36, String(rate));
});

test('no rate with less than a week of readings', () => {
  assert.equal(trendRate(withTrend([{ date: day(0), value: 84 }, { date: day(5), value: 83 }])), null);
  assert.equal(trendRate([]), null);
});

test('the swing is at least 0.3 kg and needs 5 readings', () => {
  const flat = withTrend(Array.from({ length: 10 }, (_, i) => ({ date: day(i), value: 84 })));
  assert.equal(normalSwing(flat), 0.3);
  assert.equal(normalSwing(flat.slice(0, 4)), null);
  const noisy = withTrend(Array.from({ length: 28 }, (_, i) => ({ date: day(i), value: 84 + (i % 2 ? 1 : -1) })));
  assert.ok((normalSwing(noisy) ?? 0) >= 0.9);
});

test('rate text: down is good, up is bad, under 0.05 is flat', () => {
  assert.deepEqual(rateView(-0.264), { kgPerWeek: -0.26, text: '▼ 0.26 kg/wk', tone: 'good' });
  assert.deepEqual(rateView(0.31), { kgPerWeek: 0.31, text: '▲ 0.31 kg/wk', tone: 'bad' });
  assert.deepEqual(rateView(0.02), { kgPerWeek: 0.02, text: '± 0.02 kg/wk', tone: 'neutral' });
  assert.equal(rateView(null), null);
});

test('the sentence under the chart', () => {
  assert.equal(offTrendText(0.02, 0.6), 'Today is right on your trend.');
  assert.match(offTrendText(-0.4, 0.6), /^Today is 0\.4 kg under your trend, inside your normal ±0\.6 kg/);
  assert.match(offTrendText(1.1, 0.6), /^Today is 1\.1 kg over your trend, more than your usual ±0\.6 kg swing\. Salt/);
  assert.match(offTrendText(-1.1, 0.6), /Expect some of it back tomorrow/);
  assert.match(offTrendText(0.5, null), /one reading only nudges it/);
});

test('weightTrend: the trend, rate and sentence as of the last reading; a single reading has no sentence', () => {
  const readings = Array.from({ length: 30 }, (_, i) => ({ date: day(i), value: 84 - 0.04 * i }));
  readings.push({ date: day(30), value: 82.4 });
  const w = weightTrend(readings);
  assert.equal(w?.points.length, 31);
  assert.equal(w?.rate?.tone, 'good');
  assert.ok((w?.offKg ?? 0) < 0);
  assert.match(w?.noteText ?? '', /under your trend/);
  const one = weightTrend([{ date: day(0), value: 83 }]);
  assert.equal(one?.text, '83.0');
  assert.equal(one?.rate, null);
  assert.equal(one?.noteText, null);
  assert.equal(weightTrend([]), null);
});
