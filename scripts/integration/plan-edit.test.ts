// Editing, deleting and restoring a planned workout on a real Postgres (src/lib/plan/month.ts): the update moves it
// between weeks and keeps a non-bank type, and Undo of a delete puts the same row back (jsonb_populate_record).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '@/db';
import { createWorkout, removeWorkout, restoreWorkout, updateWorkout } from '@/lib/plan/month';
import { cleanNewWorkout } from '@/lib/plan/create.mjs';
import { bankWorkout } from '@/lib/workouts/bank.mjs';

const user = 'user_plan_edit';
const clean = (input: Record<string, unknown>) => (cleanNewWorkout(input) as { value: Parameters<typeof createWorkout>[1] }).value;

test('edit, delete and undo a planned workout', async () => {
  await sql`DELETE FROM users WHERE id = ${user}`;
  await sql`INSERT INTO users (id, email) VALUES (${user}, 'plan@example.com')`;
  try {
    const steps = bankWorkout('threshold-a', 'ride', 1, 90);
    const id = await createWorkout(user, clean({ sport: 'ride', date: '2026-10-21', steps, distance: 40000 }));
    const [a] = await sql`SELECT workout_type, tss FROM training_plan_activities WHERE id = ${id}`;
    assert.equal(a.workout_type, 'ride-threshold-a', 'a web workout from the bank counts in the rotation');

    // Next week, no steps: the bank type goes, the distance stays, edited_at is set.
    const r = await updateWorkout(user, id, clean({ sport: 'ride', date: '2026-10-28', title: 'Easy spin', duration: 60, intensity: 'Easy' }));
    assert.deepEqual(r, { from: '2026-10-21', to: '2026-10-28' });
    const [b] = await sql`
      SELECT a.workout_type, a.title, a.distance, a.edited_at IS NOT NULL AS edited, to_char(p.week_start_date, 'YYYY-MM-DD') AS week
      FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id WHERE a.id = ${id}`;
    assert.deepEqual([b.workout_type, b.title, Number(b.distance), b.edited, b.week], [null, 'Easy spin', 40000, true, '2026-10-26']);
    assert.equal(await updateWorkout('someone_else', id, clean({ sport: 'run', date: '2026-10-28' })), null);

    const gone = await removeWorkout(user, id);
    assert.equal(gone?.date, '2026-10-28');
    assert.equal((await sql`SELECT 1 FROM training_plan_activities WHERE id = ${id}`).length, 0);
    assert.equal(await restoreWorkout('someone_else', gone!.row), null, 'only into a plan the user owns');
    assert.equal(await restoreWorkout(user, gone!.row), '2026-10-28');
    const [c] = await sql`SELECT title, distance FROM training_plan_activities WHERE id = ${id}`;
    assert.deepEqual([c.title, Number(c.distance)], ['Easy spin', 40000]);
  } finally {
    await sql`DELETE FROM training_plan_activities a USING training_plans p WHERE p.id = a.plan_id AND p.user_id = ${user}`;
    await sql`DELETE FROM training_plans WHERE user_id = ${user}`;
    await sql`DELETE FROM users WHERE id = ${user}`;
  }
});
