import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
  fmtPace, fmtTime, hrvNights, intensityWeeks, latestWithChange, parseEnduranceScore, parseHillScore, parsePersonalRecords,
  parseTrainingStatus, ratioLabel, series, sleepNights, statusFromPhrase, trainingStatusOf,
} from './garmin-training.mjs';

const STATUS = {
  userId: 1,
  mostRecentTrainingStatus: {
    latestTrainingStatusData: {
      111: { calendarDate: '2026-10-17', trainingStatus: 3, primaryTrainingDevice: false },
      222: {
        calendarDate: '2026-10-18', trainingStatus: 4, trainingStatusFeedbackPhrase: 'PRODUCTIVE_3', primaryTrainingDevice: true,
        loadTunnelMin: 300, loadTunnelMax: 700,
        acuteTrainingLoadDTO: { acwrPercent: 55, acwrStatus: 'OPTIMAL', dailyTrainingLoadAcute: 560, dailyTrainingLoadChronic: 480, minTrainingLoadChronic: 380, maxTrainingLoadChronic: 640, dailyAcuteChronicWorkloadRatio: 1.2 },
      },
    },
  },
  mostRecentTrainingLoadBalance: {
    metricsTrainingLoadBalanceDTOMap: {
      222: {
        calendarDate: '2026-10-18', primaryTrainingDevice: true, trainingBalanceFeedbackPhrase: 'ABOVE_TARGETS_1',
        monthlyLoadAerobicLow: 900, monthlyLoadAerobicLowTargetMin: 500, monthlyLoadAerobicLowTargetMax: 1000,
        monthlyLoadAerobicHigh: 400, monthlyLoadAerobicHighTargetMin: 450, monthlyLoadAerobicHighTargetMax: 900,
        monthlyLoadAnaerobic: 80,
      },
    },
  },
};

test('training status: the primary device, the phrase label, the loads and the focus targets', () => {
  const s = parseTrainingStatus(STATUS);
  assert.deepEqual(s.status, { label: 'Productive', tone: 'good' });
  assert.equal(s.acute, 560);
  assert.equal(s.chronic, 480);
  assert.equal(s.ratio, 1.2);
  assert.equal(s.ratioStatus, 'Optimal');
  assert.equal(s.tunnelMax, 700);
  assert.deepEqual(s.focus.map((f) => [f.key, f.value, f.min, f.max]), [['anaerobic', 80, null, null], ['high', 400, 450, 900], ['low', 900, 500, 1000]]);
  assert.equal(s.focusFeedback, 'Above targets');
  assert.equal(parseTrainingStatus(null), null);
  assert.equal(parseTrainingStatus({}), null);
});

test('status labels from phrases and codes', () => {
  assert.equal(statusFromPhrase('OVERREACHING_2'), 'Overreaching');
  assert.equal(statusFromPhrase('NO_STATUS'), 'No status');
  assert.equal(statusFromPhrase('WHATEVER'), null);
  assert.deepEqual(trainingStatusOf(4), { label: 'Unproductive', tone: 'warn' });
  assert.deepEqual(trainingStatusOf(5), { label: 'Productive', tone: 'good' });
  assert.deepEqual(trainingStatusOf(9), { label: 'Paused', tone: 'neutral' });
  assert.equal(trainingStatusOf(99), null);
  assert.equal(statusFromPhrase('PAUSED_1'), 'Paused');
  assert.equal(trainingStatusOf(null), null);
  assert.equal(ratioLabel(0.5), 'Low');
  assert.equal(ratioLabel(1.5), 'High');
  assert.equal(ratioLabel(4), 'Very high');
  assert.equal(ratioLabel(null), null);
});

test('endurance and hill scores: one day or a range', () => {
  const e = parseEnduranceScore({ enduranceScoreDTO: { calendarDate: '2026-10-18', overallScore: 6800, classificationLowerLimitIntermediate: 3570, classificationLowerLimitTrained: 5000, classificationLowerLimitWellTrained: 6500, classificationLowerLimitExpert: 8000 } });
  assert.equal(e.score, 6800);
  assert.equal(e.classification, 'Well-trained');
  assert.equal(parseEnduranceScore({ overallScore: 4000, classification: 2 }).classification, 'Intermediate');
  assert.equal(parseEnduranceScore({}), null);
  const h = parseHillScore({ hillScoreDTOList: [{ calendarDate: '2026-10-10', overallScore: 50 }, { calendarDate: '2026-10-18', overallScore: 61, strengthScore: 55, enduranceScore: 66 }] });
  assert.deepEqual(h, { date: '2026-10-18', overall: 61, strength: 55, endurance: 66 });
  assert.equal(parseHillScore('x'), null);
});

test('personal records: known types read as time, distance, power; junk skipped', () => {
  const prs = parsePersonalRecords([
    { id: 9, typeId: 4, value: 2701.4, activityName: 'Bay 10K', prStartTimeGmt: Date.UTC(2026, 9, 18, 6) },
    { id: 8, typeId: 8, value: 160934 },
    { id: 7, typeId: 10, value: 281.6 },
    { id: 6, typeId: 99, value: 3, prTypeLabelKey: 'pr.label.some_new' },
    { typeId: 3 },
    'x',
  ]);
  assert.deepEqual(prs.map((p) => [p.label, p.value]), [['Run 10 km', '45:01'], ['Longest ride', '161 km'], ['Ride max 20-min power', '282 W'], ['Some new', '3']]);
  assert.equal(prs[0].date, '2026-10-18');
  assert.deepEqual(parsePersonalRecords(null), []);
});

test('formatting', () => {
  assert.equal(fmtTime(1234), '20:34');
  assert.equal(fmtTime(5025), '1:23:45');
  assert.equal(fmtTime(null), '-');
  assert.equal(fmtPace(272), '4:32/km');
});

const rows = [
  { date: '2026-10-13', metric: 'intensity_minutes_moderate', value: 30 },
  { date: '2026-10-13', metric: 'intensity_minutes_vigorous', value: 20 },
  { date: '2026-10-19', metric: 'intensity_minutes_moderate', value: 10 },
  { date: '2026-10-20', metric: 'intensity_minutes_moderate', value: 999 },
  { date: '2026-10-18', metric: 'sleep_deep_min', value: 80 },
  { date: '2026-10-18', metric: 'sleep_core_min', value: 230 },
  { date: '2026-10-18', metric: 'sleep_score', value: 84 },
  { date: '2026-10-17', metric: 'sleep_score', value: 70 },
  { date: '2026-10-18', metric: 'hrv_night_avg_ms', value: 58 },
  { date: '2026-10-18', metric: 'hrv_baseline_low_ms', value: 55 },
  { date: '2026-10-18', metric: 'hrv_baseline_high_ms', value: 70 },
  { date: '2026-10-18', metric: 'hrv_status', value: 4 },
  { date: '2026-10-17', metric: 'hrv_baseline_low_ms', value: 55 },
  { date: 'bad', metric: 'hrv_night_avg_ms', value: 1 },
];

test('intensity weeks count vigorous twice; today ends the window', () => {
  const w = intensityWeeks(rows, '2026-10-19', 2);
  assert.deepEqual(w.map((x) => [x.week, x.total, x.days]), [['2026-10-12', 70, 1], ['2026-10-19', 10, 1]]);
});

test('sleep nights and hrv nights skip days without the main value', () => {
  const n = sleepNights(rows, '2026-10-19', 30);
  assert.deepEqual(n.map((x) => x.date), ['2026-10-18']);
  assert.equal(n[0].light, 230);
  assert.equal(n[0].score, 84);
  const h = hrvNights(rows);
  assert.deepEqual(h, [{ date: '2026-10-18', value: 58, low: 55, high: 70, status: 4, statusLabel: 'Balanced' }]);
});

test('series and latest with change', () => {
  const s = series([{ date: '2026-09-01', metric: 'vo2max', value: 52 }, { date: '2026-10-18', metric: 'vo2max', value: '54' }, { date: '2026-10-01', metric: 'vo2max', value: 53 }], 'vo2max');
  assert.deepEqual(s.map((p) => p.value), [52, 53, 54]);
  assert.deepEqual(latestWithChange(s, 28), { date: '2026-10-18', value: 54, change: 2, since: '2026-09-01' });
  assert.equal(latestWithChange([], 28), null);
  assert.equal(latestWithChange([{ date: '2026-10-18', value: 1 }]).change, null);
});

const raw = (k) => JSON.parse(readFileSync(new URL(`../../../scripts/garmin/fixtures/raw_${k}.json`, import.meta.url), 'utf8'));

test('raw payloads (the garmin_raw shapes): training status, endurance, hill score, records', () => {
  const ts = raw('training_status');
  const dev = Object.values(ts.mostRecentTrainingStatus.latestTrainingStatusData).find((e) => e.primaryTrainingDevice);
  const s = parseTrainingStatus(ts);
  assert.equal(s.status.label, 'Productive');
  assert.equal(s.acute, dev.acuteTrainingLoadDTO.dailyTrainingLoadAcute);
  assert.equal(s.chronic, dev.acuteTrainingLoadDTO.dailyTrainingLoadChronic);
  assert.equal(s.ratioStatus, 'High');
  assert.deepEqual(s.focus.map((f) => f.key), ['anaerobic', 'high', 'low']);
  assert.ok(s.focus.every((f) => f.min !== null && f.max !== null));
  const er = raw('endurance_score');
  const edto = er.enduranceScoreDTO ?? er;
  const e = parseEnduranceScore(er);
  assert.equal(e.score, edto.overallScore);
  // The class is the highest limit at or below the score.
  const expected = e.limits.filter((l) => e.score >= l.from).at(-1)?.label ?? 'Recreational';
  assert.equal(e.classification, expected);
  const hr = raw('hill_score');
  const hdto = (hr.hillScoreDTOList ?? [hr]).at(-1);
  assert.deepEqual(parseHillScore(hr), { date: hdto.calendarDate, overall: hdto.overallScore, strength: hdto.strengthScore, endurance: hdto.enduranceScore });
  const prs = parsePersonalRecords(raw('personal_records'));
  assert.equal(prs.length, 15);
  assert.ok(prs.every((p) => !p.label.startsWith('Record ')));
  const first = raw('personal_records').find((p) => p.typeId === 1);
  assert.equal(prs[0].label, 'Run 1 km');
  assert.equal(prs[0].value, fmtTime(first.value));
  // The local day of the activity, not the GMT one.
  assert.equal(prs[0].date, new Date(first.activityStartDateTimeLocal).toISOString().slice(0, 10));
});
