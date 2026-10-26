import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillLiftTemplates } from './import.mjs';

const lift = (over) => ({ activityType: 'strength', workoutType: 'strength-heavy', liftTemplate: null, intensity: null, title: '🏋️ Heavy barbell lift', ...over });

test('fillLiftTemplates: a gym lift always names a template Lift has', async () => {
  const sql = async () => [{ name: 'Heavy barbell' }, { name: 'Upper (dumbbells)' }];
  const rows = [
    lift({}),
    lift({ workoutType: 'strength-dumbbell', title: 'Upper', liftTemplate: 'Upper DB' }),
    lift({ workoutType: 'strength-home', title: 'Arm finisher' }),
    { activityType: 'run', workoutType: 'run-easy', liftTemplate: null, intensity: null, title: 'Heavy barbell' },
  ];
  await fillLiftTemplates(sql, rows);
  assert.deepEqual(rows.map((r) => r.liftTemplate), ['Heavy barbell', 'Upper (dumbbells)', null, null]);
});

test('fillLiftTemplates leaves the rows when Lift templates cannot be read', async () => {
  const rows = [lift({})];
  const original = console.error;
  console.error = () => {};
  try {
    await fillLiftTemplates(async () => { throw new Error('down'); }, rows);
  } finally {
    console.error = original;
  }
  assert.equal(rows[0].liftTemplate, null);
});
