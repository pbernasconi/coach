import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  STALE_HOURS,
  createMemoryGarminRepository,
  garminLine,
  garminStatusFrom,
  handleGarminGet,
  handleGarminPut,
  parseGarminUpdate,
} from './garmin.mjs';

const tokens = { cron: 'cron-secret' };
const auth = 'Bearer cron-secret';
const CT = `v1.${'A'.repeat(60)}`;
const NOW = Date.parse('2026-10-20T15:00:00Z');
const hoursAgo = (h) => new Date(NOW - h * 3_600_000).toISOString();

function put(repo, body, authorization = auth) {
  return handleGarminPut({ authorization, rawBody: typeof body === 'string' ? body : JSON.stringify(body), tokens }, repo);
}

test('GET and PUT need CRON_SECRET', async () => {
  const repo = createMemoryGarminRepository();
  for (const a of [null, '', 'Bearer wrong', 'cron-secret', 'Bearer cron-secret ']) {
    assert.equal((await handleGarminGet({ authorization: a, tokens }, repo)).status, 401);
    assert.equal((await put(repo, { status: 'ok' }, a)).status, 401);
  }
  // An unset secret rejects everything.
  assert.equal((await handleGarminGet({ authorization: 'Bearer ', tokens: {} }, repo)).status, 401);
  assert.equal(repo.rows.size, 0);
});

test('GET before any PUT returns nulls', async () => {
  const r = await handleGarminGet({ authorization: auth, tokens }, createMemoryGarminRepository());
  assert.deepEqual(r, {
    status: 200,
    body: { tokens_ciphertext: null, synced_through: null, last_success_at: null, status: null, backfill_from: null, backfill_through: null },
  });
});

test('no owner gives 503', async () => {
  const repo = { ...createMemoryGarminRepository(), ownerId: async () => null };
  assert.equal((await handleGarminGet({ authorization: auth, tokens }, repo)).status, 503);
  assert.equal((await put(repo, { status: 'ok' })).status, 503);
});

test('a token-only PUT keeps the run fields, and a run PUT keeps the tokens', async () => {
  let clock = '2026-10-20T10:00:00.000Z';
  const repo = createMemoryGarminRepository('user_test', () => clock);
  assert.equal((await put(repo, { success: true, synced_through: '2026-10-19' })).status, 200);
  clock = '2026-10-20T11:00:00.000Z';
  assert.equal((await put(repo, { tokens_ciphertext: CT })).status, 200);
  let row = repo.rows.get('user_test');
  assert.equal(row.tokensCiphertext, CT);
  assert.equal(row.status, 'ok');
  assert.equal(row.syncedThrough, '2026-10-19');
  assert.equal(row.lastSuccessAt, '2026-10-20T10:00:00.000Z');
  assert.equal(row.lastAttemptAt, '2026-10-20T10:00:00.000Z', 'a token-only PUT is not a run');

  clock = '2026-10-20T12:00:00.000Z';
  await put(repo, { status: 'auth_failed', last_error: 'Garmin rejected the tokens' });
  row = repo.rows.get('user_test');
  assert.equal(row.tokensCiphertext, CT);
  assert.equal(row.status, 'auth_failed');
  assert.equal(row.lastError, 'Garmin rejected the tokens');
  assert.equal(row.lastAttemptAt, '2026-10-20T12:00:00.000Z');
  assert.equal(row.lastSuccessAt, '2026-10-20T10:00:00.000Z');

  // A success clears the error.
  await put(repo, { status: 'ok', success: true, synced_through: '2026-10-20' });
  row = repo.rows.get('user_test');
  assert.equal(row.status, 'ok');
  assert.equal(row.lastError, null);
  assert.equal(row.lastSuccessAt, '2026-10-20T12:00:00.000Z');
  assert.equal(row.syncedThrough, '2026-10-20');

  const got = await handleGarminGet({ authorization: auth, tokens }, repo);
  assert.deepEqual(got.body, {
    tokens_ciphertext: CT, synced_through: '2026-10-20', last_success_at: '2026-10-20T12:00:00.000Z', status: 'ok', backfill_from: null, backfill_through: null,
  });
});

test('PUT rejects bad bodies', async () => {
  const repo = createMemoryGarminRepository();
  const bad = [
    'not json',
    '[]',
    {},
    { status: 'great' },
    { tokens_ciphertext: '{"di_token":"plain"}' },
    { tokens_ciphertext: 'v1.short' },
    { tokens_ciphertext: `v1.${'A'.repeat(20_001)}` },
    { tokens_ciphertext: 42 },
    { synced_through: '2026-02-30' },
    { last_error: 7 },
    { success: 'yes' },
    { success: true, status: 'error' },
  ];
  for (const body of bad) {
    const r = await put(repo, body);
    assert.equal(r.status, 400, JSON.stringify(body).slice(0, 60));
  }
  assert.equal((await put(repo, 'x'.repeat(70_000))).status, 413);
  assert.equal(repo.rows.size, 0);
});

test('last_error is cut short and cleaned', () => {
  const p = parseGarminUpdate({ status: 'error', last_error: `  ${'e'.repeat(500)}\u0000 ` });
  assert.ok(p.ok);
  assert.equal(p.update.lastError.length, 300);
  assert.ok(!p.update.lastError.includes('\u0000'));
  const empty = parseGarminUpdate({ status: 'error', last_error: '   ' });
  assert.ok(empty.ok);
  assert.equal(empty.update.lastError, null);
});

test('success: false only reports nothing new', () => {
  assert.deepEqual(parseGarminUpdate({ success: false }), { ok: false, error: 'nothing to update' });
  const p = parseGarminUpdate({ status: 'error', success: false });
  assert.ok(p.ok);
  assert.equal(p.update.success, undefined);
});

const row = (over = {}) => ({
  tokensCiphertext: CT, status: 'ok', lastSuccessAt: hoursAgo(3), lastAttemptAt: hoursAgo(3), lastError: null, syncedThrough: '2026-10-19', ...over,
});

test('status: fresh and ok has no warning', () => {
  const s = garminStatusFrom(row(), NOW);
  assert.equal(s.warning, null);
  assert.equal(s.connected, true);
  assert.equal(garminLine(s, NOW), 'Garmin: synced 3 h ago, through Oct 19');
});

test('status: not set up is info only', () => {
  const s = garminStatusFrom(null, NOW);
  assert.equal(s.connected, false);
  assert.equal(s.warning?.level, 'info');
  assert.match(s.warning.text, /login\.py/);
  assert.equal(garminLine(s, NOW), 'Garmin: not set up');
});

test('status: auth_failed is an error with the fix', () => {
  const s = garminStatusFrom(row({ status: 'auth_failed' }), NOW);
  assert.equal(s.warning?.level, 'error');
  assert.match(s.warning.text, /login\.py/);
});

test('status: older than 36 h is a warning', () => {
  assert.equal(garminStatusFrom(row({ lastSuccessAt: hoursAgo(STALE_HOURS - 1) }), NOW).warning, null);
  const s = garminStatusFrom(row({ lastSuccessAt: hoursAgo(80) }), NOW);
  assert.equal(s.warning?.level, 'warn');
  assert.match(s.warning.text, /3 days/);
  const e = garminStatusFrom(row({ lastSuccessAt: hoursAgo(40), status: 'error', lastError: 'Coach HTTP 500' }), NOW);
  assert.match(e.warning.text, /Coach HTTP 500/);
  const never = garminStatusFrom(row({ lastSuccessAt: null }), NOW);
  assert.equal(never.warning?.level, 'warn');
  assert.match(never.warning.text, /not synced yet/);
  assert.equal(garminLine(never, NOW), 'Garmin: no successful sync yet');
});

test('status: a recent error with a recent success is info', () => {
  const s = garminStatusFrom(row({ status: 'error', lastError: '30 of 60 Garmin calls failed' }), NOW);
  assert.equal(s.warning?.level, 'info');
  assert.match(s.warning.text, /30 of 60/);
});

test('garminLine uses minutes and days', () => {
  assert.equal(garminLine(garminStatusFrom(row({ lastSuccessAt: hoursAgo(0.25), syncedThrough: null }), NOW), NOW), 'Garmin: synced 15 min ago');
  assert.equal(garminLine(garminStatusFrom(row({ lastSuccessAt: hoursAgo(72), syncedThrough: '2026-01-05' }), NOW), NOW), 'Garmin: synced 3 days ago, through Jan 5');
});

// --- raw archive ---------------------------------------------------------- //

import { MAX_RAW_BODY_BYTES, MAX_RAW_ITEMS, RAW_KINDS, createMemoryGarminRawRepository, handleGarminRawPush } from './garmin.mjs';

const rawPush = (repo, body, authorization = auth) =>
  handleGarminRawPush({ authorization, rawBody: typeof body === 'string' ? body : JSON.stringify(body), tokens, today: '2026-10-20' }, repo);

test('raw: needs CRON_SECRET', async () => {
  const repo = createMemoryGarminRawRepository();
  for (const a of [null, 'Bearer wrong', 'cron-secret']) assert.equal((await rawPush(repo, { items: [] }, a)).status, 401);
});

test('raw: stores valid items, rejects bad ones by index, last duplicate wins', async () => {
  const repo = createMemoryGarminRawRepository();
  const r = await rawPush(repo, {
    items: [
      { date: '2026-10-19', kind: 'sleep', payload: { sleepLevels: [{ activityLevel: 1 }] } },
      { date: '2026-10-19', kind: 'nope', payload: {} },
      { date: '2026-02-30', kind: 'hrv', payload: {} },
      { date: '2026-10-25', kind: 'hrv', payload: {} },
      { date: '2026-10-19', kind: 'hrv', payload: 'text' },
      { date: '2026-10-19', kind: 'hrv', payload: null },
      { date: '2026-10-19', kind: 'stress', payload: { note: 'a\u0000b' } },
      'x',
      { date: '2026-10-19', kind: 'race_predictions', payload: [{ time5K: 1 }] },
      { date: '2026-10-19', kind: 'race_predictions', payload: [{ time5K: 2 }] },
    ],
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.accepted, 3);
  assert.deepEqual(r.body.rejected.map((x) => x.index), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(repo.rows.size, 2);
  assert.equal(repo.rows.get('user_test|2026-10-19|race_predictions').payload, '[{"time5K":2}]');
  assert.deepEqual(JSON.parse(repo.rows.get('user_test|2026-10-19|sleep').payload), { sleepLevels: [{ activityLevel: 1 }] });
});

test('raw: body and item limits', async () => {
  const repo = createMemoryGarminRawRepository();
  assert.equal((await rawPush(repo, 'x'.repeat(MAX_RAW_BODY_BYTES + 1))).status, 413);
  assert.equal((await rawPush(repo, { items: Array(MAX_RAW_ITEMS + 1).fill({}) })).status, 400);
  assert.equal((await rawPush(repo, { items: 'no' })).status, 400);
  assert.equal((await rawPush(repo, 'not json')).status, 400);
});

test('raw: every kind the job sends is accepted', () => {
  const py = readFileSync(new URL('../../../scripts/garmin/sync.py', import.meta.url), 'utf8');
  const kinds = [...py.matchAll(/^\s+\("([a-z0-9_]+)", "get_[a-z0-9_]+"/gm)].map((m) => m[1]);
  assert.ok(kinds.length >= 10, 'source table not found in sync.py');
  for (const k of kinds) assert.ok(RAW_KINDS.includes(k), `${k} is not in RAW_KINDS`);
});

test('raw: no owner gives 503', async () => {
  const repo = { ...createMemoryGarminRawRepository(), ownerId: async () => null };
  assert.equal((await rawPush(repo, { items: [{ date: '2026-10-19', kind: 'hrv', payload: {} }] })).status, 503);
});

test('backfill progress: PUT, GET, and the /health line', async () => {
  const repo = createMemoryGarminRepository();
  assert.equal((await put(repo, { backfill_from: '2025-04-20', backfill_through: null })).status, 200);
  assert.equal((await put(repo, { backfill_through: '2025-05-10' })).status, 200);
  const got = await handleGarminGet({ authorization: auth, tokens }, repo);
  assert.equal(got.body.backfill_from, '2025-04-20');
  assert.equal(got.body.backfill_through, '2025-05-10');
  assert.equal(repo.rows.get('user_test').lastAttemptAt, null, 'progress is not a run');
  assert.equal((await put(repo, { backfill_from: '20250420' })).status, 400);
  const s = garminStatusFrom({ ...repo.rows.get('user_test'), tokensCiphertext: CT, lastSuccessAt: hoursAgo(1), syncedThrough: '2026-10-20' }, NOW);
  assert.deepEqual(s.backfill, { from: '2025-04-20', through: '2025-05-10' });
  assert.equal(garminLine(s, NOW), 'Garmin: synced 1 h ago, through Oct 20 (backfill from Apr 20: through May 10)');
  await put(repo, { backfill_from: null });
  assert.equal(garminStatusFrom(repo.rows.get('user_test'), NOW).backfill, null);
});
