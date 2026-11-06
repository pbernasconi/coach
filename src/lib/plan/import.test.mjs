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

test('a run or ride the planner left without `workout` still gets steps, and its TSS comes from them (Nov 6 2026)', async () => {
  const { rowsFromPlan } = await import('./import.mjs');
  const plan = {
    weekStart: '2026-11-02',
    events: [
      { title: '🚴 Easy Zwift ride + sprints', start: '2026-11-06T11:45:00', end: '2026-11-06T12:30:00', workoutType: 'ride-z2', tss: 169,
        description: 'Z2 spin, then 6 × 6–8 s sprints. Lift follows straight after.' },
      { title: '🏃 VO2 A', start: '2026-11-04T07:00:00', end: '2026-11-04T08:00:00', workoutType: 'run-vo2-a', tss: 80 },
      { title: '🏋️ Upper', start: '2026-11-06T12:30:00', end: '2026-11-06T13:15:00', workoutType: 'strength-dumbbell', tss: 40 },
    ],
  };
  const [ride, run, lift] = rowsFromPlan(plan);
  assert.equal(ride.steps.bank, 'easy');
  assert.equal(ride.steps.sport, 'ride');
  const sprints = ride.steps.steps.find((s) => s.kind === 'repeat');
  assert.equal(sprints.count, 6);
  assert.ok(ride.tss < 60, `an easy 45 min ride is not ${ride.tss} TSS`);
  assert.equal(run.steps.bank, 'vo2-a');
  assert.equal(lift.steps, null);
  assert.equal(lift.tss, 40);
});
