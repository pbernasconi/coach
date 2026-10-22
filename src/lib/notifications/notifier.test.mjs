import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryNotificationRepository } from './memory-repository.mjs';
import { createNotifier, MAX_ATTEMPTS } from './notifier.mjs';

const USER = 'user_1';
const weighIn = { date: '2026-10-22', weightKg: 83.2, source: 'scale' };

/** A notifier over memory, with APNs answering from `answers` (one array of outcomes per send call). */
async function setup(answers = [], devices = 1) {
  const repo = createMemoryNotificationRepository({ now: () => new Date('2026-10-22T08:00:00Z') });
  for (let i = 0; i < devices; i++) {
    await repo.register(USER, {
      token: String(i).repeat(64), environment: 'production', topic: 'com.example.lift', installId: `i${i}`,
      appVersion: '0.1.0 (40)', deviceName: 'iPhone', notificationsAuthorized: true,
    });
  }
  const sent = [];
  const waits = [];
  const notifier = createNotifier({
    repo,
    origin: 'https://coach.example.com',
    transport: {
      send: async (messages) => {
        sent.push(messages);
        return answers.shift() ?? messages.map(() => ({ status: 'accepted', apnsId: 'a' }));
      },
    },
    sleep: async (ms) => void waits.push(ms),
    log: { warn: () => {}, error: () => {} },
  });
  return { repo, notifier, sent, waits };
}

test('a notice goes to every active device with its link and id, and is recorded as sent', async () => {
  const { repo, notifier, sent } = await setup([], 2);
  const r = await notifier.notify('weigh_in.recorded', weighIn, { userId: USER });
  assert.equal(r.status, 'sent');
  assert.equal(r.accepted, 2);
  assert.equal(sent[0].length, 2);
  assert.deepEqual(sent[0][0].data, { link: 'lift://weigh-in/2026-10-22', notificationId: r.notificationId, type: 'weigh_in.recorded' });
  assert.equal(repo.deliveries.length, 2);
  assert.equal(repo.notifications.get(r.notificationId).status, 'sent');
});

test('the same trigger twice sends once', async () => {
  const { notifier, sent } = await setup();
  await notifier.notify('weigh_in.recorded', weighIn, { userId: USER });
  assert.deepEqual(await notifier.notify('weigh_in.recorded', weighIn, { userId: USER }), { status: 'duplicate' });
  assert.equal(sent.length, 1);
});

test('a muted category stores the notice and sends nothing; a mandatory one ignores the switch', async () => {
  const { repo, notifier, sent } = await setup();
  await repo.setPreference(USER, 'body', false);
  assert.equal((await notifier.notify('weigh_in.recorded', weighIn, { userId: USER })).status, 'muted');
  assert.equal(sent.length, 0);
  await repo.setPreference(USER, 'system', false);
  assert.equal((await notifier.notify('system.test', { nonce: 'n1' }, { userId: USER })).status, 'sent');
});

test('a retryable failure is sent again after a wait, then succeeds', async () => {
  const { repo, notifier, sent, waits } = await setup([[{ status: 'failed', code: 'HTTP_503', retryable: true, retryAfterMs: 2500 }]]);
  const r = await notifier.notify('weigh_in.recorded', weighIn, { userId: USER });
  assert.equal(r.status, 'sent');
  assert.equal(sent.length, 2);
  assert.deepEqual(waits, [2500]);
  assert.equal(repo.deliveries[0].attempts, 2);
});

test('a failure that keeps failing stops after MAX_ATTEMPTS and the notice is failed', async () => {
  const fail = [{ status: 'failed', code: 'TRANSPORT_ERROR', retryable: true }];
  const { repo, notifier, sent } = await setup([fail, fail, fail, fail]);
  const r = await notifier.notify('weigh_in.recorded', weighIn, { userId: USER });
  assert.equal(r.status, 'failed');
  assert.equal(sent.length, MAX_ATTEMPTS);
  assert.equal(repo.deliveries[0].code, 'TRANSPORT_ERROR');
});

test('a dead token turns its device off; the other device still gets it (partial)', async () => {
  const { repo, notifier } = await setup([[{ status: 'dead', code: 'Unregistered', apnsId: null }, { status: 'accepted', apnsId: 'a' }]], 2);
  const r = await notifier.notify('weigh_in.recorded', weighIn, { userId: USER });
  assert.equal(r.status, 'partial');
  const off = [...repo.devices.values()].filter((d) => d.disabledAt);
  assert.equal(off.length, 1);
  assert.equal(off[0].disabledReason, 'Unregistered');
  assert.equal((await repo.activeDevices(USER)).length, 1);
});

test('no devices: stored as no_devices', async () => {
  const { notifier } = await setup([], 0);
  assert.equal((await notifier.notify('weigh_in.recorded', weighIn, { userId: USER })).status, 'no_devices');
});

test('a bad payload stores nothing', async () => {
  const { repo, notifier } = await setup();
  const r = await notifier.notify('weigh_in.recorded', { date: 'x' }, { userId: USER });
  assert.equal(r.status, 'invalid');
  assert.equal(repo.notifications.size, 0);
});
