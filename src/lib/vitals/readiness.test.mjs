import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, fmtDuration, readinessFrom } from './readiness.mjs';

const TODAY = '2026-10-19';
/** Daily rows of one metric for `days` days ending `end`, value from f(i) where i=0 is the oldest. */
function daily(metric, days, f, end = TODAY) {
  return Array.from({ length: days }, (_, i) => ({ date: addDays(end, -(days - 1 - i)), metric, value: f(i) }));
}

test('no data is unknown', () => {
  const r = readinessFrom([], TODAY);
  assert.equal(r.status, 'unknown');
  assert.equal(r.hrv, null);
  assert.equal(r.sleep, null);
});

test('steady HRV and resting HR with a good night is good', () => {
  const rows = [
    ...daily('hrv_sdnn_ms', 67, (i) => 50 + (i % 3)),
    ...daily('resting_hr_bpm', 67, (i) => 50 + (i % 2)),
    { date: TODAY, metric: 'sleep_total_min', value: 450 },
    { date: TODAY, metric: 'sleep_deep_min', value: 70 },
  ];
  const r = readinessFrom(rows, TODAY);
  assert.equal(r.status, 'good');
  assert.equal(r.hrv.status, 'normal');
  assert.equal(r.restingHr.status, 'normal');
  assert.equal(r.sleep.deepMin, 70);
  assert.equal(r.sleep.remMin, null);
});

test('low HRV, high resting HR and short sleep are flagged; readiness is low', () => {
  const rows = [
    ...daily('hrv_sdnn_ms', 67, (i) => (i >= 60 ? 35 : 50 + (i % 3))),
    ...daily('resting_hr_bpm', 67, (i) => (i >= 60 ? 58 : 50 + (i % 2))),
    { date: addDays(TODAY, -1), metric: 'sleep_total_min', value: 320 },
  ];
  const r = readinessFrom(rows, TODAY);
  assert.equal(r.hrv.status, 'below');
  assert.equal(r.restingHr.status, 'elevated');
  assert.equal(r.sleep.status, 'short');
  assert.equal(r.flags.length, 3);
  assert.equal(r.status, 'low');
});

test('a short baseline gives no status; an old night is not last night', () => {
  const rows = [...daily('hrv_sdnn_ms', 10, () => 50), { date: addDays(TODAY, -3), metric: 'sleep_total_min', value: 400 }];
  const r = readinessFrom(rows, TODAY);
  assert.equal(r.hrv.status, 'no baseline');
  assert.equal(r.hrv.baseline, null);
  assert.equal(r.sleep, null);
  assert.equal(r.status, 'unknown');
});

test('weight change over four weeks', () => {
  const rows = daily('weight_kg', 36, (i) => 80 - i * 0.05);
  const r = readinessFrom(rows, TODAY);
  assert.equal(r.weight.latestDate, TODAY);
  assert.ok(r.weight.change28 < -1.3 && r.weight.change28 > -1.5);
});

test('fmtDuration', () => {
  assert.equal(fmtDuration(412), '6 h 52 min');
  assert.equal(fmtDuration(60), '1 h 00 min');
});

test('Garmin RMSSD is used when present, SDNN otherwise; the measures are not mixed', () => {
  const sdnn = daily('hrv_sdnn_ms', 67, () => 30);
  assert.equal(readinessFrom(sdnn, TODAY).hrv.measure, 'SDNN');
  const both = [...sdnn, ...daily('hrv_night_avg_ms', 67, (i) => 60 + (i % 3))];
  const r = readinessFrom(both, TODAY);
  assert.equal(r.hrv.measure, 'RMSSD');
  assert.equal(r.hrv.metric, 'hrv_night_avg_ms');
  assert.ok(r.hrv.avg7 > 59);
});

test('Garmin scores come from today or yesterday', () => {
  const rows = [
    { date: TODAY, metric: 'sleep_score', value: 82 },
    { date: TODAY, metric: 'body_battery_high', value: 90 },
    { date: addDays(TODAY, -1), metric: 'body_battery_low', value: 15 },
    { date: addDays(TODAY, -1), metric: 'training_readiness', value: 64 },
    { date: addDays(TODAY, -3), metric: 'hrv_status', value: 4 },
    { date: TODAY, metric: 'hrv_weekly_avg_ms', value: 58 },
  ];
  const g = readinessFrom(rows, TODAY).garmin;
  assert.deepEqual(g.sleepScore, { date: TODAY, value: 82 });
  assert.deepEqual(g.bodyBattery, { date: TODAY, high: 90, low: null });
  assert.equal(g.trainingReadiness.value, 64);
  assert.equal(g.hrvStatus, null);
  assert.equal(g.hrvWeeklyAvg.value, 58);
  const s = readinessFrom([{ date: TODAY, metric: 'hrv_status', value: 3 }], TODAY).garmin.hrvStatus;
  assert.deepEqual(s, { date: TODAY, code: 3, label: 'unbalanced' });
});
