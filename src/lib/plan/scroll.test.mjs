import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chunkAfter, chunkBefore, chunkToReach, earliestBound, firstWeekOfMonth, initialRange, mergeRange, monthEdges, monthOfWeek,
  spanWeeks, startWeek,
} from './scroll.mjs';

test('monthOfWeek uses the Thursday', () => {
  assert.equal(monthOfWeek('2026-09-28'), '2026-10'); // Thu Oct 1
  assert.equal(monthOfWeek('2026-10-26'), '2026-10'); // Thu Oct 29
  assert.equal(monthOfWeek('2026-11-30'), '2026-12'); // Thu Dec 3
  assert.equal(monthOfWeek('2026-12-28'), '2026-12'); // Thu Dec 31
});

test('firstWeekOfMonth and startWeek', () => {
  assert.equal(firstWeekOfMonth('2026-10'), '2026-09-28');
  assert.equal(firstWeekOfMonth('2026-11'), '2026-11-02'); // Nov 1 is a Sunday: its week belongs to October
  assert.equal(startWeek('2026-11', '2026-10-21'), '2026-11-02');
  assert.equal(startWeek(undefined, '2026-10-21'), '2026-10-19');
  assert.equal(startWeek('2026-13', '2026-10-21'), '2026-10-19');
});

test('earliestBound is the Monday of the first data day', () => {
  assert.equal(earliestBound('2025-03-06'), '2025-03-03');
  assert.equal(earliestBound(null), null);
  assert.equal(earliestBound('bad'), null);
});

test('initialRange: ±4 weeks, clamped to the earliest data', () => {
  assert.deepEqual(initialRange('2026-10-19', '2020-01-01'), { from: '2026-09-21', to: '2026-11-16' });
  assert.deepEqual(initialRange('2026-10-19', '2026-10-07'), { from: '2026-10-05', to: '2026-11-16' });
  // Earliest data after the start week: start there anyway.
  assert.deepEqual(initialRange('2026-10-19', '2026-12-01'), { from: '2026-10-19', to: '2026-11-16' });
  assert.deepEqual(initialRange('2026-10-19', null), { from: '2026-09-21', to: '2026-11-16' });
});

test('chunkBefore stops at the earliest data', () => {
  assert.deepEqual(chunkBefore('2026-09-21', '2020-01-01'), { from: '2026-07-27', to: '2026-09-14' });
  assert.deepEqual(chunkBefore('2026-09-21', '2026-08-26'), { from: '2026-08-24', to: '2026-09-14' });
  assert.equal(chunkBefore('2026-08-24', '2026-08-26'), null);
  assert.equal(chunkBefore('2026-09-21', null), null);
});

test('chunkAfter has no limit', () => {
  assert.deepEqual(chunkAfter('2026-11-16'), { from: '2026-11-23', to: '2027-01-11' });
  assert.equal(spanWeeks('2026-11-23', '2027-01-11'), 8);
});

test('chunkToReach loads up to the target week, with padding', () => {
  assert.equal(chunkToReach('2026-10-05', '2026-09-21', '2026-11-16', '2020-01-01'), null);
  assert.deepEqual(chunkToReach('2026-12-28', '2026-09-21', '2026-11-16', null), { from: '2026-11-23', to: '2027-01-11' });
  assert.deepEqual(chunkToReach('2026-08-31', '2026-09-21', '2026-11-16', '2020-01-01'), { from: '2026-08-17', to: '2026-09-14' });
  assert.deepEqual(chunkToReach('2026-08-31', '2026-09-21', '2026-11-16', '2026-09-02'), { from: '2026-08-31', to: '2026-09-14' });
  assert.equal(chunkToReach('2026-08-31', '2026-09-21', '2026-11-16', '2026-09-25'), null);
  const far = chunkToReach('2020-01-06', '2026-09-21', '2026-11-16', '2019-01-01');
  assert.equal(spanWeeks(far.from, far.to), 26);
});

test('mergeRange replaces the fresh weeks and keeps the others', () => {
  const base = {
    today: '2026-10-21',
    weeks: ['2026-10-12', '2026-10-19'],
    workouts: [{ id: 'a', date: '2026-10-13' }, { id: 'b', date: '2026-10-20' }],
    activities: [{ id: 'x', date: '2026-10-20' }],
    lifts: [],
    summaries: [{ monday: '2026-10-12', n: 1 }, { monday: '2026-10-19', n: 1 }],
  };
  const fresh = {
    today: '2026-10-21',
    weeks: ['2026-10-19', '2026-10-26'],
    workouts: [{ id: 'c', date: '2026-10-21' }],
    activities: [],
    lifts: [{ id: 'l', date: '2026-10-27' }],
    summaries: [{ monday: '2026-10-19', n: 2 }, { monday: '2026-10-26', n: 3 }],
  };
  const m = mergeRange(base, fresh);
  assert.deepEqual(m.weeks, ['2026-10-12', '2026-10-19', '2026-10-26']);
  assert.deepEqual(m.workouts.map((w) => w.id), ['a', 'c']);
  assert.deepEqual(m.activities, []);
  assert.deepEqual(m.lifts.map((l) => l.id), ['l']);
  assert.deepEqual(m.summaries.map((s) => s.n), [1, 2, 3]);
});

test('monthEdges steps along the first week of a month', () => {
  assert.deepEqual(monthEdges('2026-10-01'), { top: true, left: true, odd: false }); // Thursday the 1st
  assert.deepEqual(monthEdges('2026-10-07'), { top: true, left: false, odd: false }); // a week after Sep 30
  assert.deepEqual(monthEdges('2026-10-08'), { top: false, left: false, odd: false });
  assert.deepEqual(monthEdges('2026-11-02'), { top: true, left: false, odd: true }); // Monday: no left edge
  assert.equal(monthEdges('2026-06-01').left, false); // the 1st on a Monday
});
