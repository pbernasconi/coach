import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryVitalsRepository, handleVitalsLatest, handleVitalsPush, isCalendarDate, prepareSamples, upsertVitals, validateSample, MAX_SAMPLES } from './sync.mjs';
import { METRIC_IDS } from './metrics.mjs';

const TOKEN = 'test-token-0123456789abcdef';
const CRON = 'cron-secret-0123456789abcdef';
const TOKENS = { lift: TOKEN, cron: CRON };
const AUTH = `Bearer ${TOKEN}`;
const TODAY = '2026-10-19';
const sample = (o = {}) => ({ date: '2026-10-18', metric: 'hrv_sdnn_ms', value: 52.4, unit: 'ms', source: 'Garmin', ...o });
const push = (body, repo, authorization = AUTH) =>
  handleVitalsPush({ authorization, rawBody: typeof body === 'string' ? body : JSON.stringify(body), tokens: TOKENS, today: TODAY }, repo);

test('a wrong, missing or unset token is 401', async () => {
  const repo = createMemoryVitalsRepository();
  assert.equal((await push({ samples: [] }, repo, 'Bearer nope')).status, 401);
  assert.equal((await push({ samples: [] }, repo, null)).status, 401);
  const unset = await handleVitalsPush({ authorization: AUTH, rawBody: '{"samples":[]}', tokens: {} }, repo);
  assert.equal(unset.status, 401);
  assert.equal((await handleVitalsLatest({ authorization: null, since: null, tokens: TOKENS }, repo)).status, 401);
});

test('bad envelopes are 400 or 413', async () => {
  const repo = createMemoryVitalsRepository();
  assert.equal((await push('not json', repo)).status, 400);
  assert.equal((await push({}, repo)).status, 400);
  assert.equal((await push({ samples: {} }, repo)).status, 400);
  assert.equal((await push({ samples: Array.from({ length: MAX_SAMPLES + 1 }, () => sample()) }, repo)).status, 400);
  assert.equal((await push('x'.repeat(1_000_001), repo)).status, 413);
});

test('valid samples are stored and invalid ones rejected by index', async () => {
  const repo = createMemoryVitalsRepository();
  const res = await push(
    {
      samples: [
        sample(),
        sample({ metric: 'weight_kg', value: 500, unit: 'lb' }),
        sample({ metric: 'mood' }),
        sample({ metric: 'spo2_pct', value: 0.97, unit: '%' }),
        sample({ date: '2026-02-30' }),
        sample({ date: '2026-10-21' }),
        sample({ value: Number.NaN }),
        sample({ source: '' }),
        sample({ metric: 'steps', value: 10234, unit: 'count' }),
        'nope',
      ],
    },
    repo
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.accepted, 2);
  assert.deepEqual(res.body.rejected.map((r) => r.index), [1, 2, 3, 4, 5, 6, 7, 9]);
  assert.match(res.body.rejected[0].reason, /out of range for weight_kg/);
  assert.match(res.body.rejected[2].reason, /out of range/);
  assert.equal(repo.rows.size, 2);
});

test('upsert on (date, metric): a re-push and a duplicate in one request keep the last value', async () => {
  const repo = createMemoryVitalsRepository();
  await push({ samples: [sample({ value: 40 })] }, repo);
  const res = await push({ samples: [sample({ value: 41 }), sample({ value: 42 })] }, repo);
  assert.equal(res.body.accepted, 2);
  assert.equal(repo.rows.size, 1);
  assert.equal([...repo.rows.values()][0].value, 42);
});

test('tomorrow is allowed (time zones); the day after is not', () => {
  assert.equal(validateSample(sample({ date: '2026-10-20' }), TODAY).ok, true);
  assert.equal(validateSample(sample({ date: '2026-10-21' }), TODAY).ok, false);
  assert.equal(validateSample(sample({ metric: 'wrist_temp_delta_c', value: -0.3, unit: 'degC' }), TODAY).ok, true);
});

test('GET latestDate lists every metric, honours since and validates it', async () => {
  const repo = createMemoryVitalsRepository();
  await push({ samples: [sample({ date: '2026-10-01' }), sample({ date: '2026-10-17' }), sample({ metric: 'steps', unit: 'count', value: 5, date: '2026-10-02' })] }, repo);
  const all = await handleVitalsLatest({ authorization: AUTH, since: null, tokens: TOKENS }, repo);
  assert.equal(all.status, 200);
  assert.deepEqual(Object.keys(all.body.latestDate).sort(), [...METRIC_IDS].sort());
  assert.equal(all.body.latestDate.hrv_sdnn_ms, '2026-10-17');
  assert.equal(all.body.latestDate.steps, '2026-10-02');
  assert.equal(all.body.latestDate.weight_kg, null);
  const since = await handleVitalsLatest({ authorization: AUTH, since: '2026-10-10', tokens: TOKENS }, repo);
  assert.equal(since.body.latestDate.steps, null);
  assert.equal(since.body.latestDate.hrv_sdnn_ms, '2026-10-17');
  assert.equal((await handleVitalsLatest({ authorization: AUTH, since: '10/10/2026', tokens: TOKENS }, repo)).status, 400);
});

test('isCalendarDate', () => {
  assert.equal(isCalendarDate('2024-02-29'), true);
  assert.equal(isCalendarDate('2025-02-29'), false);
  assert.equal(isCalendarDate('2025-1-01'), false);
  assert.equal(isCalendarDate(20250101), false);
});

test('CRON_SECRET is accepted too; the Lift token alone still works', async () => {
  const repo = createMemoryVitalsRepository();
  const res = await push({ samples: [sample({ metric: 'hrv_night_avg_ms', source: 'garmin' })] }, repo, `Bearer ${CRON}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.accepted, 1);
  const liftOnly = await handleVitalsPush({ authorization: AUTH, rawBody: '{"samples":[]}', tokens: { lift: TOKEN } }, repo);
  assert.equal(liftOnly.status, 200);
  const cronOnly = await handleVitalsPush({ authorization: AUTH, rawBody: '{"samples":[]}', tokens: { cron: CRON } }, repo);
  assert.equal(cronOnly.status, 401);
});

test('Garmin metrics: hrv_status is an integer code 0-4; scores are 0-100', () => {
  const ok = (o) => validateSample(sample({ source: 'garmin', ...o }), TODAY).ok;
  assert.equal(ok({ metric: 'hrv_status', value: 4, unit: 'code' }), true);
  assert.equal(ok({ metric: 'hrv_status', value: 2.5, unit: 'code' }), false);
  assert.equal(ok({ metric: 'hrv_status', value: 5, unit: 'code' }), false);
  assert.equal(ok({ metric: 'body_battery_high', value: 92, unit: 'score' }), true);
  assert.equal(ok({ metric: 'stress_avg', value: -1, unit: 'score' }), false);
  assert.equal(ok({ metric: 'training_readiness', value: 71, unit: 'score' }), true);
  assert.equal(ok({ metric: 'resting_hr_7d_avg_bpm', value: 49, unit: 'bpm' }), true);
});

test('upsertVitals validates, de-duplicates and writes in one statement', async () => {
  const calls = [];
  const sql = (strings, ...values) => {
    calls.push({ text: strings.join('$'), values });
    return Promise.resolve([]);
  };
  const res = await upsertVitals(sql, 'user_x', [sample({ value: 1 }), sample({ value: 2 }), sample({ metric: 'nope' })], { today: TODAY });
  assert.deepEqual(res, { accepted: 2, rejected: [{ index: 2, reason: 'unknown metric' }] });
  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /ON CONFLICT \(user_id, date, metric\)/);
  assert.deepEqual(calls[0].values[3], [2]);
  assert.equal((await upsertVitals(sql, 'user_x', [], { today: TODAY })).accepted, 0);
  assert.equal(calls.length, 1);
  assert.equal(prepareSamples([sample()], TODAY).rows.length, 1);
});

test('units are information only: the Garmin spellings and a missing unit are accepted and stored canonically', () => {
  const v = (o) => validateSample(sample({ source: 'garmin', ...o }), TODAY);
  assert.equal(v({ metric: 'hrv_status', value: 4, unit: 'enum' }).sample.unit, 'code');
  assert.equal(v({ metric: 'respiratory_rate', value: 14, unit: 'brpm' }).sample.unit, 'breaths/min');
  assert.equal(v({ metric: 'vo2max', value: 52, unit: 'ml/kg/min' }).sample.unit, 'mL/kg/min');
  assert.equal(v({ metric: 'sleep_score', value: 80, unit: undefined }).sample.unit, 'score');
  assert.equal(v({ metric: 'steps', value: 9000, unit: 'steps' }).ok, true);
});
