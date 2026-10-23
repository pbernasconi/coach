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

test('a skip changes the status and state at once; an unskip shows as planned', async () => {
  const { applyChange } = await import('./remove.mjs');
  const list = [{ id: 'a', date: '2026-10-21', status: 'planned', state: 'planned' }];
  const skipped = applyChange(list, { id: 'a', status: 'skipped' });
  assert.deepEqual([skipped[0].status, skipped[0].state], ['skipped', 'skipped']);
  const back = applyChange(skipped, { id: 'a', status: 'planned' });
  assert.deepEqual([back[0].status, back[0].state], ['planned', 'planned']);
});

test('mark done shows done at once; undo puts a hand-marked workout back to planned', () => {
  const list = [{ id: 'a', date: '2026-10-22', status: 'planned', state: 'missed', compliance: { level: 'missed' } }];
  const done = applyChange(list, { id: 'a', status: 'done' });
  assert.deepEqual([done[0].status, done[0].state, done[0].compliance.level], ['done', 'done', 'done']);
  const back = applyChange(done, { id: 'a', status: 'planned' });
  assert.deepEqual([back[0].status, back[0].state], ['planned', 'planned']);
});
