import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseActivityPush, watchStats, watchValues } from './watch.mjs';

test('parseActivityPush: keeps valid activities, rejects bad ones', () => {
  const r = parseActivityPush({
    activities: [
      { id: '111', startUtc: '2026-10-22T18:45:12Z', type: 'running', summary: { a: 1 }, detail: null, series: { t: [0] } },
      { id: 'abc', startUtc: '2026-10-22T18:45:12Z' },
      { id: '112', startUtc: 'yesterday' },
      { id: '113', startUtc: '2026-10-22T18:45:12Z', summary: { s: 'a\u0000b' } },
    ],
  });
  assert.ok(!('error' in r));
  assert.deepEqual(r.rows, [{ id: '111', startUtc: '2026-10-22T18:45:12.000Z', type: 'running', summary: '{"a":1}', detail: null, series: '{"t":[0]}' }]);
  assert.deepEqual(r.rejected.map((x) => x.index), [1, 2, 3]);
  assert.deepEqual(parseActivityPush({}), { error: 'activities must be an array' });
});

test('watchValues: flat list names first, then the summary page, stride in metres', () => {
  const w = watchValues({
    garmin_activity_id: '111',
    summary: { aerobicTrainingEffect: 3.24, anaerobicTrainingEffect: 1.06, trainingEffectLabel: 'LACTATE_THRESHOLD', activityTrainingLoad: 142.7, avgStrideLength: 112.4 },
    detail: { summaryDTO: { groundContactTime: 248.3, verticalRatio: 7.84, beginPotentialStamina: 100, endPotentialStamina: 71, differenceBodyBattery: -14 } },
    series: { t: [0, 300, 400, 500], directPerformanceCondition: [null, 1, 3, 2] },
  });
  assert.equal(w?.aerobicTe, 3.24);
  assert.equal(w?.teLabel, 'Lactate threshold');
  assert.equal(w?.gctMs, 248.3);
  assert.equal(w?.strideM, 1.124);
  assert.equal(w?.performanceCondition, 3, 'the first value after 6 minutes');
  assert.equal(watchValues(null), null);
  assert.equal(watchValues({ summary: {}, detail: null, series: null }), null, 'nothing useful');
});

test('watchStats: running dynamics for runs only; power only when Strava has none', () => {
  const w = watchValues({ summary: { aerobicTrainingEffect: 3.2, anaerobicTrainingEffect: 1, avgGroundContactTime: 250, avgPower: 300, differenceBodyBattery: -9 } });
  const run = watchStats(w, { foot: true, stravaPower: true });
  assert.deepEqual(run.map((r) => r.label), ['Training Effect', 'Ground Contact', 'Body Battery Used']);
  assert.equal(run[0].valueText, '3.2 / 1.0');
  assert.equal(run[2].valueText, '9');
  const ride = watchStats(w, { foot: false, stravaPower: false });
  assert.deepEqual(ride.map((r) => r.label), ['Training Effect', 'Avg Power', 'Body Battery Used']);
});
