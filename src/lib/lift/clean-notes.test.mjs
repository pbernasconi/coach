import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanExerciseNote, cleanSessionNote } from './clean-notes.mjs';

test('an exercise note loses the original line and keeps what follows it', () => {
  assert.equal(cleanExerciseNote('Note: “Bench dumbbell bench press”'), null);
  assert.equal(cleanExerciseNote('Note: “lateral raise (superset)”; 60s between rounds'), '60s between rounds');
  assert.equal(cleanExerciseNote('Weight in each hand.'), 'Weight in each hand.');
  assert.equal(cleanExerciseNote(null), null);
});

test('a session note loses the import lines and keeps the workout', () => {
  const note = [
    'Imported from Apple Notes (notes-import): “Workout - April 28”, note created 2025-04-28 18:03:37, modified 2025-04-29.',
    'Date confidence medium: Title says April 28.',
    'Warmup 15 mins stairclimbers.',
    "'New workouts' list is a plan (excluded).",
  ].join('\n');
  assert.equal(cleanSessionNote(note), 'Warmup 15 mins stairclimbers.');
  assert.equal(cleanSessionNote('Imported from Apple Notes (notes-import): “Nov 19”.'), null);
  assert.equal(cleanSessionNote("Program block, 'One off' are plans (excluded). Sets are the 'Today' block."), null);
  assert.equal(cleanSessionNote('Felt strong'), 'Felt strong');
  assert.equal(cleanSessionNote("Warmup 20 mins stairclimbers. Note ends with an empty 'Barbell' heading."), 'Warmup 20 mins stairclimbers.');
  assert.equal(cleanSessionNote("Warmup 5 step climbers. Pull-ups sets 2–3 not done ('0 - back hurt')."), "Warmup 5 step climbers. Pull-ups sets 2–3 not done ('0 - back hurt').");
});
