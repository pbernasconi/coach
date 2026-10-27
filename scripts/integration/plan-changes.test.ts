// The plan's change log (plan_changes, a trigger on training_plan_activities) on a real Postgres: each write is
// logged once with who made it, timestamp-only updates are not, and the change_source column never keeps a value.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '@/db';
import { withPlanSource } from '@/lib/plan/change-source.mjs';
import { loadPlanChanges, recentChangesText } from '@/lib/plan/change-log';
import { createWorkout, removeWorkout, restoreWorkout } from '@/lib/plan/month';
import { moveWorkout, setSkipped } from '@/lib/plan/queries';

const user = 'user_plan_changes';

test('plan changes: who, what, when', async () => {
  await sql`DELETE FROM training_plans WHERE user_id = ${user}`;
  await sql`DELETE FROM users WHERE id = ${user}`;
  await sql`INSERT INTO users (id, email) VALUES (${user}, 'changes@example.com')`;
  try {
    const id = await withPlanSource('chat', () =>
      createWorkout(user, {
        sport: 'strength', date: '2026-11-02', startTime: '07:00', title: 'Heavy barbell', duration: 60, distance: null,
        tss: null, intensity: null, description: null, steps: null, workoutType: 'strength-heavy',
      })
    );
    await withPlanSource('app', () => moveWorkout(user, id, '2026-11-03'));
    await sql`UPDATE training_plan_activities SET updated_at = NOW() WHERE id = ${id}`; // not a change
    await setSkipped(user, id, true, 'tired'); // the Plan page
    const gone = await withPlanSource('chat', () => removeWorkout(user, id));
    assert.ok(gone);
    await withPlanSource('chat', () => restoreWorkout(user, gone!.row));

    const changes = (await loadPlanChanges(user, { workoutId: id })).reverse();
    assert.deepEqual(changes.map((c) => [c.op, c.source]), [
      ['insert', 'chat'],
      ['update', 'app'],
      ['update', 'web'],
      ['update', 'web'],
      ['delete', 'chat'],
      ['insert', 'chat'],
    ]);
    assert.equal(String(changes[1].after?.scheduled_date).slice(0, 10), '2026-11-03');
    assert.equal(String(changes[1].before?.scheduled_date).slice(0, 10), '2026-11-02');
    assert.equal(changes[4].title, 'Heavy barbell');
    const [row] = (await sql`SELECT change_source FROM training_plan_activities WHERE id = ${id}`) as { change_source: string | null }[];
    assert.equal(row.change_source, null);

    const text = await recentChangesText(user, 'America/Los_Angeles');
    assert.match(text, /iPhone · moved Heavy barbell from Mon Nov 2 to Tue Nov 3/);
  } finally {
    await sql`DELETE FROM plan_changes WHERE plan_id IN (SELECT id FROM training_plans WHERE user_id = ${user})`;
    await sql`DELETE FROM training_plans WHERE user_id = ${user}`;
    await sql`DELETE FROM users WHERE id = ${user}`;
  }
});
