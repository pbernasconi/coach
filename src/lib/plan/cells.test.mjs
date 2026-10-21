import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cellItems, dur, groupByWeek, sameItems, visibleChips, weekRows } from './cells.mjs';

test('dur', () => {
  assert.equal(dur(45), '45m');
  assert.equal(dur(60), '1:00');
  assert.equal(dur(125), '2:05');
  assert.equal(dur(null), '0m');
});

test('cellItems: planned first (sorted), matched activities only once', () => {
  const planned = [
    { id: 'b', sortOrder: 1, startTime: null, match: null },
    { id: 'a', sortOrder: 0, startTime: '07:00', match: { source: 'strava', id: 's1' } },
  ];
  const items = cellItems(planned, [{ id: 's1' }, { id: 's2' }], [{ id: 'l1' }]);
  assert.deepEqual(items.map((i) => i.key), ['w-a', 'w-b', 'a-s2', 'l-l1']);
  assert.deepEqual(items[0].actual, { id: 's1' });
  assert.equal(items[1].actual, null);
});

test('cellItems hides a Lift session matched to a plan workout', () => {
  const items = cellItems([{ id: 'w', sortOrder: 0, startTime: null, match: { source: 'lift', id: 'l1' } }], [], [{ id: 'l1' }]);
  assert.deepEqual(items.map((i) => i.key), ['w-w']);
});

test('cellItems shows a strength workout once when Lift and the watch both logged it', () => {
  const planned = [{ id: 'w', sortOrder: 0, startTime: null, match: { source: 'lift', id: 'l1', activityId: 'g1' } }];
  const items = cellItems(planned, [{ id: 'g1', sport: 'strength' }, { id: 'r1', sport: 'run' }], [{ id: 'l1' }]);
  assert.deepEqual(items.map((i) => i.key), ['w-w', 'a-r1']);
  assert.deepEqual(items[0].actual, { id: 'g1', sport: 'strength' });
});

test('cellItems pairs an unplanned Lift session with the watch strength activity of the day', () => {
  const items = cellItems([], [{ id: 'g1', sport: 'strength' }, { id: 'r1', sport: 'run' }], [{ id: 'l1' }]);
  assert.deepEqual(items.map((i) => i.key), ['a-r1', 'l-l1']);
  assert.deepEqual(items[1].a, { id: 'g1', sport: 'strength' });
  // Without a strength activity the Lift session stands alone.
  assert.equal(cellItems([], [{ id: 'r1', sport: 'run' }], [{ id: 'l1' }])[1].a, null);
});

test('visibleChips keeps the row height', () => {
  assert.deepEqual(visibleChips([1, 2, 3]), { shown: [1, 2, 3], more: 0 });
  assert.deepEqual(visibleChips([1, 2, 3, 4, 5]), { shown: [1, 2], more: 3 });
});

test('groupByWeek and sameItems', () => {
  const g = groupByWeek([{ date: '2026-10-19' }, { date: '2026-10-25' }, { date: '2026-10-26' }]);
  assert.deepEqual([...g.keys()], ['2026-10-19', '2026-10-26']);
  const x = {};
  assert.equal(sameItems([x], [x]), true);
  assert.equal(sameItems([x], [{}]), false);
});

test('weekRows reuses the row objects of weeks that did not change', () => {
  const w1 = { id: '1', date: '2026-10-20', sortOrder: 0, startTime: null, match: null };
  const s1 = { monday: '2026-10-19' };
  const s2 = { monday: '2026-10-26' };
  const data = { weeks: ['2026-10-19', '2026-10-26'], workouts: [w1], activities: [], lifts: [], summaries: [s1, s2] };
  const cache = new Map();
  const first = weekRows(data, cache);
  assert.equal(first[0].days[1].items[0].w, w1);
  assert.equal(first[0].days.length, 7);
  const w2 = { id: '2', date: '2026-10-27', sortOrder: 0, startTime: null, match: null };
  const s2b = { monday: '2026-10-26' };
  const second = weekRows({ ...data, workouts: [w1, w2], summaries: [s1, s2b] }, cache);
  assert.equal(second[0], first[0]); // unchanged week: same object
  assert.notEqual(second[1], first[1]);
  assert.equal(second[1].days[1].items[0].w, w2);
});

test('weekColumnMode hides empty weeks and shows plans for future weeks', async () => {
  const { weekColumnMode } = await import('./cells.mjs');
  const s = (monday, done = 0, plan = 0, fitness = null) => ({ monday, done: { count: done, liftSessions: 0, min: done * 60 }, planned: { count: plan }, fitness });
  const today = '2026-10-21';
  assert.equal(weekColumnMode(null, today), 'empty');
  assert.equal(weekColumnMode(s('2026-11-02'), today), 'empty');
  assert.equal(weekColumnMode(s('2026-11-02', 0, 3), today), 'planned');
  assert.equal(weekColumnMode(s('2026-10-19', 0, 0, { ctl: 60 }), today), 'done'); // this week: fitness so far
  assert.equal(weekColumnMode(s('2026-10-12', 2, 0), today), 'done');
  assert.equal(weekColumnMode(s('2025-01-06'), today), 'empty');
});
