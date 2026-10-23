import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionMuscles } from './session-stats.mjs';

const t = { reps: 5, repMin: null, weight: 50 };
const ex = (primary, statuses) => ({ primary, secondary: [], sets: statuses.map((status) => ({ kind: 'working', status, target: t })) });
const exercises = [ex(['back'], ['done', 'done']), ex(['shoulders'], ['planned', 'planned', 'skipped'])];

test('a finished session counts only done sets per muscle', () => {
  assert.deepEqual(sessionMuscles({ exercises, finishedAt: '2026-10-20T18:00:00Z' }), [{ muscle: 'back', sets: 2 }]);
});

test('an open session counts every set not skipped', () => {
  assert.deepEqual(sessionMuscles({ exercises, finishedAt: null }), [
    { muscle: 'back', sets: 2 },
    { muscle: 'shoulders', sets: 2 },
  ]);
});
