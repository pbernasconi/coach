import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildModel, muscleSets, topLifts } from './stats.mjs';

const SQUAT = 'AAAAAAAA-0000-0000-0000-000000000001';
const ROW = 'AAAAAAAA-0000-0000-0000-000000000002';

function data() {
  const exercises = [
    { id: SQUAT, name: 'Back squat', primaryMuscles: '["quads","glutes"]', secondaryMuscles: '["hamstrings"]', deletedAt: null },
    { id: ROW, name: 'Row', primaryMuscles: ['lats'], secondaryMuscles: [], deletedAt: null },
  ];
  const sessions = [
    { id: 's1', day: '2026-10-13', title: 'Heavy', deletedAt: null },
    { id: 's2', day: '2026-10-20', title: 'Heavy', deletedAt: null },
  ];
  const sessionExercises = [
    { id: 'e1', sessionID: 's1', exerciseID: SQUAT, displayName: 'Back squat', deletedAt: null },
    { id: 'e2', sessionID: 's2', exerciseID: SQUAT, displayName: 'Back squat', deletedAt: null },
    { id: 'e3', sessionID: 's2', exerciseID: ROW, displayName: 'Row', deletedAt: null },
    { id: 'e4', sessionID: 's2', exerciseID: null, displayName: 'Plank', deletedAt: null },
  ];
  const set = (id, se, reps, weight, extra = {}) => ({
    id, sessionExerciseID: se, actualReps: reps, actualWeight: weight, unit: 'kg', kind: 'working', status: 'done', deletedAt: null, ...extra,
  });
  const sets = [
    set('a', 'e1', 5, 100),
    set('b', 'e1', 5, 100),
    set('c', 'e2', 5, 110),
    set('d', 'e2', 5, 110),
    set('w', 'e2', 5, 60, { kind: 'warmUp' }),
    set('p', 'e2', 5, 115, { status: 'planned' }),
    set('r', 'e3', 10, 50),
    set('k', 'e4', 1, 0),
  ];
  return { exercises, sessions, sessionExercises, sets };
}

test('muscleSets counts done working sets: 1 per primary, 0.5 per secondary', () => {
  const m = buildModel(data());
  const week = Object.fromEntries(muscleSets(m, '2026-10-19', '2026-10-25').map((x) => [x.muscle, x.sets]));
  // Warm-ups, planned sets and exercises without library muscles do not count.
  assert.deepEqual(week, { glutes: 2, quads: 2, lats: 1, hamstrings: 1 });
  assert.equal(muscleSets(m, '2026-10-19', '2026-10-25')[0].status, 'below');
});

test('topLifts ranks by sessions and gives the e1RM change', () => {
  const m = buildModel(data());
  const [squat, row] = topLifts(m, 'kg', '2026-10-01');
  assert.equal(squat.name, 'Back squat');
  assert.equal(squat.sessions, 2);
  assert.ok(squat.change > 0.09 && squat.change < 0.11); // 100 -> 110 kg at 5 reps
  assert.equal(row.change, null); // one session: no trend yet
  assert.deepEqual(topLifts(m, 'kg', '2026-10-21'), []);
});
