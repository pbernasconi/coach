import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noonIn, planLiftEdit, planShape, stamp, toUnit } from './edit.mjs';

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

test('reset takes a finished session back to planned: sets planned with no actuals, no start or finish', () => {
  const r0 = rows();
  r0.session = { ...r0.session, startedAt: T0, finishedAt: T0 };
  r0.sets.push(set('C4', E2, 1, { status: 'skipped', completedAt: T0 }));
  const r = planLiftEdit(r0, [{ type: 'resetSession' }], { now: NOW });
  assert.deepEqual(r.changes.map((c) => [c.entity, c.op, String(c.payload.id)]), [['session', 'update', S], ['set', 'update', 'C3'], ['set', 'update', 'C4']]);
  assert.deepEqual([r.changes[0].payload.startedAt, r.changes[0].payload.finishedAt, r.changes[0].payload.title], [null, null, 'Lower']);
  const c3 = r.changes[1].payload;
  assert.deepEqual([c3.status, c3.completedAt, c3.actualReps, c3.actualWeight, c3.targetWeight, c3.updatedAt], ['planned', null, null, null, 100, NOW.toISOString()]);
  assert.equal(r.after.sets.every((s) => s.status === 'planned'), true);
});

test('reset of a session with nothing logged changes nothing; reset mixed with other edits is refused', () => {
  const r0 = rows();
  r0.sets = r0.sets.filter((s) => s.status === 'planned');
  assert.deepEqual(planLiftEdit(r0, [{ type: 'resetSession' }], { now: NOW }).changes, []);
  assert.match(planLiftEdit(rows(), [{ type: 'resetSession' }, { type: 'addSet', sessionExerciseId: E1 }], { now: NOW }).error, /on its own/);
});

test('un-log a set puts it back to planned; the last one also clears the start and finish', () => {
  const started = rows();
  Object.assign(started.session, { startedAt: T0, finishedAt: T0 });
  const r = planLiftEdit(started, [{ type: 'unlogSet', setId: 'c3' }], { now: NOW });
  assert.deepEqual(r.changes.map((c) => c.entity), ['session', 'set']);
  const s3 = r.changes[1].payload;
  assert.deepEqual([s3.status, s3.completedAt, s3.actualReps], ['planned', null, 8]);
  assert.deepEqual([r.changes[0].payload.startedAt, r.changes[0].payload.finishedAt], [null, null]);
});

test('un-logging one of two logged sets keeps the session started; un-log goes alone', () => {
  const two = rows();
  two.session.startedAt = T0;
  two.sets[0] = set('C1', E1, 0, { status: 'done' });
  const r = planLiftEdit(two, [{ type: 'unlogSet', setId: 'C3' }], { now: NOW });
  assert.deepEqual(r.changes.map((c) => c.entity), ['set']);
  assert.ok(planLiftEdit(two, [{ type: 'unlogSet', setId: 'C3' }, { type: 'addSet', sessionExerciseId: E1 }], { now: NOW }).error);
  assert.ok(planLiftEdit(two, [{ type: 'unlogSet', setId: 'nope' }], { now: NOW }).error);
});

test('logSet logs reps (target weight by default) and starts and finishes the session', () => {
  const r = planLiftEdit(rows(), [{ type: 'logSet', setId: 'c1', reps: 20 }, { type: 'logSet', setId: 'C2', reps: 18, weight: 45, unit: 'kg' }], { now: NOW, today: '2026-10-20' });
  const sets = r.changes.filter((c) => c.entity === 'set').map((c) => [c.payload.id, c.payload.status, c.payload.actualReps, c.payload.actualWeight, c.payload.completedAt]);
  assert.deepEqual(sets, [['C1', 'done', 20, 100, NOW.toISOString()], ['C2', 'done', 18, 99.2, NOW.toISOString()]]);
  const session = r.changes.find((c) => c.entity === 'session');
  assert.equal(r.changes[0].entity, 'session');
  assert.deepEqual([session.payload.startedAt, session.payload.finishedAt], [NOW.toISOString(), NOW.toISOString()]);
});

test('logSet on a past day stamps the session day, works on a finished session, refuses bad reps', () => {
  const past = rows();
  past.session.day = '2026-10-19';
  const r = planLiftEdit(past, [{ type: 'logSet', setId: 'C1', reps: 20, weight: null }], { now: NOW, today: '2026-10-20' });
  const set = r.changes.find((c) => c.entity === 'set').payload;
  assert.deepEqual([set.actualWeight, set.completedAt], [null, '2026-10-19T12:00:00.000Z']);
  assert.equal(r.changes.find((c) => c.entity === 'session').payload.finishedAt, '2026-10-19T12:00:00.000Z');
  const done = rows();
  done.session.startedAt = T0;
  done.session.finishedAt = T0;
  const again = planLiftEdit(done, [{ type: 'logSet', setId: 'C2', reps: 5 }], { now: NOW });
  assert.deepEqual(again.changes.map((c) => c.entity), ['set']);
  assert.ok(planLiftEdit(rows(), [{ type: 'logSet', setId: 'C1', reps: 0 }], { now: NOW }).error);
  assert.ok(planLiftEdit(rows(), [{ type: 'logSet', setId: 'nope', reps: 5 }], { now: NOW }).error);
  assert.ok(planLiftEdit(rows(), [{ type: 'logSet', setId: 'C1', reps: 5 }, { type: 'addSet', sessionExerciseId: E1 }], { now: NOW }).error);
});

test('logSet leaves a session in progress on the phone today running', () => {
  const live = rows();
  live.session.day = '2026-10-20';
  live.session.startedAt = T0;
  const r = planLiftEdit(live, [{ type: 'logSet', setId: 'C1', reps: 8 }], { now: NOW, today: '2026-10-20' });
  assert.deepEqual(r.changes.map((c) => c.entity), ['set']);
});

test('noonIn is local noon of the day', () => {
  assert.equal(noonIn('2026-10-22', 'America/Los_Angeles'), '2026-10-22T19:00:00.000Z');
  assert.equal(noonIn('2026-12-22', 'America/Los_Angeles'), '2026-12-22T20:00:00.000Z');
  assert.equal(noonIn('2026-10-22', 'Europe/Zurich'), '2026-10-22T10:00:00.000Z');
  assert.equal(noonIn('2026-10-22', 'Not/AZone'), '2026-10-22T12:00:00.000Z');
});
