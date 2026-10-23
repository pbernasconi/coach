import test from 'node:test';
import assert from 'node:assert/strict';
import { agoText, connectionsFrom, dayText } from './connections.mjs';

const NOW = Date.parse('2026-10-22T20:00:00Z');
const healthy = {
  strava: { connected: true, athleteId: 1, lastSyncedAt: '2026-10-22T18:00:00Z', newestActivity: '2026-10-22', canSync: true, canConnect: true },
  lift: { tokenSet: true, lastChangeAt: '2026-10-22T19:30:00Z', sessions: 57 },
  calendars: [{ email: 'a@example.com', active: true, lastSyncedAt: '2026-10-22T19:00:00Z' }],
  garmin: { connected: true, status: 'ok', lastSuccessAt: '2026-10-22T17:00:00Z', syncedThrough: '2026-10-22' },
  functionSync: { lastSuccessAt: '2026-10-01T10:00:00Z', lastAttemptAt: null, status: 'ok', error: null },
  scale: { lastWeighIn: '2026-10-21' },
  warnings: [],
};
const bodyspec = { connected: true, status: 'ok', lastSuccessAt: '2026-10-20T10:00:00Z', lastError: null, scans: 4, newest: '2026-09-30' };

test('agoText and dayText: short, plain words', () => {
  assert.equal(agoText(null, NOW), 'never');
  assert.equal(agoText('2026-10-22T19:59:40Z', NOW), 'just now');
  assert.equal(agoText('2026-10-22T19:48:00Z', NOW), '12 min ago');
  assert.equal(agoText('2026-10-22T17:00:00Z', NOW), '3 h ago');
  assert.equal(agoText('2026-10-18T20:00:00Z', NOW), '4 days ago');
  assert.equal(dayText('2026-10-22'), 'Oct 22');
  assert.equal(dayText(null), null);
});

test('connectionsFrom: all healthy', () => {
  const { items, summary } = connectionsFrom({ status: healthy, bodyspec, now: NOW });
  assert.deepEqual(items.map((i) => i.id), ['strava', 'garmin', 'calendar', 'lift', 'bodyspec', 'function', 'scale']);
  assert.ok(items.every((i) => i.state === 'connected'));
  assert.equal(items[0].statusText, 'Synced 2 h ago');
  assert.equal(items[0].detailText, 'Newest activity Oct 22');
  assert.equal(items[3].detailText, '57 sessions');
  assert.deepEqual(summary, { attention: 0, total: 5, level: 'ok', text: 'All 5 required connections are healthy' });
});

test('connectionsFrom: Strava off, Garmin expired, BodySpec unreadable', () => {
  const status = {
    ...healthy,
    strava: { ...healthy.strava, connected: false },
    garmin: { ...healthy.garmin, status: 'auth_failed' },
    warnings: [
      { level: 'error', source: 'strava', text: 'Strava is not connected, so no activities arrive.' },
      { level: 'error', source: 'garmin', text: 'Garmin login has expired. Run scripts/garmin/.venv/bin/python …' },
    ],
  };
  const { items, summary } = connectionsFrom({ status, bodyspec: null, now: NOW });
  const by = Object.fromEntries(items.map((i) => [i.id, i]));
  assert.equal(by.strava.state, 'off');
  assert.equal(by.strava.level, 'error');
  assert.equal(by.garmin.statusText, 'Login expired');
  assert.ok(!by.garmin.note.includes('.venv'), 'no Mac command on the phone');
  assert.equal(by.bodyspec.statusText, 'Could not be read');
  assert.deepEqual(summary, { attention: 3, total: 5, level: 'error', text: '3 of 5 need attention' });
});

test('connectionsFrom: a stale sync is attention; optional rows do not count when off', () => {
  const status = {
    ...healthy,
    functionSync: { lastSuccessAt: null, lastAttemptAt: null, status: null, error: null },
    scale: { lastWeighIn: null },
    warnings: [{ level: 'warn', source: 'calendar', text: 'Calendar has not synced for 5 h.' }],
  };
  const { items, summary } = connectionsFrom({ status, bodyspec, now: NOW });
  const by = Object.fromEntries(items.map((i) => [i.id, i]));
  assert.equal(by.calendar.state, 'attention');
  assert.equal(by.calendar.note, 'Calendar has not synced for 5 h.');
  assert.equal(by.function.state, 'off');
  assert.equal(by.scale.statusText, 'No weigh-ins yet');
  assert.deepEqual(summary, { attention: 1, total: 5, level: 'warn', text: '1 of 5 needs attention' });
});
