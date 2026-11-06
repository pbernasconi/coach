// The runs-and-rides backstop (src/lib/workouts/fill-steps.mjs) on a real Postgres: a planned ride without steps in
// range gets them and their TSS; a lift, a skipped run and a ride out of range stay as they were.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '@/db';
import { fillMissingSteps } from '@/lib/workouts/fill-steps.mjs';

const user = 'user_fill_steps';

test('fillMissingSteps gives a planned ride without steps its bank workout', async () => {
  await sql`DELETE FROM users WHERE id = ${user}`;
  await sql`INSERT INTO users (id, email) VALUES (${user}, 'fill@example.com')`;
  try {
    await sql`
      INSERT INTO training_plans (id, user_id, week_start_date, week_end_date, plan_content, ai_model, status)
      VALUES ('tp_fill', ${user}, '2026-11-02', '2026-11-08', 'x', 'test', 'active')`;
    await sql`
      INSERT INTO training_plan_activities (id, plan_id, scheduled_date, start_time, title, activity_type, workout_type, description, duration, tss, status, sort_order)
      VALUES ('tpa_f1', 'tp_fill', '2026-11-06', '11:45', 'Easy Zwift ride + sprints', 'ride', 'ride-z2', 'Z2 spin, then 6 × 6–8 s sprints.', 45, 169, 'planned', 0),
             ('tpa_f2', 'tp_fill', '2026-11-06', '12:30', 'Upper', 'strength', 'strength-dumbbell', NULL, 45, 40, 'planned', 1),
             ('tpa_f3', 'tp_fill', '2026-11-07', '08:00', 'Easy run', 'run', 'run-easy', NULL, 30, 20, 'skipped', 0),
             ('tpa_f4', 'tp_fill', '2026-11-02', '08:00', 'Easy ride', 'ride', 'ride-z2', NULL, 60, 50, 'planned', 0)`;
    const filled = await fillMissingSteps(sql, user, { from: '2026-11-06', to: '2026-11-08' });
    assert.deepEqual(filled.map((f) => f.id), ['tpa_f1']);
    const rows = (await sql`SELECT id, steps, tss FROM training_plan_activities WHERE plan_id = 'tp_fill' ORDER BY id`) as { id: string; steps: { bank: string } | null; tss: number }[];
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    assert.equal(byId.tpa_f1.steps?.bank, 'easy');
    assert.ok(Number(byId.tpa_f1.tss) < 60);
    assert.equal(byId.tpa_f2.steps, null);
    assert.equal(byId.tpa_f3.steps, null);
    assert.equal(byId.tpa_f4.steps, null);
    // A second run finds nothing left to fill.
    assert.deepEqual(await fillMissingSteps(sql, user, { from: '2026-11-06', to: '2026-11-08' }), []);
  } finally {
    await sql`DELETE FROM training_plan_activities WHERE plan_id = 'tp_fill'`;
    await sql`DELETE FROM training_plans WHERE user_id = ${user}`;
    await sql`DELETE FROM users WHERE id = ${user}`;
  }
});
