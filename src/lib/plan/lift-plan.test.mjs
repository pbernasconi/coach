import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blockExercises, exerciseLine, pickTemplate, intensityText, LIFT_MARKER, mergeDescription, planEntries } from './lift-plan.mjs';

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

test('a session started from a text workout (no template) is kept unless skipped', () => {
  const rows = [
    { id: 'w1', day: '2026-10-24', status: 'planned', liftTemplate: null, liftSessionId: 'started' },
    { id: 'w2', day: '2026-10-25', status: 'skipped', liftTemplate: null, liftSessionId: 'skippedOne' },
    { id: 'w3', day: '2026-10-26', status: 'planned', liftTemplate: null, liftSessionId: 'fromTemplate' },
  ];
  const entries = planEntries(rows, ['fromTemplate']);
  assert.deepEqual(entries.map((e) => [e.key, e.remove ?? false]), [['w2', true], ['w3', true]]);
});

test('blockExercises: the planned lines of the generated block, with their loads', () => {
  const text = `Squat first.\n\n${LIFT_MARKER}\nTemplate: Heavy barbell\n- Back squat 3 × 5 @ 255 lb\n- Deadlift 5 @ 275 lb, 3 @ 295 lb\n` +
    '- Pull-up 3 × 8 +25 lb\n- Plank 3 × 45\n- Curl 3 × 10–12 @ 30 lb each hand\n- Bench 8×185, 8×185 (2/3 logged)';
  assert.deepEqual(blockExercises(text), [
    { name: 'Back squat', sets: 3, reps: 5, repsMax: null, note: '255 lb' },
    { name: 'Deadlift', sets: 2, reps: 5, repsMax: null, note: '5 @ 275 lb, 3 @ 295 lb' },
    { name: 'Pull-up', sets: 3, reps: 8, repsMax: null, note: '+25 lb' },
    { name: 'Plank', sets: 3, reps: 45, repsMax: null, note: null },
    { name: 'Curl', sets: 3, reps: 10, repsMax: 12, note: '30 lb each hand' },
  ]);
  assert.deepEqual(blockExercises('Squat 3x5'), []);
  assert.deepEqual(blockExercises(null), []);
});

test('blockExercises reads what sessionBlock writes', () => {
  const planned = { title: 'Heavy barbell', exercises: [
    { name: 'Back squat', loadMode: 'total', sets: [1, 2, 3].map(() => ({ kind: 'working', reps: 5, repMin: null, repMax: null, weight: 255, unit: 'lb', status: 'planned', actualReps: null, actualWeight: null })) },
  ] };
  assert.deepEqual(blockExercises(mergeDescription('Go.', planned)), [{ name: 'Back squat', sets: 3, reps: 5, repsMax: null, note: '255 lb' }]);
});

test('pickTemplate: stored template, summary, title, then workout type; never a home session', () => {
  const names = ['Heavy barbell', 'Upper (dumbbells)', 'Hotel gym (dumbbells)'];
  const lift = (over) => pickTemplate({ sport: 'strength', workoutType: null, liftTemplate: null, intensity: null, title: '', ...over }, names);
  assert.equal(lift({ liftTemplate: 'upper (dumbbells)' }), 'Upper (dumbbells)');
  assert.equal(lift({ intensity: 'Heavy barbell · 9 exercises · 25 sets · Back squat 3 × 5 @ 255 lb' }), 'Heavy barbell');
  assert.equal(lift({ title: '🏋️ Heavy barbell lift' }), 'Heavy barbell');
  assert.equal(lift({ title: 'Hotel gym (dumbbells) session' }), 'Hotel gym (dumbbells)');
  assert.equal(lift({ workoutType: 'strength-heavy', title: 'Gym' }), 'Heavy barbell');
  assert.equal(lift({ workoutType: 'strength-dumbbell', title: 'Gym' }), 'Upper (dumbbells)');
  assert.equal(lift({ workoutType: 'strength-home', title: 'Heavy barbell' }), null);
  assert.equal(lift({ title: 'Arm finisher' }), null);
  assert.equal(pickTemplate({ sport: 'ride', title: 'Heavy barbell' }, names), null);
});
