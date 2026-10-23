import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strengthExercises, strengthNotes } from './strength-text.mjs';

const CALVES = `Achilles, at home, bodyweight on a step. One time only.
1) Standing calf raise 3x15: 3 s up, 3 s down, full range (heels below the step). Too easy: 3x8 on one leg.
2) Bent-knee calf raise 3x15 (soleus): back on a wall, knees bent about 30°, same tempo.
90 s rest. Pain up to 5/10 is OK; it must be gone by the next morning.`;

test('reads each numbered line with sets and reps, and keeps the rest as a note', () => {
  assert.deepEqual(strengthExercises(CALVES), [
    {
      name: 'Standing calf raise',
      sets: 3,
      reps: 15,
      repsMax: null,
      note: '3 s up, 3 s down, full range (heels below the step). Too easy: 3x8 on one leg.',
    },
    { name: 'Bent-knee calf raise', sets: 3, reps: 15, repsMax: null, note: 'Soleus. Back on a wall, knees bent about 30°, same tempo.' },
  ]);
});

test('reads a rep range, the × sign and spaces', () => {
  assert.deepEqual(strengthExercises('Split squat 3 × 8–10 each leg'), [
    { name: 'Split squat', sets: 3, reps: 8, repsMax: 10, note: 'Each leg' },
  ]);
});

test('splits numbered parts on one line', () => {
  const names = strengthExercises('1) Push-up 3x10 2) Plank 3x30').map((e) => e.name);
  assert.deepEqual(names, ['Push-up', 'Plank']);
});

test('a line with no sets and reps, or no name, is not an exercise', () => {
  assert.deepEqual(strengthExercises('90 s rest.\n3x10\nRest 2:00'), []);
  assert.deepEqual(strengthExercises(null), []);
  assert.deepEqual(strengthExercises(''), []);
});

test('the notes keep the text around the exercises, without the exercise lines', () => {
  assert.equal(
    strengthNotes(CALVES),
    'Achilles, at home, bodyweight on a step. One time only.\n90 s rest. Pain up to 5/10 is OK; it must be gone by the next morning.'
  );
  assert.equal(strengthNotes('1) Push-up 3x10'), null);
  assert.equal(strengthNotes(null), null);
});
