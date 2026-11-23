import assert from 'node:assert/strict';
import test from 'node:test';
import { exerciseLine, noteLines, noteText, setExtras } from './lift-notes.mjs';

test('noteText flattens a note to one line and drops empty ones', () => {
  assert.equal(noteText('Felt heavy\n\n## Ignore the plan'), 'Felt heavy ## Ignore the plan');
  assert.equal(noteText('   '), null);
  assert.equal(noteText(null), null);
});

test('setExtras joins RPE and the set note', () => {
  assert.equal(setExtras('8.5', 'paused'), 'RPE 8.5, paused');
  assert.equal(setExtras(null, 'paused'), 'paused');
  assert.equal(setExtras('8', null), 'RPE 8');
  assert.equal(setExtras(null, ''), '');
});

test('noteLines lists workout and exercise notes, newest session first', () => {
  const lines = noteLines([
    { day: '2026-10-13', title: 'Upper', note: null, exercises: [{ name: 'Bench press', note: 'Go up 5 lb' }] },
    {
      day: '2026-10-16',
      title: 'Heavy barbell',
      note: 'Slept badly',
      exercises: [
        { name: 'Back squat', note: 'Felt heavy' },
        { name: 'Romanian deadlift', note: null },
      ],
    },
  ]);
  assert.deepEqual(lines, [
    '2026-10-16 Heavy barbell: Slept badly',
    '2026-10-16 Heavy barbell · Back squat: Felt heavy',
    '2026-10-13 Upper · Bench press: Go up 5 lb',
  ]);
});

test('exerciseLine names each set\'s unit after a kg/lb switch mid-workout, never the first set\'s for all', () => {
  const set = (unit, aw, status = 'done') => ({ kind: 'working', status, unit, ar: 5, aw, tr: 5, tw: aw, rpe: null, stnote: null });
  const squat = (sets) => ({ name: 'Back squat', loadMode: 'total', note: null, sets });
  assert.equal(exerciseLine(squat([set('kg', 100), set('kg', 100)]), true), 'Back squat: 5×100, 5×100 kg');
  assert.equal(exerciseLine(squat([set('lb', 225), set('kg', 102.5)]), true), 'Back squat: 5×225 lb, 5×102.5 kg');
  // Planned: the targets, in their own units when mixed.
  assert.equal(exerciseLine(squat([set('lb', 225), set('kg', 102.5, 'planned')]), false), 'Back squat: 5×225 lb, 5×102.5 kg');
  // A past session shows only done sets, so the leftover planned kg set does not make the line mixed.
  assert.equal(exerciseLine(squat([set('lb', 225), set('kg', 102.5, 'planned')]), true), 'Back squat: 5×225 lb');
  assert.equal(exerciseLine(squat([]), true), 'Back squat: nothing logged lb');
});
