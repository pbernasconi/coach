#!/usr/bin/env node --test
/**
 * Tests for the Lift sync server logic (lift/SYNC.md), driven through the transport-agnostic handlers with
 * the in-memory repository: no network, no database. Also covers the dashboard summaries.
 *
 * Run: npm test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handlePush, handlePull } from '../src/lib/lift-sync/sync.mjs';
import { createMemoryRepository } from '../src/lib/lift-sync/memory-repository.mjs';
import { parseTimestamp, storableInJsonb, validateChange, parsePullLimit } from '../src/lib/lift-sync/contract.mjs';
import { decodeCursor, encodeCursor } from '../src/lib/lift-sync/cursor.mjs';
import { isAuthorized } from '../src/lib/lift-sync/auth.mjs';
import { incomingWins } from '../src/lib/lift-sync/lww.mjs';
import {
  buildModel,
  epley,
  exerciseDetail,
  sessionSummaries,
  weekStart,
  weeklyVolume,
} from '../src/lib/lift-dashboard/stats.mjs';

const TOKEN = 'test-token-0123456789abcdef';
const AUTH = `Bearer ${TOKEN}`;

let counter = 0;
/** A fresh upper-case UUID, as Swift's uuidString writes them. */
function uuid() {
  counter += 1;
  return `00000000-0000-4000-8000-${counter.toString(16).padStart(12, '0')}`.toUpperCase();
}

function change({ entity = 'session', rowId = uuid(), op = 'insert', key = uuid(), updatedAt, payload = {} } = {}) {
  return {
    idempotencyKey: key,
    entity,
    rowId,
    op,
    payload: {
      id: rowId,
      updatedAt: updatedAt ?? '2026-10-15 07:30:00.000',
      deletedAt: null,
      title: 'Upper A',
      ...payload,
    },
  };
}

function pushReq(changes, extra = {}) {
  return { authorization: AUTH, rawBody: JSON.stringify({ deviceId: 'device-1', changes }), token: TOKEN, ...extra };
}

function pullReq(query = {}, extra = {}) {
  return { authorization: AUTH, cursor: query.cursor ?? null, limit: query.limit ?? null, token: TOKEN, ...extra };
}

// --- Auth ---

test('auth: wrong, missing, or malformed tokens get 401 on push and pull', async () => {
  const repo = createMemoryRepository();
  for (const authorization of [null, '', 'Bearer wrong', `bearer ${TOKEN}`, TOKEN, `Bearer ${TOKEN} `, `Basic ${TOKEN}`]) {
    const p = await handlePush(pushReq([change()], { authorization }), repo);
    assert.equal(p.status, 401, `push with ${JSON.stringify(authorization)}`);
    const q = await handlePull(pullReq({}, { authorization }), repo);
    assert.equal(q.status, 401, `pull with ${JSON.stringify(authorization)}`);
  }
  assert.equal(repo.rows.size, 0, 'nothing applied without auth');
});

test('auth: an unset server token rejects everything, even an empty bearer', async () => {
  const repo = createMemoryRepository();
  assert.equal((await handlePush(pushReq([change()], { token: undefined }), repo)).status, 401);
  assert.equal((await handlePull(pullReq({}, { token: '' , authorization: 'Bearer ' }), repo)).status, 401);
  assert.equal(isAuthorized('Bearer ', ''), false);
  assert.equal(isAuthorized(AUTH, TOKEN), true);
});

test('auth is checked before the body is parsed', async () => {
  const res = await handlePush({ authorization: 'Bearer nope', rawBody: '{not json', token: TOKEN }, createMemoryRepository());
  assert.equal(res.status, 401);
});

// --- Validation ---

test('validation: malformed envelopes are 400', async () => {
  const repo = createMemoryRepository();
  const bodies = [
    '{not json',
    'null',
    '[]',
    JSON.stringify({ changes: [] }), // no deviceId
    JSON.stringify({ deviceId: '', changes: [] }),
    JSON.stringify({ deviceId: 'd', changes: 'x' }),
    JSON.stringify({ deviceId: 'd', changes: [{ entity: 'session' }] }), // no idempotency key
    JSON.stringify({ deviceId: 'd', changes: [{ idempotencyKey: 'not-a-uuid' }] }),
  ];
  for (const rawBody of bodies) {
    const res = await handlePush({ authorization: AUTH, rawBody, token: TOKEN }, repo);
    assert.equal(res.status, 400, rawBody);
  }
});

test('validation: more than 500 changes is 400; exactly 500 is fine', async () => {
  const repo = createMemoryRepository();
  const many = Array.from({ length: 501 }, () => change());
  const tooMany = await handlePush(pushReq(many), repo);
  assert.equal(tooMany.status, 400);
  assert.match(tooMany.body.error, /500/);
  const ok = await handlePush(pushReq(many.slice(0, 500)), repo);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.accepted.length, 500);
});

test('validation: an empty change list is accepted', async () => {
  const res = await handlePush(pushReq([]), createMemoryRepository());
  assert.deepEqual(res, { status: 200, body: { accepted: [], rejected: [] } });
});

test('validation: bad changes are rejected individually with a reason, good ones still apply', async () => {
  const repo = createMemoryRepository();
  const good = change();
  const rowId = uuid();
  const bad = [
    [{ ...change(), entity: 'workout' }, 'invalid entity'],
    [{ ...change(), op: 'upsert' }, 'invalid op'],
    [{ ...change(), rowId: 'nope' }, 'invalid rowId'],
    [{ ...change(), payload: [] }, 'invalid payload'],
    [change({ rowId, payload: { id: uuid() } }), 'payload.id does not match rowId'],
    [change({ payload: { id: undefined } }), 'payload.id missing or invalid'],
    [change({ payload: { updatedAt: undefined } }), 'payload.updatedAt missing or invalid'],
    [change({ updatedAt: 'yesterday' }), 'payload.updatedAt missing or invalid'],
    [change({ updatedAt: '2026-02-30T00:00:00.000Z' }), 'payload.updatedAt missing or invalid'],
    [change({ payload: { deletedAt: 'soon' } }), 'payload.deletedAt invalid'],
    [change({ payload: { blob: 'x'.repeat(70 * 1024) } }), 'payload too large'],
  ];
  const res = await handlePush(pushReq([bad[0][0], good, ...bad.slice(1).map(([c]) => c)]), repo);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.accepted, [good.idempotencyKey]);
  assert.deepEqual(
    res.body.rejected,
    bad.map(([c, reason]) => ({ idempotencyKey: c.idempotencyKey, reason }))
  );
  assert.equal(repo.rows.size, 1);
  assert.equal(repo.appliedKeys.size, 1, 'rejected keys are not recorded');
});

test('validation: text Postgres jsonb cannot store is rejected, not a 500 that blocks the outbox', async () => {
  const repo = createMemoryRepository();
  const nul = change({ payload: { name: 'Bench\u0000press' } });
  const loneSurrogate = change({ payload: { name: 'Bench \ud83d press' } });
  const nulKey = change({ payload: { ['note\u0000']: 'x' } });
  const nested = change({ payload: { aliases: ['ok', 'bad\u0000'] } });
  const emoji = change({ payload: { name: 'Bench \ud83d\udcaa' } }); // a well-formed pair is fine
  const literal = change({ payload: { name: 'C:\\u0000 is just text' } }); // backslash, u, zeros
  const res = await handlePush(pushReq([nul, loneSurrogate, nulKey, nested, emoji, literal]), repo);
  assert.equal(res.status, 200);
  const reason = 'payload has text Postgres cannot store';
  assert.deepEqual(
    res.body.rejected,
    [nul, loneSurrogate, nulKey, nested].map((c) => ({ idempotencyKey: c.idempotencyKey, reason }))
  );
  assert.deepEqual(res.body.accepted, [emoji.idempotencyKey, literal.idempotencyKey]);
  assert.equal(storableInJsonb({ a: [1, null, true, { b: 'ok' }] }), true);
});

test('validation: rowId and payload.id compare case-insensitively; the payload is stored verbatim', () => {
  const rowId = uuid();
  const result = validateChange(change({ rowId, payload: { id: rowId.toLowerCase(), extra: [1, 2] } }));
  assert.equal(result.ok, true);
  assert.equal(result.change.id, rowId.toLowerCase());
  assert.equal(result.change.payload.id, rowId.toLowerCase());
  assert.deepEqual(result.change.payload.extra, [1, 2]);
});

test('timestamps: ISO 8601 with Z or offset, and GRDB text as UTC', () => {
  assert.equal(parseTimestamp('2026-10-15T07:30:00.000Z').toISOString(), '2026-10-15T07:30:00.000Z');
  assert.equal(parseTimestamp('2026-10-15 07:30:00.123').toISOString(), '2026-10-15T07:30:00.123Z');
  assert.equal(parseTimestamp('2026-10-15T09:30:00+02:00').toISOString(), '2026-10-15T07:30:00.000Z');
  assert.equal(parseTimestamp('2026-10-15T07:30:00.123456Z').toISOString(), '2026-10-15T07:30:00.123Z');
  for (const bad of ['', '2026-10-15', '2026-13-01T00:00:00Z', '2026-10-15T24:00:00Z', 12, null, '2026-10-15T07:30:00 Z']) {
    assert.equal(parseTimestamp(bad), null, String(bad));
  }
});

// --- Idempotency ---

test('timestamps: years before 100 are not read as 19xx', () => {
  assert.equal(parseTimestamp('0099-01-01T00:00:00.000Z')?.toISOString(), '0099-01-01T00:00:00.000Z');
  assert.equal(parseTimestamp('0001-03-01 12:00:00.250')?.toISOString(), '0001-03-01T12:00:00.250Z');
  assert.equal(parseTimestamp('0004-02-29T00:00:00Z')?.getUTCDate(), 29); // a leap year
  assert.equal(parseTimestamp('0003-02-29T00:00:00Z'), null);
});

test('idempotency: a repeated key is accepted again without effect', async () => {
  const repo = createMemoryRepository();
  const c = change({ updatedAt: '2026-10-15T07:30:00.000Z' });
  await handlePush(pushReq([c]), repo);
  const before = await handlePull(pullReq(), repo);

  // Same key, even with different content and a newer stamp: accepted, ignored.
  const replay = { ...c, payload: { ...c.payload, title: 'Changed', updatedAt: '2026-10-16T00:00:00.000Z' } };
  const res = await handlePush(pushReq([replay, replay]), repo);
  assert.deepEqual(res.body, { accepted: [c.idempotencyKey, c.idempotencyKey], rejected: [] });

  const after = await handlePull(pullReq(), repo);
  assert.deepEqual(after.body, before.body, 'no new seq, no new content');
  assert.equal(after.body.changes[0].payload.title, 'Upper A');
});

test('idempotency: resending a whole batch after a lost response changes nothing', async () => {
  const repo = createMemoryRepository();
  const batch = [change(), change({ entity: 'set' }), change({ entity: 'exercise' })];
  await handlePush(pushReq(batch), repo);
  const snapshot = JSON.stringify([...repo.rows.values()]);
  const res = await handlePush(pushReq(batch), repo);
  assert.equal(res.body.accepted.length, 3);
  assert.equal(JSON.stringify([...repo.rows.values()]), snapshot);
});

// --- Last writer wins ---

test('lww: a newer updatedAt overwrites and gets a fresh seq', async () => {
  const repo = createMemoryRepository();
  const rowId = uuid();
  await handlePush(pushReq([change({ rowId, updatedAt: '2026-10-15T07:30:00.000Z', payload: { title: 'v1' } })]), repo);
  await handlePush(pushReq([change({ rowId: uuid() })]), repo); // seq 2, another row
  await handlePush(pushReq([change({ rowId, op: 'update', updatedAt: '2026-10-15T07:31:00.000Z', payload: { title: 'v2' } })]), repo);

  const { body } = await handlePull(pullReq(), repo);
  assert.equal(body.changes.length, 2);
  assert.equal(body.changes.at(-1).rowId, rowId.toLowerCase(), 'updated row moved to the end');
  assert.equal(body.changes.at(-1).payload.title, 'v2');
  assert.equal(body.cursor, '3');
});

test('push reports only the changes it wrote: not stale ones, not duplicates', async () => {
  const repo = createMemoryRepository();
  const rowId = uuid();
  const first = change({ rowId, updatedAt: '2026-10-15T07:30:00.000Z' });
  const applied = [];
  await handlePush(pushReq([first]), repo, { applied });
  assert.deepEqual(applied.map((c) => c.id), [rowId.toLowerCase()]);
  const later = [];
  await handlePush(pushReq([first, change({ rowId, op: 'update', updatedAt: '2026-10-15T07:00:00.000Z' })]), repo, { applied: later });
  assert.deepEqual(later, [], 'a duplicate and a stale change are not reported');
});

test('lww: an older or equal updatedAt is accepted but does not overwrite', async () => {
  const repo = createMemoryRepository();
  const rowId = uuid();
  await handlePush(pushReq([change({ rowId, updatedAt: '2026-10-15T07:30:00.500Z', payload: { title: 'kept' } })]), repo);
  const older = change({ rowId, op: 'update', updatedAt: '2026-10-15 07:30:00.499', payload: { title: 'older' } });
  const equal = change({ rowId, op: 'update', updatedAt: '2026-10-15T09:30:00.500+02:00', payload: { title: 'equal' } });
  const res = await handlePush(pushReq([older, equal]), repo);
  assert.deepEqual(res.body.accepted, [older.idempotencyKey, equal.idempotencyKey]);
  const { body } = await handlePull(pullReq(), repo);
  assert.equal(body.changes.length, 1);
  assert.equal(body.changes[0].payload.title, 'kept');
  assert.equal(body.cursor, '1', 'stale changes take no seq');
});

test('lww: changes in one push apply in order; a soft delete is a normal newer row', async () => {
  const repo = createMemoryRepository();
  const rowId = uuid();
  await handlePush(
    pushReq([
      change({ rowId, updatedAt: '2026-10-15T07:30:00.000Z' }),
      change({ rowId, op: 'delete', updatedAt: '2026-10-15T07:40:00.000Z', payload: { deletedAt: '2026-10-15T07:40:00.000Z' } }),
    ]),
    repo
  );
  const stored = repo.rows.get(`session:${rowId.toLowerCase()}`);
  assert.equal(stored.deletedAt.toISOString(), '2026-10-15T07:40:00.000Z');
  const { body } = await handlePull(pullReq(), repo);
  assert.equal(body.changes[0].payload.deletedAt, '2026-10-15T07:40:00.000Z');
});

test('lww: the same id in different entities are different rows', async () => {
  const repo = createMemoryRepository();
  const rowId = uuid();
  await handlePush(pushReq([change({ rowId, entity: 'session' }), change({ rowId, entity: 'set' })]), repo);
  assert.equal(repo.rows.size, 2);
});

test('lww: incomingWins is strict', () => {
  const t = new Date('2026-10-15T07:30:00.000Z');
  assert.equal(incomingWins(null, { updatedAt: t }), true);
  assert.equal(incomingWins({ updatedAt: t }, { updatedAt: new Date(t.getTime()) }), false);
  assert.equal(incomingWins({ updatedAt: t }, { updatedAt: new Date(t.getTime() + 1) }), true);
});

// --- Cursor paging ---

test('cursor: pages through every change in order with hasMore, then stays put', async () => {
  const repo = createMemoryRepository();
  const changes = Array.from({ length: 7 }, (_, i) => change({ payload: { title: `s${i}` } }));
  await handlePush(pushReq(changes), repo);

  const titles = [];
  let cursor = null;
  let pages = 0;
  for (;;) {
    const res = await handlePull(pullReq({ cursor, limit: '3' }), repo);
    assert.equal(res.status, 200);
    pages += 1;
    titles.push(...res.body.changes.map((c) => c.payload.title));
    cursor = res.body.cursor;
    if (!res.body.hasMore) break;
  }
  assert.equal(pages, 3);
  assert.deepEqual(titles, ['s0', 's1', 's2', 's3', 's4', 's5', 's6']);
  assert.equal(cursor, '7');

  const empty = await handlePull(pullReq({ cursor, limit: '3' }), repo);
  assert.deepEqual(empty.body, { changes: [], cursor: '7', hasMore: false });

  // A later change shows up after the stored cursor.
  await handlePush(pushReq([change({ payload: { title: 'later' } })]), repo);
  const next = await handlePull(pullReq({ cursor }), repo);
  assert.deepEqual(next.body.changes.map((c) => c.payload.title), ['later']);
  assert.equal(next.body.hasMore, false);
});

test('cursor: exactly `limit` remaining reports hasMore false', async () => {
  const repo = createMemoryRepository();
  await handlePush(pushReq([change(), change()]), repo);
  const res = await handlePull(pullReq({ limit: '2' }), repo);
  assert.equal(res.body.changes.length, 2);
  assert.equal(res.body.hasMore, false);
});

test('cursor: a full pull on an empty server', async () => {
  const res = await handlePull(pullReq(), createMemoryRepository());
  assert.deepEqual(res, { status: 200, body: { changes: [], cursor: '0', hasMore: false } });
});

test('cursor and limit: invalid values are 400', async () => {
  const repo = createMemoryRepository();
  for (const cursor of ['abc', '-1', '1.5', '9'.repeat(16)]) {
    assert.equal((await handlePull(pullReq({ cursor }), repo)).status, 400, cursor);
  }
  for (const limit of ['0', '501', 'ten', '-3', '2.5']) {
    assert.equal((await handlePull(pullReq({ limit }), repo)).status, 400, limit);
  }
  assert.equal(parsePullLimit(null), 500);
  assert.equal(decodeCursor(encodeCursor(1287)), 1287);
  assert.equal(decodeCursor(undefined), 0);
});

test('pull: changes carry entity, rowId and the payload as pushed', async () => {
  const repo = createMemoryRepository();
  const c = change({ entity: 'sessionExercise', payload: { displayName: 'Bench Press', position: 0 } });
  await handlePush(pushReq([c]), repo);
  const { body } = await handlePull(pullReq(), repo);
  assert.deepEqual(body.changes, [{ entity: 'sessionExercise', rowId: c.rowId.toLowerCase(), payload: c.payload }]);
});

test('push and pull: templates and their slots are entities like any other', async () => {
  const repo = createMemoryRepository();
  const template = change({ entity: 'template', payload: { name: 'Upper A', position: 0 } });
  const slot = change({
    entity: 'templateExercise',
    payload: { templateID: template.rowId, setCount: 3, repMin: 8, repMax: 12, kind: 'working' },
  });
  const { body: pushed } = await handlePush(pushReq([template, slot]), repo);
  assert.deepEqual(pushed.accepted, [template.idempotencyKey, slot.idempotencyKey]);
  assert.deepEqual(pushed.rejected, []);
  const { body } = await handlePull(pullReq(), repo);
  assert.deepEqual(body.changes.map((c) => c.entity), ['template', 'templateExercise']);
});

// --- Dashboard summaries ---

test('dashboard: Epley, week starts, and session/weekly/exercise summaries', () => {
  assert.equal(epley(1, 100), 100);
  assert.equal(epley(5, 100), 100 * (1 + 5 / 30));
  assert.equal(epley(13, 100), null);
  assert.equal(epley(5, 0), null);
  assert.equal(weekStart('2026-10-15'), '2026-10-12'); // Thursday -> Monday
  assert.equal(weekStart('2026-10-12'), '2026-10-12');
  assert.equal(weekStart('2026-10-18'), '2026-10-12'); // Sunday

  const s1 = 'AAAAAAAA-0000-4000-8000-000000000001';
  const s2 = 'AAAAAAAA-0000-4000-8000-000000000002';
  const sDeleted = 'AAAAAAAA-0000-4000-8000-000000000003';
  const bench = 'BBBBBBBB-0000-4000-8000-000000000001';
  const se1 = 'CCCCCCCC-0000-4000-8000-000000000001';
  const se2 = 'CCCCCCCC-0000-4000-8000-000000000002';
  const se3 = 'CCCCCCCC-0000-4000-8000-000000000003';
  const set = (id, seId, extra) => ({
    id, sessionExerciseID: seId, kind: 'working', status: 'done', unit: 'kg', actualReps: 5, actualWeight: 100, deletedAt: null, ...extra,
  });
  const data = {
    exercises: [{ id: bench, name: 'Bench Press', deletedAt: null }],
    sessions: [
      { id: s1, day: '2026-10-12', title: 'Upper A', unitsAtLog: 'kg', deletedAt: null },
      { id: s2, day: '2026-10-22', title: 'Upper B', unitsAtLog: 'kg', deletedAt: null },
      { id: sDeleted, day: '2026-10-13', title: 'Gone', unitsAtLog: 'kg', deletedAt: '2026-10-13 10:00:00.000' },
    ],
    sessionExercises: [
      { id: se1, sessionID: s1, exerciseID: bench, displayName: 'Bench', loadMode: 'total', deletedAt: null },
      { id: se2, sessionID: s2, exerciseID: bench.toLowerCase(), displayName: 'Bench', loadMode: 'total', deletedAt: null },
      { id: se3, sessionID: sDeleted, exerciseID: bench, displayName: 'Bench', loadMode: 'total', deletedAt: null },
    ],
    sets: [
      set('1', se1, { kind: 'warmUp', actualWeight: 40 }),
      set('2', se1, {}),
      set('3', se1, { status: 'planned' }),
      set('4', se1, { status: 'skipped' }),
      set('5', se2, { actualReps: 3, actualWeight: 110 }),
      set('6', se2, { unit: 'lb', actualReps: 1, actualWeight: 225, deletedAt: '2026-10-22 10:00:00.000' }),
      set('7', se3, {}),
    ],
  };
  const model = buildModel(data);
  const sessions = sessionSummaries(model, 'kg');
  assert.deepEqual(
    sessions.map((s) => [s.title, s.setsLogged, s.setsTotal, s.volume]),
    [
      ['Upper B', 1, 1, 330],
      ['Upper A', 2, 4, 500],
    ]
  );
  const weeks = weeklyVolume(model, 'kg');
  assert.deepEqual(
    weeks.map((w) => [w.week, w.sessions, w.sets, w.volume]),
    [
      ['2026-10-19', 1, 1, 330],
      ['2026-10-12', 1, 1, 500],
    ]
  );
  const detail = exerciseDetail(model, `id-${bench.toLowerCase()}`, 'kg');
  assert.equal(detail.name, 'Bench Press');
  assert.equal(detail.sessions, 2);
  assert.deepEqual(detail.e1rmOverTime.map((p) => [p.day, Math.round(p.e1rm * 10) / 10]), [
    ['2026-10-12', 116.7],
    ['2026-10-22', 121],
  ]);
  assert.equal(Math.round(detail.bestSets[0].e1rm), 121);
  assert.equal(detail.heaviest, 110);
});
