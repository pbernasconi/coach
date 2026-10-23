import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strengthLines } from './strength-lines.mjs';

const set = (status, reps, weight, kind = 'working') => ({ kind, status, target: { reps, repMin: null, repMax: null, weight } });

test('reads the Lift session: working sets, logged sets, reps and the top load', () => {
  const lift = {
    unit: 'lb',
    exercises: [
      {
        key: 'id-bench',
        name: 'Dumbbell bench press',
        loadMode: 'perHand',
        media: { image: 'a.jpg', gif: 'a.gif' },
        sets: [set('planned', 10, 20, 'warmUp'), set('done', 10, 45), set('planned', 10, 50), set('planned', 10, 50)],
      },
      { key: 'name-chin-up', name: 'Chin-up', loadMode: 'bodyweight', media: null, sets: [set('planned', 8, null), set('planned', 8, null)] },
      { name: 'Empty', loadMode: null, sets: [set('planned', 5, 10, 'warmUp')] },
    ],
  };
  assert.deepEqual(strengthLines(lift, 'ignored 3x10'), [
    { key: 'id-bench', name: 'Dumbbell bench press', image: 'a.jpg', gif: 'a.gif', sets: 3, done: 1, text: '3 × 10 · 50 lb' },
    { key: 'name-chin-up', name: 'Chin-up', image: null, gif: null, sets: 2, done: 0, text: '2 × 8 · BW' },
  ]);
});

test('a rep range shows as a range', () => {
  const lift = { unit: 'kg', exercises: [{ name: 'Row', loadMode: null, sets: [{ kind: 'working', status: 'planned', target: { reps: null, repMin: 8, repMax: 12, weight: 20 } }] }] };
  assert.equal(strengthLines(lift, null)[0].text, '1 × 8–12 · 20 kg');
});

test('without a Lift session, reads the coach text', () => {
  assert.deepEqual(strengthLines(null, '1) Push-up 3x10\n2) Split squat 3×8–10 each leg\n90 s rest.'), [
    { key: null, name: 'Push-up', image: null, gif: null, sets: 3, done: 0, text: '3 × 10' },
    { key: null, name: 'Split squat', image: null, gif: null, sets: 3, done: 0, text: '3 × 8–10' },
  ]);
  assert.deepEqual(strengthLines(null, 'Easy upper body.'), []);
});
