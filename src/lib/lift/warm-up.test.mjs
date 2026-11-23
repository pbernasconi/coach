import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIGHT_WARM_UP, warmUpChecklist, warmUpNote } from './warm-up.mjs';

test('reads ticked and unticked items', () => {
  assert.deepEqual(warmUpChecklist('[x] Easy cardio · 5 min\n[ ] Dead bug · 5 / side'), [
    { text: 'Easy cardio · 5 min', done: true },
    { text: 'Dead bug · 5 / side', done: false },
  ]);
});

test('a plain note is no checklist, and an unboxed line in one counts as done', () => {
  assert.equal(warmUpChecklist('5 min rower'), null);
  assert.equal(warmUpChecklist(null), null);
  assert.deepEqual(warmUpChecklist('5 min rower\n[ ] Chest opener · 10')?.map((i) => i.done), [true, false]);
});

test('a new note round-trips with every item to do', () => {
  const items = warmUpChecklist(warmUpNote(LIGHT_WARM_UP));
  assert.deepEqual(items?.map((i) => i.text), LIGHT_WARM_UP);
  assert.ok(items?.every((i) => !i.done));
});
