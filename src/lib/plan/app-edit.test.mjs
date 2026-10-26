import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addInput, bankOptions, editForm, editInput } from './app-edit.mjs';
import { cleanNewWorkout } from './create.mjs';
import { bankWorkout } from '../workouts/bank.mjs';

// Synthetic values only.

const ride = (over = {}) => ({
  sport: 'ride', date: '2026-10-27', startTime: '07:00:00', title: 'Sweet spot', duration: 90, distance: null, tss: 80,
  intensity: null, description: 'Steady.', steps: bankWorkout('threshold-a', 'ride', 1, 90), ...over,
});

test('editForm fills the form as the web does: bank, step, automatic TSS, HH:MM', () => {
  const steps = bankWorkout('threshold-a', 'ride', 1, 90);
  const auto = cleanNewWorkout({ sport: 'ride', date: '2026-10-27', steps }).value.tss;
  const f = editForm(ride({ tss: auto }));
  assert.equal(f.startTime, '07:00');
  assert.equal(f.bank, 'threshold-a');
  assert.equal(f.level, 1);
  assert.equal(f.tss, null); // the steps' TSS stays automatic
  assert.equal(f.stepsTss, auto);
  assert.equal(f.otherSteps, false);
  assert.ok(f.bankOptions.length > 3);
  assert.equal(editForm(ride({ tss: 123 })).tss, 123);
});

test('editForm: a strength workout has its effort and no bank; distance in km', () => {
  const f = editForm({ sport: 'strength', date: '2026-10-28', title: 'Upper A', duration: 50, distance: null, tss: 30, intensity: 'Hard', description: 'Bench', steps: null });
  assert.deepEqual([f.effort, f.bank, f.bankOptions.length, f.distanceKm], ['hard', null, 0, null]);
  assert.equal(editForm({ sport: 'run', date: '2026-10-28', distance: 10500 }).distanceKm, 10.5);
  assert.equal(editForm({ sport: 'kayak', date: '2026-10-28' }).sport, 'other');
});

test('bankOptions names every step of a progression', () => {
  const a = bankOptions().find((b) => b.id === 'threshold-a');
  assert.equal(a.levels.length, 5);
  assert.equal(a.levels[0], '6×5 min top of Z4');
  assert.equal(bankOptions().find((b) => b.id === 'easy').levels.length, 1);
});

test('editInput keeps untouched bank steps and rebuilds them for a new step or time', () => {
  const w = ride();
  const same = editInput({ ...editForm(w), title: 'New name' }, w).value;
  assert.equal(same.steps, w.steps);
  assert.equal(same.title, 'New name');
  const harder = editInput({ ...editForm(w), level: 2 }, w).value;
  assert.equal(harder.steps.level, 2);
  assert.notEqual(harder.steps, w.steps);
  const longer = editInput({ ...editForm(w), duration: 120 }, w).value;
  assert.equal(longer.duration, 120);
  const none = editInput({ ...editForm(w), bank: null }, w).value;
  assert.equal(none.steps, null);
  assert.equal(none.intensity, 'Easy');
});

test('editInput: an empty TSS is automatic from the time and effort; a typed one wins', () => {
  const w = { sport: 'strength', date: '2026-10-28', title: 'Upper A', duration: 60, tss: 40, intensity: 'Easy', steps: null };
  const auto = editInput({ duration: 60, effort: 'moderate', tss: null, date: '2026-10-29', title: 'Upper A' }, w).value;
  assert.equal(auto.tss, 56);
  assert.equal(auto.intensity, 'Moderate');
  assert.equal(auto.date, '2026-10-29');
  assert.equal(editInput({ duration: 60, tss: 70 }, w).value.tss, 70);
  const clean = cleanNewWorkout(auto).value;
  assert.equal(clean.sport, 'strength');
  assert.equal(clean.duration, 60);
});

test('editInput refuses bad numbers and a bank workout for another sport', () => {
  const w = { sport: 'swim', date: '2026-10-28', steps: null };
  assert.ok(editInput({ duration: 0 }, w).error);
  assert.ok(editInput({ tss: -3 }, w).error);
  assert.ok(editInput({ distanceKm: 'far' }, w).error);
  assert.ok(editInput({ bank: 'threshold-a' }, w).error);
  assert.equal(editInput({ distanceKm: 2.5 }, w).value.distance, 2500);
});

test('editInput keeps steps not from the bank, and a rest day stays bare', () => {
  const custom = { version: 1, sport: 'run', name: 'Hills', steps: [{ kind: 'work', duration: { type: 'time', s: 600 }, target: { type: 'open' } }] };
  const w = { sport: 'run', date: '2026-10-28', duration: 10, steps: custom };
  assert.equal(editInput({ ...editForm(w) }, w).value.steps, custom);
  const rest = editInput({ title: '', duration: 30 }, { sport: 'rest', date: '2026-10-28' }).value;
  assert.equal(cleanNewWorkout(rest).value.duration, null);
});

test('addInput: a new run from the phone, with the effort setting the TSS', () => {
  const r = addInput({ sport: 'run', date: '2026-10-26', startTime: '16:00', title: 'Easy Z2 run with David', duration: 45, effort: 'easy', description: 'Slow' }).value;
  assert.equal(r.sport, 'run');
  assert.equal(r.date, '2026-10-26');
  assert.equal(r.startTime, '16:00');
  assert.equal(r.intensity, 'Easy');
  assert.equal(r.tss, 32);
  assert.equal(r.steps, null);
  const clean = cleanNewWorkout(r).value;
  assert.equal(clean.title, 'Easy Z2 run with David');
  assert.equal(clean.duration, 45);
});

test('addInput: a bank workout gets its steps; sport and day are required', () => {
  const r = addInput({ sport: 'ride', date: '2026-10-27', bank: 'easy', duration: 60 }).value;
  assert.ok(Array.isArray(r.steps.steps));
  assert.equal(cleanNewWorkout(r).value.workoutType, 'ride-z2');
  assert.ok(addInput({ date: '2026-10-27' }).error);
  assert.ok(addInput({ sport: 'kite', date: '2026-10-27' }).error);
  assert.ok(addInput({ sport: 'run', date: 'tomorrow' }).error);
  assert.ok(addInput(null).error);
  assert.ok(addInput({ sport: 'swim', date: '2026-10-27', bank: 'easy' }).error);
});
