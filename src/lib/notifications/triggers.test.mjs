import { test } from 'node:test';
import assert from 'node:assert/strict';
import { finishedLiftSessions, liftWorkoutPayload, parseStamp, stravaWorkoutPayload, weighInFromSamples, weighInPayload } from './triggers.mjs';

const NOW = Date.parse('2026-10-22T18:00:00Z');
const session = (id, payload, deletedAt = null) => ({ entity: 'session', id, payload, deletedAt });

test('stamps: ISO and GRDB text (UTC, no zone)', () => {
  assert.equal(parseStamp('2026-10-15 07:30:00.000')?.toISOString(), '2026-10-15T07:30:00.000Z');
  assert.equal(parseStamp('2026-10-15T07:30:00.000Z')?.toISOString(), '2026-10-15T07:30:00.000Z');
  assert.equal(parseStamp(''), null);
  assert.equal(parseStamp('soon'), null);
});

test('a push that finishes a session names it once; old, open and deleted sessions do not count', () => {
  const ids = finishedLiftSessions(
    [
      session('AAA', { finishedAt: '2026-10-22T17:30:00.000Z' }),
      session('aaa', { finishedAt: '2026-10-22 17:30:00.000', note: 'edited' }),
      session('old', { finishedAt: '2026-10-20T17:30:00.000Z' }),
      session('open', { finishedAt: null }),
      session('gone', { finishedAt: '2026-10-22T17:30:00.000Z' }, new Date()),
      { entity: 'set', id: 's', payload: { finishedAt: '2026-10-22T17:30:00.000Z' }, deletedAt: null },
    ],
    NOW
  );
  assert.deepEqual(ids, ['aaa']);
});

test('a Lift payload from the session detail; nothing logged means no notice', () => {
  const s = { id: 'aaa', title: 'Upper A', minutes: 52, setsLogged: 18, volume: 6440.4, unit: 'kg', finishedAt: '2026-10-22T17:30:00.000Z' };
  assert.deepEqual(liftWorkoutPayload(s, 2), {
    source: 'lift', id: 'aaa', name: 'Upper A', sportType: null, durationS: 3120, distanceM: null, sets: 18, volume: 6440,
    unit: 'kg', prs: 2, tss: null, endedAt: '2026-10-22T17:30:00.000Z',
  });
  assert.equal(liftWorkoutPayload({ ...s, setsLogged: 0 }, 0), null);
});

const run = {
  strava_activity_id: '161', name: 'Morning Run', sport_type: 'Run', type: 'Run', moving_time: 3100, elapsed_time: 3300,
  distance: 10200, tss: 63.6, start_date: '2026-10-22 16:00:00',
};

test('a new Strava activity that just ended', () => {
  const p = stravaWorkoutPayload(run, { nowMs: NOW, liftFinishedAt: [] });
  assert.equal(p?.id, '161');
  assert.equal(p?.endedAt, '2026-10-22T16:55:00.000Z');
  assert.equal(p?.tss, 64);
  assert.equal(stravaWorkoutPayload({ ...run, start_date: '2026-10-20 16:00:00' }, { nowMs: NOW, liftFinishedAt: [] }), null);
});

test('a watch strength activity next to a Lift session is the same workout: no second notice', () => {
  const lifting = { ...run, sport_type: 'WeightTraining', type: 'WeightTraining', distance: 0 };
  assert.equal(stravaWorkoutPayload(lifting, { nowMs: NOW, liftFinishedAt: [new Date('2026-10-22T17:10:00Z')] }), null);
  assert.ok(stravaWorkoutPayload(lifting, { nowMs: NOW, liftFinishedAt: [new Date('2026-10-22T09:00:00Z')] }));
  // A run is never folded into a Lift session.
  assert.ok(stravaWorkoutPayload(run, { nowMs: NOW, liftFinishedAt: [new Date('2026-10-22T17:10:00Z')] }));
});

test('the weigh-in of a vitals push: its last recent weight, with that day\'s body fat', () => {
  const rows = [
    { date: '2026-10-20', metric: 'weight_kg', value: 84, source: 's' },
    { date: '2026-10-22', metric: 'weight_kg', value: 83.24, source: 'scale' },
    { date: '2026-10-22', metric: 'body_fat_pct', value: 18.44, source: 'scale' },
  ];
  const r = weighInFromSamples(rows, '2026-10-22');
  assert.deepEqual(r, { date: '2026-10-22', weightKg: 83.24, bodyFatPct: 18.44, source: 'scale' });
  assert.deepEqual(weighInPayload(r, { previous: { date: '2026-10-21', weightKg: 83.5 }, change4wKg: -1.234 }), {
    date: '2026-10-22', weightKg: 83.24, bodyFatPct: 18.4, previous: { date: '2026-10-21', weightKg: 83.5 }, change4wKg: -1.2, source: 'scale',
  });
  assert.equal(weighInFromSamples([{ date: '2026-10-01', metric: 'weight_kg', value: 84, source: 's' }], '2026-10-22'), null);
  assert.equal(weighInFromSamples([{ date: '2026-10-22', metric: 'steps', value: 4, source: 's' }], '2026-10-22'), null);
});
