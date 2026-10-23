import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, libraryFrom, locationFrom, monthWeeks, parseMonth, plainTitle, weatherOf, weekSummary } from './calendar.mjs';

test('parseMonth keeps a good value and falls back to today', () => {
  assert.equal(parseMonth('2026-10', '2026-03-04'), '2026-10');
  assert.equal(parseMonth('2026-13', '2026-03-04'), '2026-03');
  assert.equal(parseMonth(undefined, '2026-03-04'), '2026-03');
});

test('addMonths crosses years', () => {
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(addMonths('2026-01', -1), '2025-12');
});

test('monthWeeks: Monday rows from the week of the 1st to the week of the last day', () => {
  // October 2026: the 1st is a Thursday, the 31st a Saturday.
  assert.deepEqual(monthWeeks('2026-10'), ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
  // February 2027 starts on a Monday and ends on a Sunday: exactly 4 rows.
  assert.deepEqual(monthWeeks('2027-02'), ['2027-02-01', '2027-02-08', '2027-02-15', '2027-02-22']);
});

const data = {
  today: '2026-10-21',
  activities: [
    { date: '2026-10-19', sport: 'ride', min: 60, km: 30.04, tss: 50.4 },
    { date: '2026-10-20', sport: 'run', min: 45, km: 9.02, tss: 40.2 },
    { date: '2026-10-20', sport: 'ride', min: 20, km: 6, tss: 5, commute: true },
    { date: '2026-10-27', sport: 'run', min: 30, km: 6, tss: 25 },
  ],
  lifts: [{ date: '2026-10-21' }],
  workouts: [
    { date: '2026-10-19', sport: 'ride', title: 'Z2 ride', duration: 60, tss: 50, status: 'planned', state: 'done' },
    { date: '2026-10-20', sport: 'ride', title: 'VO2 ride', duration: 75, tss: 85, status: 'planned', state: 'missed' },
    { date: '2026-10-21', sport: 'rest', title: 'Rest day', duration: 0, tss: 0, status: 'planned', state: 'today' },
    { date: '2026-10-22', sport: 'run', title: 'Tempo run', duration: 45, tss: 55, status: 'skipped', state: 'skipped' },
  ],
  load: [
    { date: '2026-10-18', ctl: 60, atl: 50, tsb: 10 },
    { date: '2026-10-20', ctl: 61, atl: 55, tsb: 5 },
    { date: '2026-10-21', ctl: 62, atl: 58, tsb: 3 },
    { date: '2026-10-26', ctl: 70, atl: 70, tsb: 0 },
  ],
};

test('weekSummary totals the week, leaving out commutes, rest and skipped workouts', () => {
  const s = weekSummary('2026-10-19', data);
  assert.equal(s.done.min, 105);
  assert.equal(s.done.km, 39.1);
  assert.equal(s.done.tss, 91);
  assert.deepEqual(s.done.bySport, { ride: 60, run: 45 });
  assert.equal(s.done.liftSessions, 1);
  assert.deepEqual(s.planned, { min: 135, tss: 135, count: 2, done: 1, missed: 1, skipped: 1 });
  assert.deepEqual(s.fitness, { date: '2026-10-21', ctl: 62, atl: 58, tsb: 3 });
});

test('weekSummary has no fitness for a week that has not started', () => {
  assert.equal(weekSummary('2026-10-26', data).fitness, null);
});

test('plainTitle drops the leading emoji', () => {
  assert.equal(plainTitle('🏋️ Strength — heavy barbell'), 'Strength — heavy barbell');
  assert.equal(plainTitle('🚴 Long Ride Z2'), 'Long Ride Z2');
});

test('libraryFrom: one entry per sport and title, newest copy, no rest or adapted workouts', () => {
  const rows = [
    { id: 'a', sport: 'ride', title: '🚴 Long Ride Z2', duration: 150, tss: 120, date: '2026-10-01' },
    { id: 'b', sport: 'ride', title: '🚴 Long ride z2', duration: 180, tss: 150, date: '2026-10-10' },
    { id: 'c', sport: 'rest', title: 'Rest day', duration: 0, date: '2026-10-11' },
    { id: 'd', sport: 'run', title: 'Easy aerobic (instead of Run intervals)', duration: 35, date: '2026-10-12' },
    { id: 'e', sport: 'run', title: '🏃 Tempo Run', duration: 45, date: '2026-10-12' },
  ];
  const lib = libraryFrom(rows, [{ id: 't2', name: 'Hotel gym', position: 1 }, { id: 't1', name: 'Heavy barbell', position: 0, slots: ['3 × 5 Squat'] }]);
  assert.deepEqual(lib.map((x) => x.id), ['lift:t1', 'lift:t2', 'plan:b', 'plan:e']);
  assert.equal(lib[2].uses, 2);
  assert.equal(lib[2].duration, 180);
  assert.equal(lib[0].description, '3 × 5 Squat');
});

test('weatherOf groups WMO codes', () => {
  assert.equal(weatherOf(0).icon, 'sun');
  assert.equal(weatherOf(2).icon, 'cloud-sun');
  assert.equal(weatherOf(63).label, 'Rain');
  assert.equal(weatherOf(81).label, 'Showers');
  assert.equal(weatherOf(73).icon, 'snow');
  assert.equal(weatherOf(96).icon, 'storm');
});

test('locationFrom validates users.settings.location', () => {
  const home = { name: 'Home', lat: 1, lon: 2 };
  assert.deepEqual(locationFrom({ location: { name: 'Lisbon', lat: 38.72, lon: -9.14 } }, home), { name: 'Lisbon', lat: 38.72, lon: -9.14 });
  assert.equal(locationFrom({ location: { lat: 0, lon: 0 } }, home).name, '0.00, 0.00');
  assert.equal(locationFrom({ location: { lat: 'x', lon: 2 } }, home), home);
  assert.equal(locationFrom({}, home), home);
  assert.equal(locationFrom(null, home), home);
});

test('weekSummary counts a workout marked done by hand at its planned time and TSS', () => {
  const calf = { date: '2026-10-22', sport: 'strength', title: 'Home calf raises', duration: 15, tss: 5, status: 'done', state: 'done', match: null };
  const s = weekSummary('2026-10-19', { ...data, workouts: [...data.workouts, calf] });
  assert.equal(s.done.min, 120);
  assert.equal(s.done.tss, 96);
  assert.equal(s.done.bySport.strength, 15);
  assert.equal(s.planned.done, 2);
});
