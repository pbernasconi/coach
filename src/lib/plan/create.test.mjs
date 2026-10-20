import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanNewWorkout, estimateTss } from './create.mjs';
import { bankWorkout } from '../workouts/bank.mjs';

// Synthetic values only.

test('cleanNewWorkout keeps a simple run and names it from the sport', () => {
  const r = cleanNewWorkout({ sport: 'run', date: '2026-10-22', duration: '45', tss: 40, startTime: '07:30' });
  assert.deepEqual(r.value, {
    sport: 'run', date: '2026-10-22', startTime: '07:30', title: 'Run', duration: 45, distance: null, tss: 40,
    intensity: null, description: null, steps: null, workoutType: null,
  });
});

test('cleanNewWorkout takes time and TSS from the steps when the form left them empty', () => {
  const steps = bankWorkout('threshold-a', 'ride', 0, 90);
  const r = cleanNewWorkout({ sport: 'ride', date: '2026-10-21', steps });
  assert.equal(r.value.title, steps.name);
  assert.equal(r.value.duration, 90);
  assert.ok(r.value.tss > 50 && r.value.tss < 150);
  assert.equal(r.value.workoutType, 'ride-threshold-a');
});

test('cleanNewWorkout refuses bad input and clears a rest day', () => {
  assert.ok(cleanNewWorkout({ sport: 'dance', date: '2026-10-21' }).error);
  assert.ok(cleanNewWorkout({ sport: 'run', date: '21/10/2026' }).error);
  assert.ok(cleanNewWorkout({ sport: 'run', date: '2026-10-21', startTime: '25:00' }).error);
  assert.ok(cleanNewWorkout({ sport: 'swim', date: '2026-10-21', steps: bankWorkout('easy', 'run', 0, 30) }).error);
  const rest = cleanNewWorkout({ sport: 'rest', date: '2026-10-21', duration: 60, tss: 20 }).value;
  assert.deepEqual([rest.title, rest.duration, rest.tss], ['Rest day', null, null]);
  assert.equal(estimateTss(60, 0.75), 56);
});

test('workout_type: <sport>-<bank> for a bank workout, so the rotation counts a web workout', async () => {
  const { workoutTypeFor, cleanNewWorkout } = await import('./create.mjs');
  assert.equal(workoutTypeFor('ride', { bank: 'threshold-a' }), 'ride-threshold-a');
  assert.equal(workoutTypeFor('run', { bank: 'vo2-b' }), 'run-vo2-b');
  assert.equal(workoutTypeFor('ride', { bank: 'easy' }), 'ride-z2');
  assert.equal(workoutTypeFor('run', null), null);
  assert.equal(workoutTypeFor('strength', { bank: 'x' }), null);
  assert.equal(workoutTypeFor('rest', null), 'rest');
  assert.equal(cleanNewWorkout({ sport: 'rest', date: '2026-10-21' }).value.workoutType, 'rest');
});
