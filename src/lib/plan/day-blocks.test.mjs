import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stackDays } from './day-blocks.mjs';

const ev = (title, start, end, extra = {}) => ({ title, start, end, ...extra });

test('stackDays: a lift hours after the aerobic session moves to straight after it', () => {
  const { events, changes } = stackDays([
    ev('🏃 Easy run', '2026-10-27T07:30:00', '2026-10-27T08:15:00', { workoutType: 'run-easy' }),
    ev('🏋️ Heavy barbell', '2026-10-27T17:00:00', '2026-10-27T18:00:00', { workoutType: 'strength-heavy' }),
  ]);
  assert.equal(events[1].start, '2026-10-27T08:15:00');
  assert.equal(events[1].end, '2026-10-27T09:15:00');
  assert.equal(events[0].start, '2026-10-27T07:30:00');
  assert.equal(changes.length, 1);
});

test('stackDays: a run after a lift goes first, keeping the block start', () => {
  const { events } = stackDays([
    ev('🏋️ Upper', '2026-10-28T10:00:00', '2026-10-28T11:00:00', { workoutType: 'strength-dumbbell' }),
    ev('🏃 Easy run', '2026-10-28T11:00:00', '2026-10-28T11:30:00', { workoutType: 'run-easy' }),
  ]);
  assert.equal(events[1].start, '2026-10-28T10:00:00');
  assert.equal(events[1].end, '2026-10-28T10:30:00');
  assert.equal(events[0].start, '2026-10-28T10:30:00');
});

test('stackDays: a ride then a lift with a 10 minute gap stays as planned', () => {
  const plan = [
    ev('🚴 Zwift Z2', '2026-10-29T09:00:00', '2026-10-29T10:00:00', { workoutType: 'ride-z2' }),
    ev('🏋️ Upper', '2026-10-29T10:10:00', '2026-10-29T11:10:00', { workoutType: 'strength-dumbbell' }),
  ];
  const { events, changes } = stackDays(plan);
  assert.deepEqual(events, plan);
  assert.deepEqual(changes, []);
});

test('stackDays: single sessions, untimed events and other days are left alone', () => {
  const plan = [
    ev('🏃 Long run', '2026-10-31T08:00:00', '2026-10-31T10:00:00'),
    ev('🚴 Long ride', '2026-11-01T09:00:00', '2026-11-01T12:30:00'),
    { title: 'Mobility', start: '2026-11-01' },
  ];
  assert.deepEqual(stackDays(plan).events, plan);
});

test('stackDays: keeps the array order, so import keys stay the same', () => {
  const { events } = stackDays([
    ev('🏋️ Lift', '2026-10-27T17:00:00', '2026-10-27T18:00:00', { workoutType: 'strength-heavy' }),
    ev('🏃 Run to the gym', '2026-10-27T07:00:00', '2026-10-27T07:20:00', { workoutType: 'run-easy' }),
  ]);
  assert.equal(events[0].title, '🏋️ Lift');
  assert.equal(events[0].start, '2026-10-27T07:20:00');
});
