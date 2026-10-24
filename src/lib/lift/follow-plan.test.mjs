import { test } from 'node:test';
import assert from 'node:assert/strict';
import { followLiftSession, liftFollowChange, stampAfter } from './follow-plan.mjs';

const NOW = new Date('2026-10-20T12:00:00.000Z');
const ID = 'CA4F651B-98C7-4765-83A9-07AB74435D69';
const session = (over = {}) => ({ id: ID, day: '2026-10-20', title: 'Heavy', startedAt: null, finishedAt: null, updatedAt: '2026-10-19T08:00:00.000Z', deletedAt: null, ...over });
const row = (payload = session(), over = {}) => ({ payload, updatedAt: new Date('2026-10-19T08:00:00.000Z'), deletedAt: null, ...over });
const opts = { logged: false, now: NOW };

test('the stamp is now, or 1 ms past a stored row that is not older', () => {
  assert.equal(stampAfter(new Date('2026-10-19T00:00:00Z'), NOW), NOW.toISOString());
  assert.equal(stampAfter(null, NOW), NOW.toISOString());
  assert.equal(stampAfter(new Date('2026-10-21T00:00:00.000Z'), NOW), '2026-10-21T00:00:00.001Z');
});

test('a move puts the session on the new day with a newer updatedAt', () => {
  const r = liftFollowChange(row(), { day: '2026-10-22' }, opts);
  assert.equal(r.change.op, 'update');
  assert.equal(r.change.payload.day, '2026-10-22');
  assert.equal(r.change.payload.updatedAt, NOW.toISOString());
  assert.equal(r.change.payload.deletedAt, null);
  assert.equal(r.change.payload.title, 'Heavy', 'the rest of the row is kept');
  assert.deepEqual(liftFollowChange(row(), { day: '2026-10-20' }, opts), { skip: 'on its day' });
});

test('a skip or remove soft-deletes the session row only', () => {
  const r = liftFollowChange(row(), { remove: true }, opts);
  assert.equal(r.change.op, 'delete');
  assert.equal(r.change.payload.deletedAt, NOW.toISOString());
  assert.equal(r.change.payload.updatedAt, NOW.toISOString());
  assert.equal(r.change.payload.day, '2026-10-20');
  assert.deepEqual(liftFollowChange(row(session(), { deletedAt: NOW }), { remove: true }, opts), { skip: 'removed already' });
});

test('a started, finished or logged session never changes', () => {
  assert.deepEqual(liftFollowChange(row(session({ startedAt: '2026-10-20T07:00:00Z' })), { day: '2026-10-22' }, opts), { skip: 'started' });
  assert.deepEqual(liftFollowChange(row(session({ finishedAt: '2026-10-20T08:00:00Z' })), { remove: true }, opts), { skip: 'started' });
  assert.deepEqual(liftFollowChange(row(), { remove: true }, { ...opts, logged: true }), { skip: 'started' });
  assert.deepEqual(liftFollowChange(null, { day: '2026-10-22' }, opts), { skip: 'no session' });
});

test('a removed session comes back only on un-skip or Undo (restore)', () => {
  const removed = row(session({ deletedAt: '2026-10-19T09:00:00.000Z' }), { deletedAt: new Date('2026-10-19T09:00:00.000Z') });
  assert.deepEqual(liftFollowChange(removed, { day: '2026-10-22' }, opts), { skip: 'removed' });
  const r = liftFollowChange(removed, { day: '2026-10-20', restore: true }, opts);
  assert.equal(r.change.op, 'update');
  assert.equal(r.change.payload.deletedAt, null);
  assert.equal(r.change.payload.day, '2026-10-20');
});

test('a row stamped ahead of this clock (payload or column) still gets a strictly newer updatedAt', () => {
  const ahead = row(session({ updatedAt: '2026-10-20 12:00:05.000' }));
  assert.equal(liftFollowChange(ahead, { day: '2026-10-21' }, opts).change.payload.updatedAt, '2026-10-20T12:00:05.001Z');
  const column = row(session(), { updatedAt: new Date('2026-10-20T12:00:09.000Z') });
  assert.equal(liftFollowChange(column, { day: '2026-10-21' }, opts).change.payload.updatedAt, '2026-10-20T12:00:09.001Z');
});

test('followLiftSession pushes one session change, and nothing for a bad id', async () => {
  const pushed = [];
  const sql = (strings) => Promise.resolve(strings.join('').includes('count(*)') ? [{ n: 0 }] : [{ payload: session(), updated_at: '2026-10-19 08:00:00+00', deleted_at: null }]);
  const pushChanges = async (changes) => {
    pushed.push(...changes);
    return { accepted: changes.map((c) => c.idempotencyKey), rejected: [] };
  };
  assert.deepEqual(await followLiftSession(sql, pushChanges, ID.toLowerCase(), { day: '2026-10-23' }, NOW), { done: '2026-10-23' });
  assert.equal(pushed.length, 1);
  assert.deepEqual([pushed[0].entity, pushed[0].op, pushed[0].rowId, pushed[0].payload.day], ['session', 'update', ID, '2026-10-23']);
  assert.deepEqual(await followLiftSession(sql, pushChanges, 'not-a-uuid', { remove: true }, NOW), { skip: 'no session' });
  assert.equal(pushed.length, 1);
});

test('the phone moving a session moves its plan workout, a removed one too; a skipped workout stays', async () => {
  const { planFollowMoves, pushedSessions } = await import('./follow-plan.mjs');
  const A = ID.toLowerCase();
  const B = 'b0000000-0000-4000-8000-000000000001';
  const moved = '2026-10-20T12:00:00.000Z';
  const sessions = pushedSessions([
    { entity: 'session', id: ID, payload: { day: '2026-10-21', dayMovedAt: moved }, deletedAt: null },
    { entity: 'session', id: ID, payload: { day: '2026-10-22', dayMovedAt: moved }, deletedAt: null }, // the last change wins
    { entity: 'set', id: B, payload: { day: '2026-10-25' }, deletedAt: null },
    { entity: 'session', id: B, payload: { day: '2026-10-24', dayMovedAt: moved }, deletedAt: new Date() },
  ]);
  assert.deepEqual([...sessions.keys()], [A, B]);
  const w = (id, liftSessionId, date, status = 'planned', changedAt = new Date('2026-10-19T08:00:00Z')) => ({ id, liftSessionId, date, status, changedAt });
  assert.deepEqual(planFollowMoves(sessions, [w('w1', ID, '2026-10-20')]), [{ id: 'w1', sessionId: A, from: '2026-10-20', to: '2026-10-22' }]);
  assert.deepEqual(planFollowMoves(sessions, [w('w1', A, '2026-10-22')]), [], 'already on the day');
  assert.deepEqual(planFollowMoves(sessions, [w('w1', A, '2026-10-20', 'skipped')]), [], 'a skipped workout stays');
  assert.deepEqual(
    planFollowMoves(sessions, [w('w2', B, '2026-10-20')]),
    [{ id: 'w2', sessionId: B, from: '2026-10-20', to: '2026-10-24' }],
    'a removed session still carries its move (Discard after Start: back to the planned day)'
  );
  assert.deepEqual(
    planFollowMoves(sessions, [w('w2', B, '2026-10-20', 'planned', new Date('2026-10-21T00:00:00Z'))]),
    [],
    'a removal with an old move (already followed) leaves its workout'
  );
  const odd = pushedSessions([{ entity: 'session', id: A, payload: { day: '2026-10-22T00:00', dayMovedAt: moved }, deletedAt: null }]);
  assert.deepEqual(planFollowMoves(odd, [w('w1', A, '2026-10-20')]), [], 'a malformed day moves nothing');
});

test('the gate: only a phone move (dayMovedAt) newer than the last server change moves the workout', async () => {
  const { planFollowMoves, pushedSessions } = await import('./follow-plan.mjs');
  const push = (dayMovedAt) => pushedSessions([{ entity: 'session', id: ID, payload: { day: '2026-10-22', ...(dayMovedAt === undefined ? {} : { dayMovedAt }) }, deletedAt: null }]);
  const changed = new Date('2026-10-20T12:00:00.000Z');
  const w = (changedAt) => [{ id: 'w1', liftSessionId: ID, date: '2026-10-20', status: 'planned', changedAt }];
  assert.deepEqual(planFollowMoves(push(undefined), w(changed)), [], 'no key (builds before v8): no follow');
  assert.deepEqual(planFollowMoves(push(null), w(changed)), [], 'null: no follow');
  assert.deepEqual(planFollowMoves(push('2026-10-20T11:59:59.999Z'), w(changed)), [], 'older than the web move: no follow');
  assert.deepEqual(planFollowMoves(push('2026-10-20T12:00:00.000Z'), w(changed)), [], 'as old: no follow');
  assert.equal(planFollowMoves(push('2026-10-20T12:00:00.001Z'), w(changed)).length, 1, 'newer: follows');
  assert.equal(planFollowMoves(push('2026-10-20 12:00:01.000'), w(changed)).length, 1, 'GRDB text reads as UTC');
  assert.equal(planFollowMoves(push('2026-10-20T12:00:00.001Z'), w(null)).length, 1, 'a workout never changed on the server');
});

test('a web move keeps the stored dayMovedAt, so it never looks like a phone move', () => {
  const r = liftFollowChange(row(session({ dayMovedAt: '2026-10-18T09:00:00.000Z' })), { day: '2026-10-22' }, opts);
  assert.equal(r.change.payload.dayMovedAt, '2026-10-18T09:00:00.000Z');
  const none = liftFollowChange(row(), { day: '2026-10-22' }, opts);
  assert.equal('dayMovedAt' in none.change.payload, false, 'not added when the row has none');
});
