import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exerciseLine, intensityText, LIFT_MARKER, mergeDescription, planEntries } from './lift-plan.mjs';

const set = (o = {}) => ({ kind: 'working', reps: 8, repMin: null, repMax: null, weight: 100, unit: 'lb', status: 'planned', actualReps: null, actualWeight: null, ...o });
const squat = { name: 'Made-up squat', loadMode: 'total', sets: [set(), set(), set()] };

test('planEntries: plans, refreshes, removes skipped and forgotten sessions', () => {
  const rows = [
    { id: 'a', day: '2026-10-20', status: 'planned', liftTemplate: 'Lower', liftSessionId: null },
    { id: 'b', day: '2026-10-22', status: 'planned', liftTemplate: 'Upper', liftSessionId: 's2' },
    { id: 'c', day: '2026-10-23', status: 'skipped', liftTemplate: 'Upper', liftSessionId: 's3' },
  ];
  const entries = planEntries(rows, ['s2', 's3', 's4', 's5'], new Set(['s5']));
  assert.deepEqual(entries, [
    { key: 'a', day: '2026-10-20', template: 'Lower', sessionId: null },
    { key: 'b', day: '2026-10-22', template: 'Upper', sessionId: 's2' },
    { key: 'c', day: '2026-10-23', sessionId: 's3', remove: true },
    // s4 is in the ledger but no workout links it; s5 belongs to a past workout and stays.
    { key: 'ledger:s4', day: '1970-01-01', sessionId: 's4', remove: true },
  ]);
});

test('exerciseLine: same targets collapse; per hand and bodyweight loads', () => {
  assert.equal(exerciseLine(squat), 'Made-up squat 3 × 8 @ 100 lb');
  assert.equal(exerciseLine({ name: 'Press', loadMode: 'perHand', sets: [set({ weight: 30 })] }), 'Press 1 × 8 @ 30 lb each hand');
  assert.equal(
    exerciseLine({ name: 'Pull-up', loadMode: 'bodyweight', sets: [set({ reps: null, repMin: 8, repMax: 10, weight: 25 })] }),
    'Pull-up 1 × 8–10 +25 lb',
  );
  assert.equal(exerciseLine({ name: 'Plank', loadMode: 'bodyweight', sets: [set({ weight: null })] }), 'Plank 1 × 8');
  assert.equal(exerciseLine({ name: 'Mixed', loadMode: 'total', sets: [set(), set({ weight: 110 })] }), 'Mixed 8 @ 100 lb, 8 @ 110 lb');
});

test('exerciseLine: logged sets show what was done; warm-ups are left out', () => {
  const e = {
    name: 'Made-up squat',
    loadMode: 'total',
    sets: [set({ kind: 'warmUp', status: 'done', actualReps: 5, actualWeight: 45 }), set({ status: 'done', actualReps: 8, actualWeight: 100 }), set()],
  };
  assert.equal(exerciseLine(e), 'Made-up squat 8×100 (1/2 logged)');
});

test('mergeDescription keeps the coach note and replaces the old block', () => {
  const planned = { title: 'Lower', exercises: [squat] };
  const first = mergeDescription('Easy today.', planned);
  assert.equal(first, `Easy today.\n\n${LIFT_MARKER}\nTemplate: Lower\n- Made-up squat 3 × 8 @ 100 lb`);
  const again = mergeDescription(first, { title: 'Lower', exercises: [{ ...squat, sets: [set({ weight: 105 })] }] });
  assert.equal(again, `Easy today.\n\n${LIFT_MARKER}\nTemplate: Lower\n- Made-up squat 1 × 8 @ 105 lb`);
  assert.equal(mergeDescription(null, planned).startsWith(LIFT_MARKER), true);
});

test('intensityText', () => {
  assert.equal(intensityText({ title: 'Lower', exercises: [squat] }), 'Lower · 1 exercises · 3 sets · Made-up squat 3 × 8 @ 100 lb');
});
