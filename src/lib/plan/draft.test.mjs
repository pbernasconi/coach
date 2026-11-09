import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffPlans, editPlan, gaveUp, lengthOf } from './draft.mjs';

const plan = {
  weekStart: '2026-11-02',
  events: [
    { title: 'Threshold A', start: '2026-11-04T08:15:00', end: '2026-11-04T09:30:00', tss: 80 },
    { title: 'Easy run', start: '2026-11-06T17:00:00', end: '2026-11-06T17:40:00' },
    { title: 'Long run', start: '2026-11-07T09:00:00', end: '2026-11-07T10:25:00' },
  ],
};

test('move keeps the length and the other sessions', () => {
  const r = editPlan(plan, { kind: 'move', index: 0, date: '2026-11-05', time: '17:00' });
  assert.ok('plan' in r);
  assert.equal(r.plan.events[0].start, '2026-11-05T17:00:00');
  assert.equal(r.plan.events[0].end, '2026-11-05T18:15:00');
  assert.equal(r.plan.events[1], plan.events[1]);
  assert.equal(plan.events[0].start, '2026-11-04T08:15:00', 'the input is not changed');
});

test('move refuses a day outside the week and a time past midnight', () => {
  assert.ok('error' in editPlan(plan, { kind: 'move', index: 0, date: '2026-11-09', time: '08:00' }));
  assert.ok('error' in editPlan(plan, { kind: 'move', index: 0, date: '2026-11-05', time: '23:00' }));
  assert.ok('error' in editPlan(plan, { kind: 'move', index: 7, date: '2026-11-05', time: '08:00' }));
});

test('length changes the end and scales the TSS', () => {
  const r = editPlan(plan, { kind: 'length', index: 0, minutes: 60 });
  assert.ok('plan' in r);
  assert.equal(r.plan.events[0].end, '2026-11-04T09:15:00');
  assert.equal(r.plan.events[0].tss, 64);
  assert.equal(lengthOf(r.plan.events[0]), 60);
});

test('remove drops the session', () => {
  const r = editPlan(plan, { kind: 'remove', index: 1 });
  assert.ok('plan' in r);
  assert.deepEqual(r.plan.events.map((e) => e.title), ['Threshold A', 'Long run']);
});

test('diff names removed, longer and moved sessions, and what was given up', () => {
  const b = {
    weekStart: '2026-11-02',
    events: [
      { title: 'Threshold A', start: '2026-11-05T08:15:00', end: '2026-11-05T09:30:00' },
      { title: 'Long run', start: '2026-11-07T09:00:00', end: '2026-11-07T10:30:00' },
    ],
  };
  const d = diffPlans(plan, b);
  assert.deepEqual(d.changed, [
    { what: 'Threshold A', how: 'Wed → Thu 08:15' },
    { what: 'Fri Easy run', how: 'removed' },
    { what: 'Sat Long run', how: '1h25 → 1h30' },
  ]);
  assert.equal(d.minutesBefore - d.minutesAfter, 35);
  assert.equal(gaveUp(d), '35 min of the week and Easy run');
  assert.equal(gaveUp(diffPlans(plan, plan)), null);
});

test('a move takes the zone of the day it lands on', () => {
  const plan = { weekStart: '2026-11-09', events: [{ title: 'Run', start: '2026-11-11T06:30:00', end: '2026-11-11T07:25:00', timeZone: 'America/New_York' }] };
  const zurich = editPlan(plan, { kind: 'move', index: 0, date: '2026-11-14', time: '09:30', timeZone: 'Europe/Zurich' });
  assert.equal(zurich.plan.events[0].timeZone, 'Europe/Zurich');
  const home = editPlan(plan, { kind: 'move', index: 0, date: '2026-11-09', time: '06:30', timeZone: 'America/Los_Angeles' });
  assert.equal('timeZone' in home.plan.events[0], false);
  const kept = editPlan(plan, { kind: 'move', index: 0, date: '2026-11-12', time: '07:00' });
  assert.equal(kept.plan.events[0].timeZone, 'America/New_York');
});
