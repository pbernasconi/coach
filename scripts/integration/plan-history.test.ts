// The Past plans page (src/lib/plan/history.ts) on a real Postgres: a week in Coach and a coach plan are checked
// against the planning rules, and a verdict is saved, changed and cleared.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '@/db';
import { loadPlanHistory, saveVerdict } from '@/lib/plan/history';

const user = 'user_plan_history';
const week = '2026-11-02';

test('past plans: rule baseline and verdicts', async () => {
  await sql`DELETE FROM users WHERE id = ${user}`;
  await sql`INSERT INTO users (id, email) VALUES (${user}, 'history@example.com')`;
  try {
    await sql`
      INSERT INTO training_plans (id, user_id, week_start_date, week_end_date, plan_content, ai_model, context_data, status)
      VALUES ('tp_history', ${user}, ${week}, '2026-11-08', 'x', 'test', ${JSON.stringify({ title: 'Full week' })}, 'active')`;
    // A split day: an easy run in the morning, the heavy lift in the evening (R1), and no long run (R6).
    await sql`
      INSERT INTO training_plan_activities (id, plan_id, source_key, scheduled_date, start_time, end_time, title, activity_type, workout_type, lift_template, duration, sort_order)
      VALUES ('tpa_h1', 'tp_history', 'k1', '2026-11-03', '07:00', '07:30', 'Easy run', 'run', 'run-easy', NULL, 30, 0),
             ('tpa_h2', 'tp_history', 'k2', '2026-11-03', '18:00', '19:00', 'Heavy barbell', 'strength', 'strength-heavy', 'Heavy barbell', 60, 1),
             ('tpa_h3', 'tp_history', 'k3', '2026-11-05', '08:00', '08:45', 'Upper', 'strength', 'strength-dumbbell', 'Upper (dumbbells)', 45, 2)`;
    const plan = {
      weekStart: week,
      review: { headline: 'Two lifts, long run Sunday.' },
      events: [
        { title: '🏃 Long run', start: '2026-11-08T08:00:00', end: '2026-11-08T09:45:00', workoutType: 'run-long', description: 'Long text' },
        { title: '🏋️ Heavy barbell', start: '2026-11-03T07:00:00', end: '2026-11-03T08:00:00', workoutType: 'strength-heavy', liftTemplate: 'Heavy barbell' },
        { title: '🏋️ Upper', start: '2026-11-05T07:00:00', end: '2026-11-05T07:45:00', workoutType: 'strength-dumbbell', liftTemplate: 'Upper (dumbbells)' },
      ],
    };
    await sql`
      INSERT INTO plan_proposals (id, user_id, kind, week_start, status, request, plan)
      VALUES ('pp_history', ${user}, 'weekly', ${week}, 'rejected', ${JSON.stringify({ kind: 'weekly', weekStart: week, daysOff: ['2026-11-05'] })}::jsonb, ${JSON.stringify(plan)}::jsonb)`;

    const h = await loadPlanHistory(user, '2026-11-10');
    assert.equal(h.weeks, 1);
    assert.equal(h.proposals, 1);
    const wk = h.items.find((i) => i.kind === 'week')!;
    assert.deepEqual(wk.issues.filter((i) => i.level === 'fail').map((i) => i.id).sort(), ['R1', 'R6']);
    const pr = h.items.find((i) => i.kind === 'proposal')!;
    assert.equal(pr.title, 'Two lifts, long run Sunday.');
    assert.deepEqual(pr.issues.map((i) => i.id), ['R7', 'R9'], 'the Thursday lift is on a day off; no physio');
    assert.deepEqual(h.baseline.find((b) => b.id === 'R1')!.weeks, { fail: 1, warn: 0 });

    await saveVerdict(user, pr.key, week, 'bad', 'Lift on my day off');
    await saveVerdict(user, pr.key, week, 'good', null);
    let again = await loadPlanHistory(user, '2026-11-10');
    assert.equal(again.items.find((i) => i.key === pr.key)!.verdict, 'good');
    assert.equal(again.rated, 1);
    await saveVerdict(user, pr.key, week, null, null);
    again = await loadPlanHistory(user, '2026-11-10');
    assert.equal(again.rated, 0);
  } finally {
    await sql`DELETE FROM plan_verdicts WHERE user_id = ${user}`;
    await sql`DELETE FROM plan_proposals WHERE user_id = ${user}`;
    await sql`DELETE FROM training_plan_activities WHERE plan_id = 'tp_history'`;
    await sql`DELETE FROM training_plans WHERE user_id = ${user}`;
    await sql`DELETE FROM users WHERE id = ${user}`;
  }
});
