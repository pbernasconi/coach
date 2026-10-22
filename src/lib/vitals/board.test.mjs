import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardOf, coverageOf, lastNightOf, statOf, trendOf } from './board.mjs';

const row = (date, metric, value) => ({ date, metric, value });
const days = ['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21'];

test('coverage: wear_min wins, other values mean worn, nothing after the sync is pending', () => {
  const rows = [
    row('2026-10-17', 'resting_hr_bpm', 42), // before wear_min existed
    row('2026-10-18', 'wear_min', 0), // synced, not worn
    row('2026-10-18', 'steps', 2300), // from the phone
    row('2026-10-19', 'wear_min', 600),
    row('2026-10-19', 'resting_hr_bpm', 44),
    row('2026-10-20', 'wear_min', 1400),
  ];
  assert.deepEqual(coverageOf(rows, days, '2026-10-20'), {
    '2026-10-17': 'worn',
    '2026-10-18': 'off',
    '2026-10-19': 'partial',
    '2026-10-20': 'worn',
    '2026-10-21': 'pending',
  });
});

test('coverage: a synced day with no values is off; without a sync day the newest sample bounds it', () => {
  const rows = [row('2026-10-17', 'stress_avg', 30), row('2026-10-19', 'steps', 8000), row('2026-10-19', 'weight_kg', 83)];
  const c = coverageOf(rows, days, null);
  assert.equal(c['2026-10-18'], 'off');
  assert.equal(c['2026-10-20'], 'pending');
  assert.equal(coverageOf([], days, null)['2026-10-17'], 'pending');
});

test('statOf: mean ± 1 SD of the 60 days before the latest value, after 14 of them', () => {
  const pts = Array.from({ length: 20 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, value: i % 2 ? 110 : 90 }));
  const s = statOf([...pts, { date: '2026-09-25', value: 130 }]);
  assert.equal(Math.round(s.normal.mean), 100);
  assert.equal(s.status, 'above');
  assert.equal(statOf(pts.slice(0, 10)).normal, null);
  assert.deepEqual(statOf([]), { latest: null, normal: null, status: null });
});

test('boardOf: one slot per day, empty days null, intensity counts vigorous twice', () => {
  const rows = [
    row('2026-10-19', 'hrv_night_avg_ms', 101),
    row('2026-10-20', 'intensity_minutes_moderate', 20),
    row('2026-10-20', 'intensity_minutes_vigorous', 10),
    row('2026-10-21', 'hrv_night_avg_ms', 99),
    row('2026-09-01', 'weight_kg', 85),
    row('2026-10-20', 'weight_kg', 83.5),
  ];
  const b = boardOf(rows, { today: '2026-10-21', days: 5, syncedThrough: '2026-10-21' });
  assert.deepEqual(b.days, days);
  assert.deepEqual(b.series.hrv, [null, null, 101, null, 99]);
  assert.deepEqual(b.series.intensity, [null, null, null, 40, null]);
  assert.equal(b.intensityWeek, 40); // Monday 2026-10-19 to Wednesday
  assert.equal(b.stats.hrv.latest.value, 99);
  assert.equal(b.stats.weight.change28, -1.5);
  assert.deepEqual(b.counts, { worn: 3, partial: 0, off: 2, pending: 0 });
});

test('trendOf: the last 30 and 90 days, today included, with counts', () => {
  const pts = [
    { date: '2026-07-24', value: 100 }, // 90 days back from 2026-10-21, inside
    { date: '2026-07-23', value: 1000 }, // 91 days back, outside
    { date: '2026-09-22', value: 40 }, // inside the 30 days
    { date: '2026-10-21', value: 50 },
  ];
  assert.deepEqual(trendOf(pts, '2026-10-21'), { avg30: 45, n30: 2, avg90: (100 + 40 + 50) / 3, n90: 3 });
  assert.deepEqual(trendOf([], '2026-10-21'), { avg30: null, n30: 0, avg90: null, n90: 0 });
});

test('lastNightOf: in, not worn, or waiting', () => {
  assert.deepEqual(lastNightOf(452, 'worn'), { status: 'in', sleepMin: 452 });
  assert.equal(lastNightOf(null, 'off').status, 'off');
  assert.equal(lastNightOf(null, 'pending').status, 'waiting');
  assert.equal(lastNightOf(null, 'partial').status, 'waiting');
});

test('boardOf: trends read beyond a 5-day window; intensity counts vigorous twice', () => {
  const rows = [
    row('2026-08-01', 'resting_hr_bpm', 50),
    row('2026-10-20', 'resting_hr_bpm', 44),
    row('2026-10-21', 'resting_hr_bpm', 42),
    row('2026-08-01', 'intensity_minutes_vigorous', 10),
    row('2026-10-21', 'intensity_minutes_moderate', 30),
    row('2026-10-21', 'sleep_total_min', 450),
  ];
  const b = boardOf(rows, { today: '2026-10-21', days: 5, syncedThrough: '2026-10-21' });
  assert.equal(b.trend.rhr.avg30, 43);
  assert.equal(b.trend.rhr.n90, 3);
  assert.equal(b.trend.intensity.avg90, 25);
  assert.deepEqual(b.lastNight, { status: 'in', sleepMin: 450 });
});
