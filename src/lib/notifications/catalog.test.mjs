import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bindEvent, CATEGORIES, NOTIFICATION_EVENTS } from './catalog.mjs';
import { apnsKey } from './events/define.mjs';

const origin = 'https://coach.example.com';

const lift = {
  source: 'lift',
  id: 'D5A25B33-32E0-5BCD-BC53-5F17CB084120',
  name: 'Upper A',
  durationS: 52 * 60,
  sets: 18,
  volume: 6440,
  unit: 'kg',
  prs: 2,
  endedAt: '2026-10-21T18:30:00.000Z',
};

test('a finished Lift session: title, body with the work, and a link to the session', () => {
  const r = bindEvent('workout.completed', lift, { origin });
  assert.ok(r.ok);
  assert.equal(r.event.title, 'Workout completed!');
  assert.equal(r.event.body, 'Upper A · 52 min · 18 sets · 6,440 kg · 2 PRs');
  assert.equal(r.event.link, 'lift://session/d5a25b33-32e0-5bcd-bc53-5f17cb084120');
  assert.equal(r.event.webUrl, 'https://coach.example.com/lift/sessions/d5a25b33-32e0-5bcd-bc53-5f17cb084120');
  assert.equal(r.event.idempotencyKey, 'workout.completed:lift:d5a25b33-32e0-5bcd-bc53-5f17cb084120');
  assert.equal(r.event.category, 'workouts');
  assert.equal(r.event.threadKey, 'workouts');
});

test('a Strava run: the sport in the title, distance, time, pace and TSS, and a link to the activity', () => {
  const r = bindEvent(
    'workout.completed',
    { source: 'strava', id: '16123456789', name: 'Morning Run', sportType: 'Run', durationS: 3130, distanceM: 10200, tss: 64, endedAt: '2026-10-21T15:00:00Z' },
    { origin }
  );
  assert.ok(r.ok);
  assert.equal(r.event.title, 'Run completed!');
  assert.equal(r.event.body, 'Morning Run · 10.2 km · 52 min · 5:07 /km · TSS 64');
  assert.equal(r.event.link, 'lift://activity/16123456789');
});

test('a long ride shows hours', () => {
  const r = bindEvent('workout.completed', { source: 'strava', id: '1', name: 'Zwift', sportType: 'VirtualRide', durationS: 4320, distanceM: 40000, endedAt: '2026-10-21T15:00:00Z' }, { origin });
  assert.ok(r.ok);
  assert.equal(r.event.title, 'Ride completed!');
  assert.equal(r.event.body, 'Zwift · 40.0 km · 1:12 h');
});

test('a weigh-in: the weight in the title, the changes and body fat in the body, and a link to that day', () => {
  const r = bindEvent(
    'weigh_in.recorded',
    { date: '2026-10-22', weightKg: 83.2, bodyFatPct: 18.4, previous: { date: '2026-10-21', weightKg: 83.5 }, change4wKg: -1.2, source: 'Renpho Elis 1 (scale bridge)' },
    { origin }
  );
  assert.ok(r.ok);
  assert.equal(r.event.title, 'Weigh-in: 83.2 kg');
  assert.equal(r.event.body, '▼ 0.3 kg since Oct 21 · body fat 18.4 % · ▼ 1.2 kg in 4 weeks');
  assert.equal(r.event.link, 'lift://weigh-in/2026-10-22');
  assert.equal(r.event.collapseKey, 'weigh_in:2026-10-22');
  assert.equal(r.event.interruptionLevel, 'passive');
  assert.equal(r.event.idempotencyKey, 'weigh_in.recorded:2026-10-22:83.20');
});

test('a first weigh-in has nothing to compare', () => {
  const r = bindEvent('weigh_in.recorded', { date: '2026-10-22', weightKg: 83, source: 'scale' }, { origin });
  assert.ok(r.ok);
  assert.equal(r.event.body, 'First weigh-in in Coach');
});

test('a weight gain shows an up arrow', () => {
  const r = bindEvent('weigh_in.recorded', { date: '2026-10-22', weightKg: 84, previous: { date: '2026-10-20', weightKg: 83 }, source: 's' }, { origin });
  assert.ok(r.ok);
  assert.equal(r.event.body, '▲ 1.0 kg since Oct 20');
});

test('a bad payload is refused with the field that is wrong', () => {
  const r = bindEvent('weigh_in.recorded', { date: '22/10/2026', weightKg: 83, source: 's' }, { origin });
  assert.equal(r.ok, false);
  assert.match(r.error, /^date:/);
  assert.equal(bindEvent('nope', {}, { origin }).ok, false);
});

test('an id that could change the link path is refused', () => {
  const r = bindEvent('workout.completed', { ...lift, source: 'strava', id: '../x' }, { origin });
  assert.equal(r.ok, false);
});

test('every event has a category with a switch or a mandatory flag', () => {
  for (const def of Object.values(NOTIFICATION_EVENTS)) assert.ok(CATEGORIES[def.category]);
});

test('collapse keys fit APNs (64 bytes)', () => {
  assert.equal(Buffer.byteLength(apnsKey('x'.repeat(100))), 64);
  assert.equal(apnsKey('short'), 'short');
});
