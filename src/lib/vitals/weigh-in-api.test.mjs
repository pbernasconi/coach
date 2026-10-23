import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayTitle, kgChange, weighInResponse } from './weigh-in-api.mjs';

const base = {
  date: '2026-10-22',
  weights: [
    { date: '2026-09-22', value: 84.6 },
    { date: '2026-10-21', value: 83.5 },
    { date: '2026-10-22', value: 83.2 },
  ],
  bodyFat: 18.44,
  previous: { date: '2026-10-21', value: 83.5 },
  source: 'renpho',
  recordedAt: '2026-10-22T14:05:00.000Z',
  newer: null,
  older: '2026-10-21',
};

test('a day with a weight: the weight, body fat, the change since the last weigh-in and over 4 weeks', () => {
  const r = weighInResponse(base);
  assert.equal(r.dateText, 'Thursday, Oct 22');
  assert.deepEqual(r.weight, { kg: 83.2, text: '83.2', unit: 'kg' });
  assert.deepEqual(r.bodyFat, { pct: 18.4, text: '18.4 %' });
  assert.deepEqual(
    r.changes.map((c) => [c.id, c.label, c.text, c.tone]),
    [
      ['previous', 'Since yesterday', '▼ 0.3 kg', 'good'],
      ['4w', '4 weeks', '▼ 1.4 kg', 'good'],
    ]
  );
  assert.equal(r.changes[0].noteText, '83.5 kg on Oct 21');
  assert.deepEqual(r.series.at(-1), { date: '2026-10-22', kg: 83.2, trendKg: 83.52 });
  assert.deepEqual(r.trend, {
    kg: 83.52,
    text: '83.5',
    rate: null,
    offKg: -0.3,
    swingKg: null,
    noteText: 'Today is 0.3 kg under your trend. The trend moves slowly, so one reading only nudges it.',
  });
  assert.equal(r.olderDate, '2026-10-21');
  assert.equal(r.newerDate, null);
});

test('the first weigh-in has no changes; a day without a weight is null', () => {
  const first = weighInResponse({ ...base, weights: [base.weights[2]], previous: null, older: null, bodyFat: null });
  assert.deepEqual(first.changes, []);
  assert.equal(first.bodyFat, null);
  assert.equal(first.trend.text, '83.2');
  assert.equal(first.trend.noteText, null);
  assert.equal(weighInResponse({ ...base, date: '2026-10-20' }), null);
});

test('a gain is bad, no change is neutral; older weigh-ins are labelled by day', () => {
  assert.deepEqual(kgChange(0.26), { kg: 0.3, text: '▲ 0.3 kg', tone: 'bad' });
  assert.deepEqual(kgChange(0.01), { kg: 0, text: '± 0.0 kg', tone: 'neutral' });
  const r = weighInResponse({ ...base, previous: { date: '2026-10-18', value: 83.0 } });
  assert.equal(r.changes[0].label, 'Since Oct 18');
  assert.equal(dayTitle('2026-01-01'), 'Thursday, Jan 1');
});

test('the series is the last 12 weeks; older readings only settle the trend', () => {
  const r = weighInResponse({ ...base, weights: [{ date: '2026-07-01', value: 90 }, ...base.weights] });
  assert.equal(r.series[0].date, '2026-09-22');
  assert.equal(r.series.length, 3);
});
