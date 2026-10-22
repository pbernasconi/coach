import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPlan, cleanRequest } from './proposal.mjs';

test('a request is cleaned to a Monday, and unknown answers become "decide from the data"', () => {
  assert.deepEqual(cleanRequest({ weekStart: '2026-10-29', feel: 'fresh', focus: 'dance', lock: '  keep bike club  ' }).value, {
    kind: 'weekly', weekStart: '2026-10-26', feel: 'fresh', focus: null, lock: 'keep bike club', hours: null, gym: null, daysOff: [],
  });
  const v = cleanRequest({ weekStart: '2026-10-26', hours: 8, gym: 9, daysOff: ['2026-10-30', '2026-11-04', 'x', '2026-10-30'] }).value;
  assert.equal(v.hours, 8);
  assert.equal(v.gym, null);
  assert.deepEqual(v.daysOff, ['2026-10-30']);
  assert.ok(cleanRequest({ weekStart: 'next week' }).error);
  assert.equal(cleanRequest({ kind: 'checkin', weekStart: '2026-10-26' }).value.kind, 'checkin');
});

const event = (over = {}) => ({
  title: '🚴 Threshold A', start: '2026-10-27T07:00:00', end: '2026-10-27T08:30:00', workoutType: 'ride-threshold-a',
  workout: { bank: 'threshold-a', level: 1 }, why: 'Rotation', description: 'Steady.', ...over,
});

test('a good plan passes and gives the rows the import writes', () => {
  const r = checkPlan({ weekStart: '2026-10-26', events: [event()], rest: [{ day: '2026-10-26', reason: 'Recovery' }] }, '2026-10-26');
  assert.deepEqual(r.errors, []);
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0].steps.bank, 'threshold-a');
  assert.ok(r.rows[0].tss > 0);
});

test('a plan for another week, a day outside the week, or an unknown bank workout is refused', () => {
  assert.match(checkPlan({ weekStart: '2026-11-02', events: [] }, '2026-10-26').errors[0], /weekStart/);
  assert.match(checkPlan({ weekStart: '2026-10-26', events: [event({ start: '2026-11-03T07:00:00', end: null })] }, '2026-10-26').errors[0], /not in the week/);
  assert.match(checkPlan({ weekStart: '2026-10-26', events: [event({ workout: { bank: 'made-up' } })] }, '2026-10-26').errors[0], /made-up/);
  assert.match(checkPlan(null, '2026-10-26').errors[0], /JSON/);
});
