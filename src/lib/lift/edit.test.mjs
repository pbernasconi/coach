import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planLiftEdit, planShape, stamp, toUnit } from './edit.mjs';

// Synthetic rows only.
const T0 = '2026-10-20T10:00:00.000Z';
const NOW = new Date('2026-10-20T12:00:00.000Z');
const S = 'AAAAAAAA-0000-4000-8000-000000000001';
const E1 = 'BBBBBBBB-0000-4000-8000-000000000001';
const E2 = 'BBBBBBBB-0000-4000-8000-000000000002';
const set = (id, ex, position, extra = {}) => ({
  id, sessionExerciseID: ex, position, kind: 'working', status: 'planned', unit: 'lb', loadMode: 'total',
  targetReps: 8, targetRepMin: null, targetRepMax: null, targetWeight: 100, actualReps: null, actualWeight: null,
  completedAt: null, note: null, createdAt: T0, updatedAt: T0, deletedAt: null, ...extra,
});
function rows() {
  return {
    session: { id: S, title: 'Lower', unitsAtLog: 'lb', finishedAt: null, updatedAt: T0, deletedAt: null },
    exercises: [
      { id: E1, sessionID: S, exerciseID: 'X1', displayName: 'Squat', position: 0, loadMode: 'total', note: null, updatedAt: T0, deletedAt: null },
      { id: E2, sessionID: S, exerciseID: 'X2', displayName: 'Row', position: 1, loadMode: 'perHand', note: null, updatedAt: T0, deletedAt: null },
    ],
    sets: [set('C1', E1, 0), set('C2', E1, 1), set('C3', E2, 0, { status: 'done', actualReps: 8, actualWeight: 50 })],
    library: [{ id: 'X9', name: 'Calf raise', loadMode: 'total', equipment: 'machine', deletedAt: null }],
  };
}
let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

test('a target change is an update with a newer updatedAt', () => {
  const r = planLiftEdit(rows(), [{ type: 'setTarget', setId: 'c1', weight: 110, reps: 6 }], { now: NOW });
  assert.equal(r.changes.length, 1);
  const c = r.changes[0];
  assert.deepEqual([c.entity, c.op, c.payload.targetWeight, c.payload.targetReps, c.payload.updatedAt], ['set', 'update', 110, 6, NOW.toISOString()]);
});

test('add a set copies the last working set; remove a set soft-deletes it', () => {
  const r = planLiftEdit(rows(), [{ type: 'addSet', sessionExerciseId: E1 }, { type: 'removeSet', setId: 'C1' }], { now: NOW, uuid });
  const add = r.changes.find((c) => c.op === 'insert');
  assert.deepEqual([add.payload.position, add.payload.targetWeight, add.payload.status, add.payload.sessionExerciseID], [2, 100, 'planned', E1]);
  assert.match(add.payload.id, /^[0-9A-F-]+$/);
  const del = r.changes.find((c) => c.op === 'delete');
  assert.equal(del.payload.deletedAt, NOW.toISOString());
});

test('move swaps positions; add exercise inserts it and its sets, parents first', () => {
  const r = planLiftEdit(rows(), [{ type: 'moveExercise', sessionExerciseId: E2, dir: -1 }, { type: 'addExercise', exerciseId: 'x9', sets: 3, reps: 12, weight: 90 }], { now: NOW, uuid });
  const moved = r.changes.filter((c) => c.entity === 'sessionExercise' && c.op === 'update').map((c) => [c.payload.displayName, c.payload.position]);
  assert.deepEqual(moved.sort(), [['Row', 0], ['Squat', 1]]);
  const added = r.changes.filter((c) => c.op === 'insert');
  assert.equal(added[0].entity, 'sessionExercise');
  assert.equal(added[0].payload.position, 2);
  assert.equal(added.filter((c) => c.entity === 'set').length, 3);
  const shape = planShape(rows().session, r.after.exercises, r.after.sets);
  assert.deepEqual(shape.exercises.map((e) => e.name), ['Row', 'Squat', 'Calf raise']);
});

test('logged sets, finished sessions and bad values are refused', () => {
  assert.ok(planLiftEdit(rows(), [{ type: 'setTarget', setId: 'C3', weight: 60 }], { now: NOW }).error);
  assert.ok(planLiftEdit(rows(), [{ type: 'removeExercise', sessionExerciseId: E2 }], { now: NOW }).error);
  assert.ok(planLiftEdit(rows(), [{ type: 'setTarget', setId: 'C1', reps: 0 }], { now: NOW }).error);
  const done = rows();
  done.session.finishedAt = T0;
  assert.ok(planLiftEdit(done, [{ type: 'setTarget', setId: 'C1', weight: 1 }], { now: NOW }).error);
  // A device clock ahead of now: the edit goes 1 ms past the row.
  assert.equal(stamp({ updatedAt: '2026-10-20T13:00:00.000Z' }, NOW), '2026-10-20T13:00:00.001Z');
});

test('a weight typed in kg is stored in the unit of the set (lb)', () => {
  const r = planLiftEdit(rows(), [{ type: 'setTarget', setId: 'C1', weight: 100, unit: 'kg' }], { now: NOW });
  assert.equal(r.changes[0].payload.targetWeight, 220.5);
  assert.equal(toUnit(100, 'lb', 'lb'), 100);
});
