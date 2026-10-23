import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitnessSection, mainLift, todayResponse } from './today-api.mjs';

const NOW = new Date('2026-10-20T20:30:00.000Z');
const sports = { known: new Set(['ride', 'run', 'strength', 'rest', 'other']), label: (id) => id };
const ok = (value) => ({ ok: true, value });
const FAIL = { ok: false };

const pmc = {
  today: '2026-10-20',
  days: [
    { date: '2026-10-19', ctl: 60.04, atl: 70.06, tsb: -9.97, tss: 80.4, projected: false },
    { date: '2026-10-20', ctl: 61.44, atl: 72.1, tsb: -10.6, tss: 50, projected: false },
    { date: '2026-10-21', ctl: 61, atl: 66, tsb: -5, tss: 0, projected: true },
  ],
  ramp: [],
  events: [{ id: 7, name: 'Haute Route', date: '2026-10-21', priority: 'A' }],
  plannedTss: 0,
  estimatedWorkouts: 0,
};
const lift = {
  thisWeek: [{ muscle: 'biceps', sets: 5.5, status: 'below' }, { muscle: 'chest', sets: 12, status: 'inRange' }],
  top: [{ key: 'bench', name: 'Bench press', sessions: 2, points: [{ day: '2026-09-01', e1rm: 90.04 }, { day: '2026-10-15', e1rm: 95.55 }], latest: 95.55, change: 0.0612 }],
  unit: 'kg',
  hasData: true,
  last: { id: 'AB-CD', day: '2026-10-15', title: 'Upper A' },
  daysSince: 5,
  next: { id: 'EF', day: '2026-10-22', title: '' },
  prs: 2,
};
const input = (over = {}) => ({
  now: NOW, timeZone: 'America/Los_Angeles', today: '2026-10-20', strengthTarget: 2, sports,
  perf: ok({ weeks: [{ week: '2026-10-12', hours: 6, runKm: 0, runMin: 0, rideKm: 100, rideHours: 4, strength: 2, tss: 300, planned: 0, done: 0, sports: {} }, { week: '2026-10-19', hours: 1, runKm: 0, runMin: 0, rideKm: 0, rideHours: 0, strength: 1, tss: 50, planned: 0, done: 0, sports: {} }], load: [], latestActivity: '2026-10-19' }),
  week: ok({ today: '2026-10-20', workouts: [{ id: 42, date: '2026-10-20', title: '🏋️ Heavy lift', sport: 'strength', status: 'planned', state: 'today', startTime: '13:30', duration: 60, liftSessionId: 'CA4F' }] }),
  pmc: ok(pmc),
  lift: ok(lift),
  body: ok({ weight: { date: '2026-10-19', value: 78.44 }, change4w: -1.2, bodyFat: { date: '2026-10-19', value: 14.25 }, series: [{ date: '2026-10-01', value: 79.66, trend: 79.214 }], trend: { kg: 78.9, text: '78.9', rate: { kgPerWeek: -0.26, text: '▼ 0.26 kg/wk', tone: 'good' }, offKg: -0.5, swingKg: 0.6, noteText: 'Today is 0.5 kg under your trend.' } }),
  goals: ok([]),
  recovery: { hasData: true, readiness: { value: 80 }, sleepMin: null, sleepScore: null, hrvStatus: null },
  ...over,
});

test('the whole response: every section ok, display text ready', () => {
  const r = todayResponse(input());
  assert.equal(r.generatedAt, '2026-10-20T20:30:00.000Z');
  assert.equal(r.dateText, 'Tuesday, October 20');
  assert.deepEqual(r.header.chips.map((c) => c.key), ['readiness', 'fitness', 'form']);
  assert.equal(r.header.emptyText, null);
  assert.deepEqual(r.stale, { ok: true, text: null });
  assert.deepEqual(r.todayLine, {
    ok: true,
    items: [{ id: '42', title: 'Heavy lift', sport: 'strength', state: 'today', text: '13:30 · 1:00', liftSessionId: 'ca4f' }],
    emptyText: null,
    cue: null,
  });
  assert.equal(r.fitness.ok, true);
  assert.deepEqual(r.last4Weeks.tiles.map((t) => t.valueText), ['6:00 h', '0 km', '100 km', '2 of 8']);
  assert.equal(r.body.weight.text, '78.4');
  assert.equal(r.body.weight.changeText, '▼ 0.26 kg/wk');
  assert.equal(r.body.weight.changeTone, 'good');
  assert.equal(r.body.weight.noteText, 'Trend 78.9 kg · ▼ 1.2 kg in 4 weeks');
  assert.deepEqual(r.body.series, [{ date: '2026-10-01', kg: 79.7, trendKg: 79.21 }]);
  assert.equal(r.body.trend.text, '78.9');
  assert.equal(r.body.bodyFatText, '14.3 %');
  assert.deepEqual(r.lift.arms.rows, [{ muscle: 'biceps', sets: 5.5, setsText: '5.5' }, { muscle: 'triceps', sets: 0, setsText: '0' }]);
  assert.deepEqual(r.lift.strength, { done: 1, target: 2, text: '1 / 2 this week' });
  assert.deepEqual(r.lift.last, { sessionId: 'ab-cd', day: '2026-10-15', daysSince: 5, whenText: '5 days ago', late: false, title: 'Upper A', prs: 2, text: 'Upper A · 2 PRs' });
  assert.deepEqual(r.lift.next, { sessionId: 'ef', day: '2026-10-22', dateText: 'Oct 22', title: 'Session' });
  assert.deepEqual(r.goals, { ok: true, items: [], emptyText: 'No goals. Add milestones in Settings.' });
  assert.ok(JSON.stringify(r).length < 100_000);
});

test('a failed loader fails only its section', () => {
  const r = todayResponse(input({ pmc: FAIL, lift: FAIL, recovery: null, perf: FAIL }));
  assert.deepEqual(r.fitness, { ok: false });
  assert.deepEqual(r.lift, { ok: false });
  assert.deepEqual(r.last4Weeks, { ok: false });
  assert.deepEqual(r.stale, { ok: false, text: null });
  assert.deepEqual(r.header, { ok: true, chips: [], emptyText: 'No Garmin data today.' });
  assert.equal(r.todayLine.ok, true);
  assert.equal(r.todayLine.cue, null);
  assert.equal(r.body.ok, true);
});

test('empty states', () => {
  const r = todayResponse(input({
    week: ok({ today: '2026-10-20', workouts: [] }),
    body: ok({ weight: null, change4w: null, bodyFat: null, series: [], trend: null }),
    lift: ok({ ...lift, top: [], hasData: false, last: null, next: null, daysSince: null, prs: 0 }),
    perf: ok({ weeks: [], load: [], latestActivity: '2026-10-01' }),
  }));
  assert.equal(r.todayLine.emptyText, 'No plan this week. Run /plan in Claude Code to make one.');
  assert.equal(r.body.weight, null);
  assert.match(r.body.emptyText, /^No weight in the last 12 weeks/);
  assert.equal(r.lift.mainLiftsEmptyText, 'No Lift sessions in 12 weeks.');
  assert.equal(r.lift.last, null);
  assert.equal(r.lift.nextEmptyText, 'Not planned yet');
  assert.deepEqual(r.last4Weeks.tiles, []);
  assert.equal(r.stale.text, 'The newest Strava activity is from 2026-10-01.');
});

test('fitness: rounded days, open-ended zones, the latest actual day', () => {
  const f = fitnessSection(pmc);
  assert.deepEqual(f.days[0], { date: '2026-10-19', ctl: 60, atl: 70.1, tsb: -10, tss: 80, projected: false });
  assert.deepEqual(f.zones[0], { label: 'Fresh', from: 5, to: null, shade: true });
  assert.deepEqual(f.zones[3], { label: 'Overreaching', from: null, to: -30, shade: false });
  assert.deepEqual(f.now, { date: '2026-10-20', ctl: 61.4, atl: 72.1, tsb: -10.6, zone: 'Productive' });
  assert.deepEqual(f.events, [{ id: '7', name: 'Haute Route', date: '2026-10-21', priority: 'A' }]);
  assert.equal(f.caption, 'Projection to 2026-10-21: no workouts planned, so it shows rest, fitness 61, form -5.');
});

test('a main lift row', () => {
  assert.deepEqual(mainLift(lift.top[0], 'kg'), {
    exerciseKey: 'bench', name: 'Bench press', points: [{ day: '2026-09-01', e1rm: 90 }, { day: '2026-10-15', e1rm: 95.6 }],
    latest: 95.6, latestText: '96 kg', change: 0.061, changeText: '+6%', tone: 'good', sparkText: null,
  });
  assert.equal(mainLift({ ...lift.top[0], points: [lift.top[0].points[0]], change: null }, 'kg').sparkText, '1 session');
});
