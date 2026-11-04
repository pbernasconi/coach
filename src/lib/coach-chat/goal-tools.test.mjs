import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanEventChange, cleanGoalChange, cleanWeekPlan, eventChangeText, goalChangeText, goalsText, weekPlanText } from './goal-tools.mjs';
import { cardOf, checkProposalInput, describeChanges, recheck, undoPlan } from './changes.mjs';

const today = '2026-11-03';
const events = [
  { id: 'ev1', name: 'Oakland Half', date: '2027-03-22', priority: 'A', sport: 'run', notes: null, target: 'sub 1:45' },
  { id: 'ev0', name: 'Old race', date: '2026-05-01', priority: 'B', sport: 'run', notes: null, target: null },
];
const goals = [{ id: 'g1', kind: 'vo2max', target: 55, baseline: 50, start: '2026-10-01', deadline: '2027-06-01' }];

test('events: add, update and remove are checked against his events', () => {
  const add = cleanEventChange({ op: 'event', name: 'Marin Century', date: '2027-05-02', priority: 'b', sport: 'ride' }, { events, today });
  assert.ok('change' in add);
  assert.deepEqual(add.change.event, { name: 'Marin Century', date: '2027-05-02', priority: 'B', sport: 'ride', notes: null, target: null });
  assert.match(eventChangeText(add.change), /Sun 2 May 2027 · B priority/);
  assert.match(cleanEventChange({ name: 'X', date: '2026-01-01' }, { events, today }).problem, /past/);
  assert.match(cleanEventChange({ name: 'oakland half', date: '2027-03-22' }, { events, today }).problem, /already an event \(id ev1\)/);
  assert.match(cleanEventChange({ name: 'X', date: '2027-01-01', sport: 'chess' }, { events, today }).problem, /sport/);
  const upd = cleanEventChange({ id: 'ev1', date: '2027-03-29', target: 'sub 1:40' }, { events, today });
  assert.ok('change' in upd);
  assert.equal(upd.change.action, 'update');
  assert.equal(eventChangeText(upd.change), 'Mon 22 Mar 2027 → Mon 29 Mar 2027 · target sub 1:40');
  assert.match(cleanEventChange({ id: 'ev1', priority: 'A' }, { events, today }).problem, /nothing to change/);
  assert.match(cleanEventChange({ id: 'nope', action: 'remove' }, { events, today }).problem, /get_goals/);
  const rm = cleanEventChange({ id: 'ev1', action: 'remove' }, { events, today });
  assert.ok('change' in rm && rm.change.was?.name === 'Oakland Half');
});

test('goals: a pace target as text, a baseline for a new goal, updates keep the rest', () => {
  const add = cleanGoalChange({ kind: 'run_10k_pace', target: '4:30', baseline: '4:55', deadline: '2027-06-01' }, { goals, today });
  assert.ok('change' in add);
  assert.equal(add.change.goal?.target, 270);
  assert.equal(add.change.goal?.start, today);
  assert.match(goalChangeText(add.change), /4:30\/km by/);
  assert.match(cleanGoalChange({ kind: 'run_10k_pace', target: '4:30', deadline: '2027-06-01' }, { goals, today }).problem, /baseline/);
  assert.match(cleanGoalChange({ kind: 'marathon', target: 1 }, { goals, today }).problem, /event/);
  const upd = cleanGoalChange({ id: 'g1', target: 57 }, { goals, today });
  assert.ok('change' in upd);
  assert.deepEqual(upd.change.goal, { ...goals[0], target: 57 });
  assert.match(goalChangeText(upd.change), /target 55 → 57/);
  assert.match(cleanGoalChange({ id: 'g1', target: 55 }, { goals, today }).problem, /nothing to change/);
});

test('plan_week: the planner request for a week up to seven ahead, days inside it', () => {
  const w = cleanWeekPlan({ week: '2026-11-11', away: ['2026-11-10', '2026-11-11', '2026-11-12'], hours: 8, gym: 2, note: 'Hotel gym in NYC' }, { today });
  assert.ok('change' in w);
  assert.equal(w.change.request.weekStart, '2026-11-09');
  assert.deepEqual(w.change.request.away, ['2026-11-10', '2026-11-11', '2026-11-12']);
  assert.equal(w.change.request.lock, 'Hotel gym in NYC');
  assert.equal(w.change.request.kind, undefined);
  assert.equal(weekPlanText(w.change), 'Coach drafts it; you accept it on Plan · away Tue–Thu · 8 h · 2 lifts · "Hotel gym in NYC"');
  assert.match(cleanWeekPlan({ week: '2026-10-20' }, { today }).problem, /this week up to/);
  assert.match(cleanWeekPlan({ week: '2027-02-01' }, { today }).problem, /this week up to/);
  assert.match(cleanWeekPlan({ week: '2026-11-09', away: ['2026-11-20'] }, { today }).problem, /days of the week/);
});

test('get_goals lists events with ids, countdowns and the goal kinds', () => {
  const text = goalsText(events, [{ ...goals[0], title: 'VO2 max 55', current: 52, progress: 0.4, status: 'on_track', daysLeft: 210, detail: [] }], today);
  assert.match(text, /- id ev1: Oakland Half, Mon 22 Mar 2027 \(2027-03-22\), priority A, .*target sub 1:45/);
  assert.match(text, /Past events/);
  assert.match(text, /- id g1: \*\*VO2 max 55\*\*/);
  assert.match(text, /run_10k_pace \(10k pace, min\/km\)/);
});

test('the card: events, goals and a week plan, past the rule checks, and Undo always runs them', () => {
  const plan = { rows: [], today, templates: [], goals: { events, goals } };
  const r = checkProposalInput({
    title: 'Race and week', why: 'Based on what you said',
    changes: [
      { op: 'event', name: 'Marin Century', date: '2027-05-02', priority: 'B', sport: 'ride' },
      { op: 'goal', id: 'g1', target: 57 },
      { op: 'plan_week', week: '2026-11-09', away: ['2026-11-10'] },
    ],
  }, plan, 1);
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(r.value.card.days.map((d) => d.label), ['Week of 9 Nov', 'Races and goals']);
  assert.deepEqual(r.value.card.days[1].rows.map((x) => x.tag), ['Added', 'Changed']);
  assert.deepEqual(describeChanges(r.value.changes, []).map((i) => i.kind), ['added', 'changed', 'added']);
  assert.match(cardOf(r.value.changes, []).summary, /^3 changes$/);
  // Apply's recheck has no goals context: the checked changes go through as they are.
  assert.deepEqual(recheck(r.value.changes, { rows: [], today }, []), []);
  const two = checkProposalInput({ title: 'T', why: 'W', changes: [{ op: 'plan_week', week: '2026-11-09' }, { op: 'plan_week', week: '2026-11-16' }] }, plan, 1);
  assert.equal(two.ok, false);
  const steps = [{ op: 'event', id: 'x', before: null }, { op: 'goal', id: 'g1', before: null }, { op: 'plan_week', proposalId: 'p', revised: false }];
  assert.equal(undoPlan(steps, {}, []).run.length, 3);
});
