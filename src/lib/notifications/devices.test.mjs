import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleOpened, handlePreferences, handleRegister, handleSetPreferences, handleUnregister } from './devices.mjs';
import { createMemoryNotificationRepository } from './memory-repository.mjs';

const USER = 'user_1';
const reg = (over = {}) => ({
  token: 'AB'.repeat(32), environment: 'production', topic: 'com.pbernasconi.lift', installId: 'install-1',
  appVersion: '0.1.0 (41)', deviceName: 'iPhone', notificationsAuthorized: true, ...over,
});

test('register stores the token in lower case; registering again refreshes the same row', async () => {
  const repo = createMemoryNotificationRepository();
  const a = await handleRegister(reg(), USER, repo);
  assert.equal(a.status, 200);
  const b = await handleRegister(reg({ notificationsAuthorized: false }), USER, repo);
  assert.equal(b.body.deviceId, a.body.deviceId);
  const [d] = repo.devices.values();
  assert.equal(d.token, 'ab'.repeat(32));
  assert.equal(d.notificationsAuthorized, false);
});

test('a new token from the same install turns the old one off', async () => {
  const repo = createMemoryNotificationRepository();
  await handleRegister(reg(), USER, repo);
  await handleRegister(reg({ token: 'cd'.repeat(32) }), USER, repo);
  const active = await repo.activeDevices(USER);
  assert.deepEqual(active.map((d) => d.token), ['cd'.repeat(32)]);
});

test('a dead device registering again is on again', async () => {
  const repo = createMemoryNotificationRepository();
  const { body } = await handleRegister(reg(), USER, repo);
  await repo.disableDevice(body.deviceId, 'Unregistered');
  await handleRegister(reg(), USER, repo);
  assert.equal((await repo.activeDevices(USER)).length, 1);
});

test('bad registrations are refused with the field', async () => {
  const repo = createMemoryNotificationRepository();
  assert.match((await handleRegister(reg({ token: 'xyz' }), USER, repo)).body.error, /^token:/);
  assert.match((await handleRegister(reg({ environment: 'dev' }), USER, repo)).body.error, /^environment:/);
  assert.match((await handleRegister(reg({ topic: 'nope' }), USER, repo)).body.error, /^topic:/);
  assert.equal((await handleRegister(undefined, USER, repo)).status, 400);
});

test('unregister turns the device off', async () => {
  const repo = createMemoryNotificationRepository();
  await handleRegister(reg(), USER, repo);
  assert.deepEqual((await handleUnregister({ token: 'AB'.repeat(32) }, USER, repo)).body, { removed: true });
  assert.equal((await repo.activeDevices(USER)).length, 0);
});

test('opened marks the notice once', async () => {
  const repo = createMemoryNotificationRepository();
  const n = await repo.create(USER, { idempotencyKey: 'k' }, 'sent');
  repo.notifications.get(n.id).id = '6f2c0000-0000-4000-8000-000000000001';
  repo.notifications.set('6f2c0000-0000-4000-8000-000000000001', repo.notifications.get(n.id));
  assert.deepEqual((await handleOpened({ notificationId: '6f2c0000-0000-4000-8000-000000000001' }, USER, repo)).body, { opened: true });
  assert.equal((await handleOpened({ notificationId: 'n-1' }, USER, repo)).status, 400);
});

test('preferences list the switchable categories, on by default, and can be switched off', async () => {
  const repo = createMemoryNotificationRepository();
  const before = await handlePreferences(USER, repo);
  assert.deepEqual(before.body.categories.map((c) => [c.id, c.enabled]), [['workouts', true], ['body', true]]);
  const after = await handleSetPreferences({ categories: { body: false } }, USER, repo);
  assert.deepEqual(after.body.categories.map((c) => [c.id, c.enabled]), [['workouts', true], ['body', false]]);
  assert.equal((await handleSetPreferences({ categories: { system: false } }, USER, repo)).status, 400);
  assert.equal((await handleSetPreferences({ categories: { nope: true } }, USER, repo)).status, 400);
});

test("a build with another bundle id than the app's is refused, and nothing is stored", async () => {
  const repo = createMemoryNotificationRepository();
  const r = await handleRegister(reg({ topic: 'com.example.lift' }), USER, repo, { appTopic: 'com.pbernasconi.lift' });
  assert.equal(r.status, 422);
  assert.match(r.body.error, /^topic:/);
  assert.equal(repo.devices.size, 0);
  assert.equal((await handleRegister(reg(), USER, repo, { appTopic: 'com.pbernasconi.lift' })).status, 200);
});
