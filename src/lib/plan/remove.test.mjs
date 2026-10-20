import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyChange, removeNotice, weeksAfterRemove } from './remove.mjs';

test('removeNotice always names the calendar event', () => {
  const n = removeNotice({ title: 'Tempo run', date: '2026-10-21' });
  assert.equal(n.question, 'Remove “Tempo run”?');
  assert.deepEqual(n.notes, ['Its Google Calendar event is deleted too.']);
});

test('removeNotice warns about a re-import and a matched activity', () => {
  const n = removeNotice({ title: 'Long ride', date: '2026-10-25', state: 'done', imported: true });
  assert.equal(n.notes.length, 3);
  assert.match(n.notes[0], /activity stays/);
  assert.match(n.notes[1], /adds it again/);
});

test('weeksAfterRemove is the Monday of the workout, or nothing for a bad date', () => {
  assert.deepEqual(weeksAfterRemove('2026-10-25'), ['2026-10-19']);
  assert.deepEqual(weeksAfterRemove('2026-10-19'), ['2026-10-19']);
  assert.deepEqual(weeksAfterRemove(null), []);
});

test('applyChange moves or removes one workout', () => {
  const list = [{ id: 'a', date: '2026-10-20' }, { id: 'b', date: '2026-10-21' }];
  assert.deepEqual(applyChange(list, { id: 'a', date: '2026-10-22' }), [{ id: 'a', date: '2026-10-22' }, { id: 'b', date: '2026-10-21' }]);
  assert.deepEqual(applyChange(list, { id: 'a', remove: true }), [{ id: 'b', date: '2026-10-21' }]);
  assert.equal(applyChange(list, { id: 'x', remove: true }).length, 2);
});
