import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { APNS_PRODUCTION_HOST, APNS_SANDBOX_HOST, createApnsTransport, outcomeFor, retryAfterMs } from './apns.mjs';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const keyP8 = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const TOKEN = 'a'.repeat(64);
const NOW = Date.parse('2026-10-22T08:00:00Z');

/** @returns {import('./apns.mjs').ApnsMessage} */
const message = (over = {}) => ({
  token: TOKEN,
  environment: 'production',
  topic: null,
  registeredAtMs: null,
  title: 'Workout completed!',
  body: 'Upper A · 52 min',
  threadId: 'workouts',
  collapseId: 'workout:lift:1',
  interruptionLevel: 'active',
  ttlSeconds: 86400,
  data: { link: 'lift://session/1', notificationId: 'n-1', type: 'workout.completed' },
  ...over,
});

/** A transport whose APNs answers from `answers` in order, recording each request. */
function transport(answers, config = {}) {
  const requests = [];
  let now = NOW;
  const t = createApnsTransport({
    config: () => ({ keyP8, keyId: 'KEY1234567', teamId: 'TEAM123456', topic: 'com.example.lift', ...config }),
    request: async (req) => {
      requests.push(req);
      const a = answers.shift();
      if (a instanceof Error) throw a;
      return a ?? { status: 200, apnsId: 'id-1' };
    },
    now: () => now,
  });
  return { t, requests, advance: (ms) => (now += ms) };
}

test('a send carries a valid ES256 provider token, the topic, priority, collapse id, expiry and payload', async () => {
  const { t, requests } = transport([{ status: 200, apnsId: 'apns-1' }]);
  const [outcome] = await t.send([message()]);
  assert.deepEqual(outcome, { status: 'accepted', apnsId: 'apns-1' });
  const req = requests[0];
  assert.equal(req.host, APNS_PRODUCTION_HOST);
  assert.equal(req.path, `/3/device/${TOKEN}`);
  assert.equal(req.headers['apns-topic'], 'com.example.lift');
  assert.equal(req.headers['apns-push-type'], 'alert');
  assert.equal(req.headers['apns-priority'], '10');
  assert.equal(req.headers['apns-collapse-id'], 'workout:lift:1');
  assert.equal(req.headers['apns-expiration'], String(NOW / 1000 + 86400));
  const [h, p, s] = req.headers.authorization.replace('bearer ', '').split('.');
  assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url').toString()), { alg: 'ES256', kid: 'KEY1234567' });
  assert.deepEqual(JSON.parse(Buffer.from(p, 'base64url').toString()), { iss: 'TEAM123456', iat: NOW / 1000 });
  assert.ok(verify('sha256', Buffer.from(`${h}.${p}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url')));
  const body = JSON.parse(req.body);
  assert.deepEqual(body.aps.alert, { title: 'Workout completed!', body: 'Upper A · 52 min' });
  assert.equal(body.aps['thread-id'], 'workouts');
  assert.equal(body.aps['interruption-level'], 'active');
  assert.equal(body.link, 'lift://session/1');
  assert.equal(body.notificationId, 'n-1');
});

test('a passive notice goes at priority 5; a sandbox token to the sandbox host; the device topic wins', async () => {
  const { t, requests } = transport([]);
  await t.send([message({ interruptionLevel: 'passive', environment: 'sandbox', topic: 'com.example.lift.dev' })]);
  assert.equal(requests[0].headers['apns-priority'], '5');
  assert.equal(requests[0].host, APNS_SANDBOX_HOST);
  assert.equal(requests[0].headers['apns-topic'], 'com.example.lift.dev');
});

test('the provider token is reused, and minted again after 50 minutes', async () => {
  const { t, requests, advance } = transport([]);
  await t.send([message()]);
  await t.send([message()]);
  advance(51 * 60_000);
  await t.send([message()]);
  const auth = requests.map((r) => r.headers.authorization);
  assert.equal(auth[0], auth[1]);
  assert.notEqual(auth[1], auth[2]);
});

test('an expired provider token is minted again and the send repeated once', async () => {
  const { t, requests } = transport([{ status: 403, reason: 'ExpiredProviderToken' }, { status: 200, apnsId: 'x' }]);
  const [o] = await t.send([message()]);
  assert.equal(o.status, 'accepted');
  assert.equal(requests.length, 2);
});

test('BadDeviceToken is tried on the other host; a second one is a dead token', async () => {
  const ok = transport([{ status: 400, reason: 'BadDeviceToken' }, { status: 200, apnsId: 'y' }]);
  assert.equal((await ok.t.send([message()]))[0].status, 'accepted');
  assert.deepEqual(ok.requests.map((r) => r.host), [APNS_PRODUCTION_HOST, APNS_SANDBOX_HOST]);
  const dead = transport([{ status: 400, reason: 'BadDeviceToken' }, { status: 400, reason: 'BadDeviceToken' }]);
  assert.equal((await dead.t.send([message()]))[0].status, 'dead');
});

test('Unregistered is dead, unless the device registered again after Apple checked', () => {
  const r = { status: 410, reason: 'Unregistered', timestamp: NOW - 60_000 };
  assert.equal(outcomeFor(message(), r, NOW).status, 'dead');
  assert.deepEqual(outcomeFor(message({ registeredAtMs: NOW }), r, NOW), { status: 'failed', code: 'Unregistered', retryable: false, apnsId: null });
});

test('TopicDisallowed and DeviceTokenNotForTopic are dead: that build never gets a push', () => {
  for (const reason of ['TopicDisallowed', 'DeviceTokenNotForTopic']) {
    assert.deepEqual(outcomeFor(message(), { status: 400, reason }, NOW), { status: 'dead', code: reason, apnsId: null });
  }
});

test('429 and 5xx are retryable and never dead; Retry-After is read', () => {
  assert.deepEqual(outcomeFor(message(), { status: 429, reason: 'TooManyRequests', retryAfter: '3' }, NOW), {
    status: 'failed', code: 'TooManyRequests', retryable: true, apnsId: null, retryAfterMs: 3000,
  });
  assert.equal(outcomeFor(message(), { status: 500 }, NOW).code, 'HTTP_500');
  assert.equal(outcomeFor(message(), { status: 400, reason: 'PayloadTooLarge' }, NOW).retryable, false);
  assert.equal(retryAfterMs('soon', NOW), undefined);
});

test('missing credentials send nothing and keep the token', async () => {
  const { t, requests } = transport([], { keyP8: undefined });
  assert.deepEqual(await t.send([message()]), [{ status: 'failed', code: 'NO_CREDENTIALS', retryable: false }]);
  assert.equal(requests.length, 0);
});

test('a key that does not import is CREDENTIALS_INVALID; a network error is retryable', async () => {
  const bad = transport([], { keyP8: '-----BEGIN PRIVATE KEY-----\nnope\n-----END PRIVATE KEY-----' });
  const [o] = await bad.t.send([message()]);
  assert.equal(o.status, 'failed');
  assert.equal(o.code, 'CREDENTIALS_INVALID');
  const net = transport([new Error('socket hang up')]);
  assert.deepEqual(await net.t.send([message()]), [{ status: 'failed', code: 'TRANSPORT_ERROR', retryable: true }]);
});

test('a key written on one line with \\n works', async () => {
  const { t } = transport([], { keyP8: keyP8.replace(/\n/g, '\\n') });
  assert.equal((await t.send([message()]))[0].status, 'accepted');
});
