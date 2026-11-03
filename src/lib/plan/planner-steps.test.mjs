import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestAway, dayModes, firstStep, freeWindows, hourSplit, keepers, lastWeekRead, roughSplit, versusLastWeek, withDayMode } from './planner-steps.mjs';

// A made-up week (TEST-8).
const cal = [
  { date: '2026-03-10', allDay: false, start: '09:00', minutes: 120 },
  { date: '2026-03-10', allDay: false, start: '14:00', minutes: 60 },
  { date: '2026-03-10', allDay: true, start: null, minutes: 0 },
  { date: '2026-03-11', allDay: false, start: '06:30', minutes: 30 },
];
const ev = (index, date, title, sport, minutes, hard = false) => ({ index, date, title, sport, minutes, hard });
const week = [
  ev(1, '2026-03-10', 'Heavy barbell', 'strength', 60),
  ev(2, '2026-03-11', 'Threshold ride', 'ride', 75, true),
  ev(3, '2026-03-11', 'Physio A', 'strength', 20),
  ev(4, '2026-03-13', 'VO2 run', 'run', 60, true),
  ev(5, '2026-03-14', 'Long run', 'run', 105),
  ev(6, '2026-03-15', 'Z2 ride', 'ride', 105),
];

test('freeWindows skips meetings and short gaps, and all-day events do not block', () => {
  assert.deepEqual(freeWindows(cal, '2026-03-10'), [
    { start: '06:00', end: '09:00', minutes: 180 },
    { start: '11:00', end: '14:00', minutes: 180 },
    { start: '15:00', end: '21:00', minutes: 360 },
  ]);
  assert.deepEqual(freeWindows(cal, '2026-03-11'), [{ start: '07:00', end: '21:00', minutes: 840 }]);
  assert.deepEqual(freeWindows(cal, '2026-03-11', { min: 900 }), []);
});

test('hourSplit puts physio apart from lifts', () => {
  assert.deepEqual(hourSplit(week), { run: 165, ride: 180, lift: 60, physio: 20, other: 0 });
});

test('roughSplit leaves the rest easy, never below zero', () => {
  assert.deepEqual(roughSplit({ hours: 9, gym: 2, hard: 2 }), { total: 540, lift: 120, quality: 140, long: 105, physio: 40, easy: 135 });
  assert.equal(roughSplit({ hours: 3, gym: 2, hard: 2 }).easy, 0);
});

test('keepers are the first lift, the first hard session and the longest run', () => {
  assert.deepEqual(keepers(week).map((e) => e.title), ['Heavy barbell', 'Threshold ride', 'Long run']);
  assert.deepEqual(keepers([]), []);
});

test('versusLastWeek compares time, lifts, hard and running', () => {
  const rows = versusLastWeek({ doneMin: 397, lifts: { done: 1 }, hard: { done: 1 }, runMin: 95 }, week);
  assert.deepEqual(rows.map((r) => [r.label, r.before, r.after]), [
    ['Time', 397, 425], ['Lifts', 1, 1], ['Hard sessions', 1, 2], ['Running', 95, 165],
  ]);
  assert.equal(versusLastWeek(null, week)[0].before, null);
});

test('day modes round-trip through the answers', () => {
  let a = { daysOff: [], away: [] };
  a = withDayMode(a, '2026-03-12', 'away');
  a = withDayMode(a, '2026-03-09', 'off');
  a = withDayMode(a, '2026-03-13', 'away');
  assert.deepEqual(a, { daysOff: ['2026-03-09'], away: ['2026-03-12', '2026-03-13'] });
  assert.deepEqual(dayModes('2026-03-09', a).map((d) => d.mode), ['off', 'free', 'free', 'away', 'away', 'free', 'free']);
  a = withDayMode(a, '2026-03-12', 'free');
  assert.deepEqual(a.away, ['2026-03-13']);
  assert.deepEqual(dayModes('2026-03-09', { daysOff: [] })[0], { date: '2026-03-09', mode: 'free' });
});

test('firstStep opens the draft once Coach is on it', () => {
  assert.equal(firstStep('proposed'), 'draft');
  assert.equal(firstStep('running'), 'draft');
  assert.equal(firstStep('failed'), 'last');
  assert.equal(firstStep(null), 'last');
});

test('lastWeekRead names the missed lift, the hard sessions and the short volume', () => {
  const lw = {
    doneMin: 397,
    lifts: { planned: 2, done: 1 },
    hard: { planned: 2, done: 1 },
    days: [
      { date: '2026-03-02', items: [], done: [{ min: 46 }] },
      { date: '2026-03-03', items: [{ title: 'Heavy barbell', sport: 'strength', level: 'partial' }], done: [{ min: 56 }] },
      { date: '2026-03-04', items: [{ title: 'Physio A', sport: 'strength', level: 'missed' }], done: [] },
      { date: '2026-03-05', items: [{ title: 'Upper + arms', sport: 'strength', level: 'missed' }], done: [{ min: 56 }] },
      { date: '2026-03-06', items: [], done: [] },
      { date: '2026-03-07', items: [], done: [{ min: 49 }] },
      { date: '2026-03-08', items: [], done: [{ min: 191 }] },
    ],
  };
  const r = lastWeekRead(lw);
  assert.deepEqual(r.map((x) => [x.id, x.tone]), [['lifts', 'warn'], ['hard', 'warn'], ['volume', 'warn']]);
  assert.equal(r[0].text, '1 of 2 lifts. Upper + arms missed.');
  assert.equal(r[2].text, '6h37 against your 8–10 h week. Nothing on Wed, Fri.');
  assert.deepEqual(lastWeekRead({ ...lw, doneMin: 540, lifts: { planned: 0, done: 0 }, hard: { planned: 0, done: 0 } }).map((x) => x.title), ['Volume on target']);
  assert.deepEqual(lastWeekRead(null), []);
  const going = lastWeekRead({ ...lw, ongoing: true }, '2026-03-05');
  assert.equal(going[2].text, '6h37 so far. Nothing on Wed.');
});

test('suggestAway marks trips, flights and all-day holds, not holidays or past days', () => {
  const cal = [
    { date: '2026-11-10', allDay: false, title: 'Team standup' },
    { date: '2026-11-11', allDay: true, title: 'NYC' },
    { date: '2026-11-11', allDay: true, title: 'Veterans Day' },
    { date: '2026-11-12', allDay: false, title: 'Flight to Geneva' },
    { date: '2026-11-13', allDay: true, title: 'Zurich hold' },
    { date: '2026-11-09', allDay: true, title: 'Trip to Tahoe' },
  ];
  assert.deepEqual(suggestAway(cal, '2026-11-09', '2026-11-10'), ['2026-11-11', '2026-11-12', '2026-11-13']);
  assert.deepEqual(suggestAway([{ date: '2026-11-11', allDay: true, title: 'Veterans Day' }], '2026-11-09', '2026-11-01'), []);
});
