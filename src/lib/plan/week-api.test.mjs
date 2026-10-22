import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clockOf, hm, loadText, notesOf, parseWeekQuery, statsOf, totalsText, weekItem, weekResponse } from './week-api.mjs';
import { LIFT_MARKER } from './lift-plan.mjs';
import { complianceOf } from './compliance.mjs';

const sports = { known: new Set(['ride', 'run', 'strength', 'rest', 'other']), label: (id) => id[0].toUpperCase() + id.slice(1) };
const NOW = new Date('2026-10-20T20:30:00.000Z'); // Tuesday 13:30 in Los Angeles

const workout = (over) => ({
  id: 'w1', date: '2026-10-20', startTime: null, endTime: null, title: '🏋️ Heavy barbell lift', sport: 'strength',
  workoutType: 'strength-heavy', intensity: null, duration: 60, tss: 45, why: null, description: null, status: 'planned',
  adaptedFrom: null, sortOrder: 0, steps: null, state: 'today', match: null, actual: null,
  compliance: { level: 'today', label: 'Today', ratio: null, basis: null }, lift: null, liftSessionId: null, ...over,
});

test('the query: start snaps to Monday, weeks 1–4, a bad zone falls back', () => {
  const q = (s) => parseWeekQuery(new URLSearchParams(s), NOW);
  assert.deepEqual(q(''), { start: '2026-10-19', weeks: 2, timeZone: 'America/Los_Angeles', today: '2026-10-20' });
  assert.deepEqual(q('start=2026-10-25&weeks=4&tz=Asia/Tokyo'), { start: '2026-10-19', weeks: 4, timeZone: 'Asia/Tokyo', today: '2026-10-21' });
  assert.equal(q('tz=Not/AZone').timeZone, 'America/Los_Angeles');
  assert.ok('error' in q('start=2026-02-30'));
  assert.ok('error' in q('start=yesterday'));
  assert.ok('error' in q('start=2026-13-01'), 'a month that does not exist is a 400, not a throw');
  assert.ok('error' in q('start=0000-01-01'));
  assert.ok('error' in q('weeks=5'));
  assert.ok('error' in q('weeks=0'));
  assert.ok('error' in q('weeks=1.5'));
});

test('text helpers', () => {
  assert.equal(hm(540), '9:00');
  assert.equal(hm(130), '2:10');
  assert.equal(loadText(60, 45), '60 min · 45 TSS');
  assert.equal(loadText(null, null), '');
  assert.equal(notesOf(`Go heavy.\n\n${LIFT_MARKER}\nTemplate: Heavy`), 'Go heavy.');
  assert.equal(notesOf(`${LIFT_MARKER}\nTemplate: Heavy`), null);
  assert.equal(notesOf('Z2 only'), 'Z2 only');
});

test('a planned lift: plain title, subtitle, notes above the marker, lower-case session id, no done', () => {
  const item = weekItem(
    workout({ startTime: '13:30', endTime: '14:30', why: 'Durable legs', description: `Go heavy.\n\n${LIFT_MARKER}\n- Squat`, liftSessionId: 'CA4F651B-98C7-4765-83A9-07AB74435D69' }),
    sports
  );
  assert.equal(item.title, 'Heavy barbell lift');
  assert.equal(item.subtitle, '13:30 · 60 min · 45 TSS');
  assert.equal(item.notes, 'Go heavy.');
  assert.equal(item.liftSessionId, 'ca4f651b-98c7-4765-83a9-07ab74435d69');
  assert.equal(item.state, 'today');
  assert.equal(item.stateLabel, 'Today');
  assert.equal(item.compliance, null);
  assert.equal(item.done, null);
  assert.deepEqual(item.keyTargets, []);
  assert.deepEqual(item.steps, []);
  assert.deepEqual(item.profile, []);
  assert.deepEqual(item.stats, { time: '1:00:00', distance: null, tss: '45' });
});

test('a done ride: compliance, done minutes and TSS from the matched activity, key targets from steps', () => {
  const steps = {
    version: 1, sport: 'ride', name: 'T', steps: [
      { kind: 'repeat', count: 6, steps: [{ kind: 'work', duration: { type: 'time', s: 300 }, target: { type: 'power', unit: 'pct_ftp', low: 105, high: 110 } }] },
    ],
  };
  const item = weekItem(
    workout({
      title: 'Threshold ride', sport: 'ride', steps, state: 'done', match: { source: 'strava', id: '9', name: 'Morning Ride' },
      actual: { min: 62, tss: 70 }, compliance: { level: 'good', label: 'On target', ratio: 1.03, basis: 'duration' },
    }),
    sports
  );
  assert.equal(item.compliance, 'good');
  assert.equal(item.stateLabel, 'On target');
  assert.deepEqual(item.done, { source: 'strava', activityId: '9', name: 'Morning Ride', minutes: 62, tss: 70, text: '62 min · 70 TSS / 60 min · 45 TSS' });
  assert.deepEqual(item.keyTargets, ['6 × 5:00 at 278–292 W']);
  assert.equal(item.steps.length, 1);
  assert.equal(item.profile.length, 6);
  assert.deepEqual(item.stats, { time: '1:02:00', distance: null, tss: '70' });
  assert.deepEqual(item.profile[0], { seconds: 300, from: 1.08, to: 1.08, zone: 'Z5' });
});

test('a done lift takes its minutes from the Lift session; a rest day has no compliance', () => {
  const lift = weekItem(
    workout({ state: 'done', match: { source: 'lift', id: 's', name: 'Heavy' }, actual: { min: null, tss: null }, lift: { minutes: 55 },
      compliance: { level: 'done', label: 'Done', ratio: null, basis: null } }),
    sports
  );
  assert.deepEqual(lift.done, { source: 'lift', activityId: null, name: 'Heavy', minutes: 55, tss: null, text: '55 min / 60 min · 45 TSS' });
  assert.equal(lift.compliance, null);
  const rest = weekItem(workout({ title: 'Rest day', sport: 'rest', duration: null, tss: null, state: 'done', compliance: { level: 'rest', label: 'Rest', ratio: null, basis: null } }), sports);
  assert.equal(rest.done, null);
  assert.equal(rest.compliance, null);
  assert.equal(rest.subtitle, 'Rest');
  assert.equal(weekItem(workout({ sport: 'cycling', title: 'Zwift ride', workoutType: null }), sports).sport, 'ride');
});

test('totals text: done / planned for a started week, planned only ahead, nothing for an empty week', () => {
  const s = (monday, done, planned) => ({ monday, done: { min: 0, km: 0, tss: 0, count: 0, liftSessions: 0, bySport: {}, ...done }, planned: { min: 0, tss: 0, count: 0, done: 0, missed: 0, ...planned }, fitness: null });
  assert.equal(totalsText(s('2026-10-19', { min: 130, tss: 140, count: 2 }, { min: 540, tss: 520, count: 9, done: 2 }), '2026-10-20'), '2/9 done · 2:10 of 9:00 · 140 of 520 TSS');
  assert.equal(totalsText(s('2026-10-26', {}, { min: 540, tss: 520, count: 9 }), '2026-10-20'), '9 planned · 9:00 · 520 TSS');
  assert.equal(totalsText(s('2026-10-26', {}, {}), '2026-10-20'), 'Nothing planned');
  const fitnessOnly = { ...s('2026-10-12', {}, {}), fitness: { ctl: 50 } };
  assert.equal(totalsText(fitnessOnly, '2026-10-20'), 'Nothing planned', 'a past week with fitness only still has a text');
});

test('the response: 7 days a week, Monday first, items in plan order, plan title', () => {
  const summaries = [{ monday: '2026-10-19', done: { min: 0, km: 0, tss: 0, count: 0, liftSessions: 0, bySport: {} }, planned: { min: 120, tss: 90, count: 2, done: 0, missed: 0 }, fitness: null }];
  const body = weekResponse({
    timeZone: 'America/Los_Angeles', today: '2026-10-20', mondays: ['2026-10-19', '2026-10-26'], now: NOW,
    range: {
      workouts: [
        workout({ id: 'b', sortOrder: 1, title: 'Second' }),
        workout({ id: 'a', sortOrder: 0, title: 'First', startTime: '18:00' }),
        workout({ id: 'c', date: '2026-10-25', title: 'Long ride', sport: 'ride', state: 'planned' }),
      ],
      summaries,
    },
    plans: new Map([['2026-10-19', { title: 'Build week 3' }]]),
    sports,
  });
  assert.equal(body.generatedAt, '2026-10-20T20:30:00.000Z');
  assert.equal(body.weeks.length, 2);
  const [w1, w2] = body.weeks;
  assert.deepEqual([w1.start, w1.title, w1.hasPlan, w2.title, w2.hasPlan], ['2026-10-19', 'Build week 3', true, null, false]);
  assert.deepEqual(w1.days.map((d) => d.date), ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
  assert.deepEqual(w1.days[1].items.map((i) => i.id), ['a', 'b']);
  assert.deepEqual(w1.days[6].items.map((i) => i.id), ['c']);
  assert.equal(w1.totals.plannedCount, 2);
  assert.equal(w2.totals.text, 'Nothing planned');
  assert.equal(w2.days.length, 7);
});

test('activities nothing matched are done items after the plan; a Lift session keeps the watch lift out', () => {
  const ride = { id: '901', date: '2026-10-13', sport: 'ride', name: 'Morning Ride', km: 30.44, min: 62, tss: 70 };
  const matchedRun = { id: '902', date: '2026-10-14', sport: 'run', name: 'Run', km: 8, min: 40, tss: 35 };
  const watchLift = { id: '903', date: '2026-10-15', sport: 'strength', name: 'Strength', km: 0, min: 50, tss: 20 };
  const body = weekResponse({
    timeZone: 'America/Los_Angeles', today: '2026-10-20', mondays: ['2026-10-12'], now: NOW,
    range: {
      workouts: [workout({ id: 'p', date: '2026-10-14', sport: 'run', state: 'done', match: { source: 'strava', id: '902', name: 'Run' } })],
      activities: [ride, matchedRun, watchLift],
      lifts: [{ id: 'L1', date: '2026-10-15', name: 'Workout C', setsLogged: 12 }],
      summaries: [],
    },
    plans: new Map(),
    sports,
  });
  const [w] = body.weeks;
  assert.deepEqual(w.days[1].items.map((i) => i.id), ['activity-901']);
  assert.deepEqual(w.days[2].items.map((i) => i.id), ['p']);
  assert.deepEqual(w.days[3].items, []);
  const item = w.days[1].items[0];
  assert.equal(item.unplanned, true);
  assert.equal(item.state, 'done');
  assert.equal(item.title, 'Morning Ride');
  assert.deepEqual(item.stats, { time: '1:02:00', distance: '30.4 km', tss: '70' });
  assert.equal(item.done.activityId, '901');
  assert.equal(w.days[2].items[0].unplanned, false);
});

test('a rest day reads "Rest" in every state but skipped', () => {
  for (const state of ['planned', 'today', 'done']) {
    const item = weekItem(workout({ title: 'Rest day', sport: 'rest', state, compliance: complianceOf({}, state, null, { rest: true }) }), sports);
    assert.equal(item.stateLabel, 'Rest');
    assert.equal(item.compliance, null);
  }
  assert.equal(weekItem(workout({ sport: 'rest', state: 'skipped', compliance: complianceOf({}, 'skipped', null, { rest: true }) }), sports).stateLabel, 'Not done');
});

test('stats: a clock, km with one decimal and whole TSS; planned distance from meters', () => {
  assert.equal(clockOf(90), '1:30:00');
  assert.equal(clockOf(0.5), '0:00:30');
  assert.deepEqual(statsOf({ minutes: 45, km: 8.04, tss: 39.6 }), { time: '0:45:00', distance: '8.0 km', tss: '40' });
  assert.deepEqual(statsOf({ minutes: null, km: null, tss: null }), { time: null, distance: null, tss: null });
  const run = weekItem(workout({ title: 'Easy run', sport: 'run', distance: 10000 }), sports);
  assert.equal(run.stats.distance, '10.0 km');
});
