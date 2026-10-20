import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gmtMs, offsetOf, parseBodyBattery, parseBodyBatteryEvents, parseDay, parseHeartRates, parseHrv, parseReadiness, parseSleep, parseStress, parseSummary, stageMinutes } from './garmin-day.mjs';

const fixture = (name) => JSON.parse(readFileSync(new URL(`../../../scripts/garmin/fixtures/${name}.json`, import.meta.url), 'utf8'));
const H = 3600_000;
const T0 = Date.UTC(2026, 9, 18, 6, 0); // 2026-10-18 06:00 GMT = 23:00 local (UTC-7) on the 17th

test('times: ms numbers and GMT text without a zone; offsets round to 15 minutes', () => {
  assert.equal(gmtMs(1760767560000), 1760767560000);
  assert.equal(gmtMs('2026-10-18T06:12:36.0'), Date.UTC(2026, 9, 18, 6, 12, 36));
  assert.equal(gmtMs('nope'), null);
  assert.equal(offsetOf('2026-10-17T23:06:00.0', '2026-10-18T06:06:00.0'), -7 * H);
  assert.equal(offsetOf(null, '2026-10-18T06:06:00.0'), 0);
});

test('sleep: the fixture without the timelines still gives totals and the score', () => {
  // Expected values come from the fixture itself: the fixtures are synthetic and their numbers may change.
  const f = fixture('sleep');
  const dto = f.dailySleepDTO;
  const s = parseSleep(f);
  assert.equal(s.totalMin, dto.sleepTimeSeconds / 60);
  assert.equal(s.deepMin, dto.deepSleepSeconds / 60);
  assert.equal(s.score, dto.sleepScores.overall.value);
  assert.equal(s.quality, dto.sleepScores.overall.qualifierKey);
  assert.equal(s.avgSpo2, dto.averageSpO2Value);
  assert.equal(s.restingHr, f.restingHeartRate);
  assert.equal(s.start, dto.sleepStartTimestampLocal);
  assert.deepEqual(s.stages, []);
  assert.deepEqual(stageMinutes(s), { deep: dto.deepSleepSeconds / 60, light: dto.lightSleepSeconds / 60, rem: dto.remSleepSeconds / 60, awake: dto.awakeSleepSeconds / 60 });
});

test('sleep: an empty night is null; junk is null', () => {
  assert.equal(parseSleep(fixture('sleep_none')), null);
  assert.equal(parseSleep(null), null);
  assert.equal(parseSleep({ dailySleepDTO: 'x' }), null);
  assert.equal(parseSleep([]), null);
});

test('sleep: stages, heart rate, stress, SpO2 in local time; bad rows dropped', () => {
  const s = parseSleep({
    dailySleepDTO: { sleepStartTimestampGMT: T0, sleepEndTimestampGMT: T0 + 7 * H, sleepStartTimestampLocal: T0 - 7 * H, sleepTimeSeconds: 25200 },
    sleepLevels: [
      { startGMT: '2026-10-18T07:00:00.0', endGMT: '2026-10-18T08:00:00.0', activityLevel: 0.0 },
      { startGMT: '2026-10-18T06:00:00.0', endGMT: '2026-10-18T07:00:00.0', activityLevel: 1.0 },
      { startGMT: '2026-10-18T08:00:00.0', endGMT: '2026-10-18T08:30:00.0', activityLevel: 2 },
      { startGMT: '2026-10-18T08:30:00.0', endGMT: '2026-10-18T08:35:00.0', activityLevel: 3 },
      { startGMT: '2026-10-18T09:00:00.0', endGMT: '2026-10-18T08:00:00.0', activityLevel: 1 },
      { startGMT: '2026-10-18T09:00:00.0', endGMT: '2026-10-18T10:00:00.0', activityLevel: 9 },
      'junk',
    ],
    sleepHeartRate: [{ value: 52, startGMT: T0 }, { value: null, startGMT: T0 + 60_000 }],
    sleepStress: [{ value: 12, startGMT: T0 }, { value: -1, startGMT: T0 + 60_000 }],
    wellnessEpochSPO2DataDTOList: [{ epochTimestamp: '2026-10-18T06:01:00.0', spo2Reading: 95 }],
  });
  assert.deepEqual(s.stages.map((x) => x.stage), ['light', 'deep', 'rem', 'awake']);
  assert.equal(s.stages[0].start, T0 - 7 * H);
  assert.deepEqual(s.hr, [{ t: T0 - 7 * H, v: 52 }]);
  assert.equal(s.stress.length, 1);
  assert.equal(s.spo2[0].v, 95);
  assert.equal(stageMinutes({ stages: s.stages }).deep, 60);
});

test('heart rates and stress use their descriptors; -1/-2 stress is dropped', () => {
  const hr = parseHeartRates({
    startTimestampGMT: '2026-10-18T07:00:00.0', startTimestampLocal: '2026-10-18T00:00:00.0', restingHeartRate: 48,
    heartRateValueDescriptors: [{ key: 'timestamp', index: 0 }, { key: 'heartrate', index: 1 }],
    heartRateValues: [[T0 + H, 60], [T0 + 2 * H, null], 'x', [T0, 55]],
  });
  assert.equal(hr.resting, 48);
  assert.deepEqual(hr.values.map((p) => p.v), [55, 60]);
  assert.equal(hr.values[0].t, T0 - 7 * H);
  const st = parseStress({
    startTimestampGMT: '2026-10-18T07:00:00.0', startTimestampLocal: '2026-10-18T00:00:00.0', avgStressLevel: -1,
    stressValuesArray: [[T0, 20], [T0 + 1, -1], [T0 + 2, -2]],
    bodyBatteryValueDescriptorsDTOList: [{ bodyBatteryValueDescriptorIndex: 0, bodyBatteryValueDescriptorKey: 'timestamp' }, { bodyBatteryValueDescriptorIndex: 1, bodyBatteryValueDescriptorKey: 'bodyBatteryStatus' }, { bodyBatteryValueDescriptorIndex: 2, bodyBatteryValueDescriptorKey: 'bodyBatteryLevel' }],
    bodyBatteryValuesArray: [[T0, 'MEASURED', 40, 2], [T0 + H, 'MEASURED', 45, 2]],
  });
  assert.equal(st.avg, null);
  assert.deepEqual(st.stress.map((p) => p.v), [20]);
  assert.deepEqual(st.bodyBattery.map((p) => p.v), [40, 45]);
  assert.equal(parseHeartRates('x'), null);
});

test('body battery list and events', () => {
  const bb = parseBodyBattery([{ date: '2026-10-18', bodyBatteryValuesArray: [[T0, 30], [T0 + H, 35]] }, { date: '2026-10-17', bodyBatteryValuesArray: [[T0, 1]] }], '2026-10-18');
  assert.deepEqual(bb.map((p) => p.v), [30, 35]);
  assert.deepEqual(parseBodyBattery(null, '2026-10-18'), []);
  const ev = parseBodyBatteryEvents([
    { event: { eventType: 'SLEEP', eventStartTimeGmt: '2026-10-18T06:00:00.0', timezoneOffset: -7 * H, durationInMilliseconds: 7 * H, bodyBatteryImpact: 55, shortFeedback: 'RESTFUL' } },
    { event: { eventType: 'ACTIVITY', eventStartTimeGmt: '2026-10-18T16:00:00.0', durationInMilliseconds: H, bodyBatteryImpact: -12 }, activityName: 'Morning Ride' },
    { event: { eventType: 'STRESS' } },
  ]);
  assert.equal(ev.length, 2);
  assert.equal(ev[0].label, 'Sleep');
  assert.equal(ev[0].start, T0 - 7 * H);
  assert.equal(ev[1].label, 'Morning Ride');
  assert.equal(ev[1].impact, -12);
});

test('hrv: readings in local time and the balanced band', () => {
  const f = fixture('hrv');
  const h = parseHrv(f);
  assert.equal(h.lastNightAvg, f.hrvSummary.lastNightAvg);
  assert.deepEqual(h.baseline, { low: f.hrvSummary.baseline.balancedLow, high: f.hrvSummary.baseline.balancedUpper });
  assert.equal(h.status, f.hrvSummary.status);
  assert.equal(h.readings.length, f.hrvReadings.length);
  // The reading's local time is its GMT time plus the payload's offset, which is the local time Garmin wrote.
  assert.equal(h.readings[0].t, gmtMs(f.hrvReadings[0].readingTimeLocal));
  assert.equal(parseHrv(null), null);
  assert.equal(parseHrv({ hrvSummary: { baseline: { balancedLow: 70, balancedUpper: 55 } } }).baseline, null);
});

test('readiness: newest score, factors from the morning entry', () => {
  const f = fixture('training_readiness');
  const newest = [...f].sort((a, b) => gmtMs(b.timestamp) - gmtMs(a.timestamp))[0];
  const morning = f.find((e) => e.hrvFactorPercent != null);
  const r = parseReadiness(f);
  assert.equal(r.score, newest.score);
  assert.equal(r.level, newest.level.charAt(0) + newest.level.slice(1).toLowerCase());
  assert.deepEqual(r.factors.map((x) => x.label), ['HRV status']);
  assert.equal(r.factors[0].percent, morning.hrvFactorPercent);
  assert.equal(r.sleepScore, morning.sleepScore);
  assert.equal(parseReadiness([]), null);
  const full = parseReadiness({ score: 70, recoveryTime: 600, sleepScoreFactorPercent: 80, sleepScoreFactorFeedback: 'GOOD', acwrFactorPercent: 120 });
  assert.equal(full.recoveryTimeH, 10);
  assert.equal(full.factors[0].feedback, 'Good');
  assert.equal(full.factors[1].percent, 100);
});

test('summary: totals; -1 stress is null; the empty fixture is all null', () => {
  const f = fixture('user_summary');
  const s = parseSummary(f);
  assert.equal(s.steps, f.totalSteps);
  assert.equal(s.stepGoal, f.dailyStepGoal);
  assert.equal(s.avgStress, f.averageStressLevel);
  assert.equal(s.bodyBatteryHigh, f.bodyBatteryHighestValue);
  const e = parseSummary(fixture('user_summary_empty'));
  assert.equal(e.steps, null);
  assert.equal(e.avgStress, null);
});

test('parseDay never throws on missing or odd kinds', () => {
  const d = parseDay({ sleep: fixture('sleep'), hrv: 'x', readiness: 5, summary: fixture('user_summary') }, '2026-10-18');
  assert.equal(d.sleep.score, fixture('sleep').dailySleepDTO.sleepScores.overall.value);
  assert.equal(d.hrv, null);
  assert.equal(d.readiness, null);
  assert.deepEqual(d.stress, []);
  assert.equal(d.summary.steps, fixture('user_summary').totalSteps);
  const empty = parseDay(null, '2026-10-18');
  assert.equal(empty.sleep, null);
  assert.deepEqual(empty.events, []);
});

test('parseDay reads the other names of a kind', () => {
  const d = parseDay({ user_summary: { totalSteps: 5 }, training_readiness: [{ score: 40 }], heart_rate: { heartRateValues: [[Date.UTC(2026, 9, 18), 50]] } }, '2026-10-18');
  assert.equal(d.summary.steps, 5);
  assert.equal(d.readiness.score, 40);
  assert.equal(d.heartRate.values.length, 1);
});

const raw = (k) => JSON.parse(readFileSync(new URL(`../../../scripts/garmin/fixtures/raw_${k}.json`, import.meta.url), 'utf8'));

test('raw payloads (the garmin_raw shapes): the whole day parses, in local time', () => {
  const kinds = ['summary', 'hrv', 'sleep', 'readiness', 'heart_rates', 'stress', 'body_battery_events'];
  const r = Object.fromEntries(kinds.map((k) => [k, raw(k)]));
  const date = r.summary.calendarDate;
  const d = parseDay(r, date);
  const dto = r.sleep.dailySleepDTO;
  assert.equal(d.sleep.score, dto.sleepScores.overall.value);
  assert.ok(d.sleep.stages.length > 10);
  // The stage spans add up to the stage totals in dailySleepDTO: activityLevel 0 deep, 1 light, 2 REM, 3 awake.
  const fromSpans = stageMinutes({ stages: d.sleep.stages });
  for (const k of ['deep', 'light', 'rem', 'awake']) assert.ok(Math.abs(fromSpans[k] - d.sleep[`${k}Min`]) < 1, k);
  // Local times: the night starts at the local time Garmin wrote, and the day's timelines are on the day.
  assert.equal(d.sleep.start, dto.sleepStartTimestampLocal);
  assert.equal(new Date(d.heartRate.values[0].t).toISOString().slice(0, 10), date);
  assert.ok(d.stress.every((p) => new Date(p.t).toISOString().slice(0, 10) === date));
  assert.ok(d.sleep.hr.length && d.sleep.stress.length && d.sleep.spo2.length);
  assert.ok(d.stress.every((p) => p.v >= 0 && p.v <= 100));
  assert.ok(d.bodyBattery.length > 0);
  assert.equal(d.events[0].label, 'Sleep');
  assert.deepEqual(d.hrv.baseline, { low: r.hrv.hrvSummary.baseline.balancedLow, high: r.hrv.hrvSummary.baseline.balancedUpper });
  assert.ok(d.hrv.readings.length > 0);
  const newest = [...r.readiness].sort((a, b) => gmtMs(b.timestamp) - gmtMs(a.timestamp))[0];
  assert.equal(d.readiness.score, newest.score);
  assert.equal(d.readiness.factors.length, 6);
  assert.equal(d.summary.steps, r.summary.totalSteps);
});
