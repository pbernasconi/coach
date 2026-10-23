import { test } from 'node:test';
import assert from 'node:assert/strict';
import { equipmentOf, findInLibrary, nameKey, planSessionChanges } from './plan-session.mjs';
import { strengthExercises } from '../plan/strength-text.mjs';

// Synthetic rows only.
const NOW = new Date('2026-10-23T20:00:00.000Z');
let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const library = [
  { id: 'L1', name: 'Standing Calf Raise', aliases: '[]', equipment: 'bodyweight', loadMode: 'bodyweight', isArchived: 0, deletedAt: null },
  { id: 'M1', name: 'Seated calf raise', aliases: '[]', equipment: 'machine', loadMode: 'total', isArchived: 0, deletedAt: null },
  { id: 'L2', name: 'Romanian deadlift', aliases: JSON.stringify(['rdl']), equipment: 'barbell', loadMode: 'total', isArchived: 0, deletedAt: null },
];
const TEXT = `Achilles, at home, bodyweight on a step. One time only.
1) Standing calf raise 3x15: 3 s up, 3 s down, full range (heels below the step). Too easy: 3x8 on one leg.
2) Bent-knee calf raise 3x15 (soleus): back on a wall, knees bent about 30°, same tempo.
90 s rest.`;

test('names match by words, plurals and aliases', () => {
  assert.equal(nameKey('Standing calf-raises'), nameKey('standing calf raise'));
  assert.equal(findInLibrary('standing calf raises', library)?.id, 'L1');
  assert.equal(findInLibrary('RDL', library)?.id, 'L2');
  assert.equal(findInLibrary('Bent-knee calf raise', library), null);
  // A bodyweight line never takes the gym's loaded exercise of the same name.
  assert.equal(findInLibrary('Seated calf raise', library), null);
  assert.deepEqual(equipmentOf('Dumbbell row'), { equipment: 'dumbbell', loadMode: 'perHand' });
  assert.deepEqual(equipmentOf('Bent-knee calf raise'), { equipment: 'bodyweight', loadMode: 'bodyweight' });
});

test('the home calf session becomes a Lift session: library first, a new exercise for the rest', () => {
  const exercises = strengthExercises(TEXT);
  const r = planSessionChanges({ title: 'Home calf raises', day: '2026-10-22', unit: 'lb', exercises, library, now: NOW, uuid, catalogId: () => null });
  assert.ok(!('error' in r));
  assert.deepEqual(r.changes.map((c) => c.entity), ['exercise', 'session', 'sessionExercise', 'sessionExercise', 'set', 'set', 'set', 'set', 'set', 'set']);
  const [newEx, session, se1, se2] = r.changes.map((c) => c.payload);
  assert.deepEqual([newEx.name, newEx.loadMode, newEx.equipment], ['Bent-knee calf raise', 'bodyweight', 'bodyweight']);
  assert.deepEqual([session.id, session.day, session.title, session.startedAt, session.unitsAtLog], [r.sessionId, '2026-10-22', 'Home calf raises', null, 'lb']);
  assert.deepEqual([se1.exerciseID, se1.displayName, se1.sessionID], ['L1', 'Standing calf raise', r.sessionId]);
  assert.equal(se2.exerciseID, newEx.id);
  assert.match(se2.note, /^Soleus\./);
  const sets = r.changes.filter((c) => c.entity === 'set').map((c) => c.payload);
  assert.deepEqual(sets.map((s) => [s.targetReps, s.status, s.sessionExerciseID === se1.id ? 1 : 2]), [[15, 'planned', 1], [15, 'planned', 1], [15, 'planned', 1], [15, 'planned', 2], [15, 'planned', 2], [15, 'planned', 2]]);
  assert.ok(r.changes.every((c) => c.op === 'insert' && c.payload.updatedAt === NOW.toISOString()));
});

test('rep ranges, repeated names and no exercises', () => {
  const exercises = [
    { name: 'Split squat', sets: 2, reps: 8, repsMax: 10, note: null },
    { name: 'split squats', sets: 1, reps: 12, repsMax: null, note: null },
  ];
  const r = planSessionChanges({ title: 'Legs', day: '2026-10-22', unit: 'kg', exercises, library: [], now: NOW, uuid });
  assert.equal(r.changes.filter((c) => c.entity === 'exercise').length, 1);
  const sets = r.changes.filter((c) => c.entity === 'set').map((c) => c.payload);
  assert.deepEqual(sets.map((s) => [s.targetReps, s.targetRepMin, s.targetRepMax, s.unit]), [[null, 8, 10, 'kg'], [null, 8, 10, 'kg'], [12, null, null, 'kg']]);
  assert.ok('error' in planSessionChanges({ title: 'x', day: '2026-10-22', unit: 'lb', exercises: [], library: [] }));
  assert.ok('error' in planSessionChanges({ title: 'x', day: '', unit: 'lb', exercises, library: [] }));
});
