import assert from 'node:assert/strict';
import test from 'node:test';
import { noteLines, noteText, setExtras } from './lift-notes.mjs';

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
