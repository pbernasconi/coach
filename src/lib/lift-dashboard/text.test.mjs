import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTile } from './text.mjs';

const set = (o) => ({ status: 'done', weight: 92.5, reps: 5, target: { weight: 92.5, reps: 5, repMin: null, repMax: null }, ...o });

test('setTile flags a done set with fewer reps than the target', () => {
  assert.equal(setTile(set({ reps: 3 }), null, 'kg').missedReps, true);
  assert.equal(setTile(set({}), null, 'kg').missedReps, false);
});

test('setTile uses the low end of a rep range', () => {
  const range = { weight: 50, reps: null, repMin: 8, repMax: 12 };
  assert.equal(setTile(set({ weight: 50, reps: 8, target: range }), null, 'kg').missedReps, false);
  assert.equal(setTile(set({ weight: 50, reps: 7, target: range }), null, 'kg').missedReps, true);
});

test('setTile does not flag planned sets', () => {
  assert.equal(setTile(set({ status: 'planned', reps: null }), null, 'kg').missedReps, false);
});
