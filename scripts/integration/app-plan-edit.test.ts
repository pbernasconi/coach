// The phone's Edit of a planned workout on a real Postgres (lift/APP-API.md, "Edit a workout"): the form comes from the
// same loadRange row as the web, and a save through editInput, cleanNewWorkout and updateWorkout rebuilds bank steps
// for a new step, moves the day, and keeps steps the phone did not touch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '@/db';
import { loadAppWorkout, loadPlanWorkout } from '@/lib/plan/app-workout';
import { editForm, editInput } from '@/lib/plan/app-edit.mjs';
import { createWorkout, updateWorkout } from '@/lib/plan/month';
import { cleanNewWorkout } from '@/lib/plan/create.mjs';
import { bankWorkout } from '@/lib/workouts/bank.mjs';

const user = 'user_app_plan_edit';
type Input = Parameters<typeof createWorkout>[1];
const clean = (input: Record<string, unknown>) => (cleanNewWorkout(input) as { value: Input }).value;

async function save(id: string, change: Record<string, unknown>) {
  const w = await loadPlanWorkout(user, id, '2026-10-20');
  assert.ok(w);
  const input = editInput({ ...editForm(w), ...change }, w);
  assert.ok('value' in input, JSON.stringify(input));
  return updateWorkout(user, id, clean(input.value as Record<string, unknown>));
}

test('the phone edits a planned workout as the web does', async () => {
  await sql`DELETE FROM users WHERE id = ${user}`;
  await sql`INSERT INTO users (id, email) VALUES (${user}, 'app-edit@example.com')`;
  try {
    const steps = bankWorkout('threshold-a', 'ride', 1, 90);
    const id = await createWorkout(user, clean({ sport: 'ride', date: '2026-10-22', startTime: '07:00', steps, distance: 40000 }));

    const body = await loadAppWorkout(user, id, '2026-10-20');
    assert.ok(body?.edit, 'a workout still to do sends its form');
    assert.deepEqual(
      [body.edit.bank, body.edit.level, body.edit.startTime, body.edit.duration, body.edit.distanceKm, body.edit.tss],
      ['threshold-a', 1, '07:00', body.edit.stepsMinutes, 40, null]
    );

    // Only the title: the steps stay as stored.
    await save(id, { title: 'Threshold, outside' });
    const [a] = await sql`SELECT title, steps, workout_type FROM training_plan_activities WHERE id = ${id}`;
    assert.equal(a.title, 'Threshold, outside');
    assert.equal(a.steps.level, 1);
    assert.equal(a.workout_type, 'ride-threshold-a');

    // The next step, another day, a typed TSS.
    const moved = await save(id, { level: 2, date: '2026-10-29', tss: 111, startTime: null });
    assert.deepEqual(moved, { from: '2026-10-22', to: '2026-10-29' });
    const [b] = await sql`
      SELECT a.steps, a.tss, a.start_time, to_char(p.week_start_date, 'YYYY-MM-DD') AS week
      FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id WHERE a.id = ${id}`;
    assert.deepEqual([b.steps.level, Number(b.tss), b.start_time, b.week], [2, 111, null, '2026-10-26']);

    // No bank workout: an effort and an automatic TSS from the time.
    await save(id, { bank: null, effort: 'moderate', duration: 60, tss: null });
    const [c] = await sql`SELECT steps, tss, intensity, workout_type FROM training_plan_activities WHERE id = ${id}`;
    assert.deepEqual([c.steps, Number(c.tss), c.intensity, c.workout_type], [null, 56, 'Moderate', null]);
  } finally {
    await sql`DELETE FROM training_plan_activities a USING training_plans p WHERE p.id = a.plan_id AND p.user_id = ${user}`;
    await sql`DELETE FROM training_plans WHERE user_id = ${user}`;
    await sql`DELETE FROM users WHERE id = ${user}`;
  }
});
