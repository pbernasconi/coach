// Coach chat puts a wrong match right on a real Postgres (Sun 22 Nov 2026): the Paris long run's 88 min Morning Run
// counted for the 20 min "Run to the gym" on Wed 18 Nov. A card links it to the long run (the gym run lets go of it),
// logs how it felt, and Undo puts everything back. An unlink and a done without a recording too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '@/db';
import { checkProposalInput } from '@/lib/coach-chat/changes.mjs';
import { applyAll, planView, undoAll } from '@/lib/coach-chat/writes';
import { loadFeedback } from '@/lib/plan/feedback';
import { cleanNewWorkout } from '@/lib/plan/create.mjs';
import { createWorkout } from '@/lib/plan/month';

const user = 'user_coach_chat_link';
const today = '2026-11-22';
type Input = Parameters<typeof createWorkout>[1];
const add = (input: Record<string, unknown>) => createWorkout(user, (cleanNewWorkout(input) as { value: Input }).value);

async function clean() {
  await sql`DELETE FROM workout_feedback WHERE user_id = ${user}`;
  await sql`DELETE FROM strava_activities WHERE user_id = ${user}`;
  await sql`DELETE FROM strava_connections WHERE user_id = ${user}`;
  await sql`DELETE FROM training_plan_activities a USING training_plans p WHERE p.id = a.plan_id AND p.user_id = ${user}`;
  await sql`DELETE FROM training_plans WHERE user_id = ${user}`;
  await sql`DELETE FROM users WHERE id = ${user}`;
}

test('a card links the run to the right workout, logs the feel, and Undo puts it back', async () => {
  await clean();
  await sql`INSERT INTO users (id, email) VALUES (${user}, 'coach-link@example.com')`;
  await sql`INSERT INTO strava_connections (id, user_id, athlete_id, access_token, refresh_token, expires_at, scope)
    VALUES ('conn_link', ${user}, 3, 'a', 'r', 0, 'read')`;
  try {
    const gym = await add({ sport: 'run', date: '2026-11-18', startTime: '08:00', title: 'Run to the gym', duration: 20 });
    const long = await add({ sport: 'run', date: '2026-11-18', startTime: '09:30', title: 'Long run, Paris', duration: 100 });
    const easy = await add({ sport: 'run', date: '2026-11-20', startTime: '07:00', title: 'Easy run', duration: 40 });
    await sql`INSERT INTO strava_activities (id, user_id, connection_id, strava_activity_id, name, sport_type, start_date, start_date_local, moving_time, distance)
      VALUES ('act_paris', ${user}, 'conn_link', '99', 'Morning Run', 'Run', '2026-11-18T08:50:00Z'::timestamp, '2026-11-18T09:50:00'::timestamp, 5280, 15200)`;

    let view = await planView(user, today);
    const by = (id: string) => view.rows.find((r) => r.id === id)!;
    assert.deepEqual([by(gym).state, by(gym).activityId, by(long).state], ['done', '99', 'missed']);
    assert.deepEqual(view.activities.map((a) => [a.id, a.workoutId, a.min, a.km]), [['99', gym, 88, 15.2]]);

    const checked = checkProposalInput({
      title: 'Count the Morning Run for the long run',
      why: 'Based on the 88 min run on Wed',
      changes: [
        { op: 'link', id: long, activity: '99' },
        { op: 'feel', id: easy, rpe: 3, comment: 'easy shakeout' },
      ],
    }, { rows: view.rows, today, activities: view.activities }, 2);
    assert.ok(checked.ok, JSON.stringify(checked));

    const { undo } = await applyAll(user, checked.value.changes, view.rows, today);
    view = await planView(user, today);
    assert.deepEqual([by(long).state, by(long).activityId, by(long).pinned], ['done', '99', true]);
    assert.deepEqual([by(gym).state, by(gym).activityId], ['missed', null]);
    assert.equal((await loadFeedback(user, [`plan:${easy}`], easy))?.rpe, 3);
    const log = (await sql`SELECT source, after FROM plan_changes WHERE workout_id = ${long} ORDER BY id DESC LIMIT 1`) as { source: string; after: Record<string, unknown> }[];
    assert.deepEqual([log[0]?.source, log[0]?.after.matched_activity_id], ['chat', '99']);

    await undoAll(user, undo, today);
    view = await planView(user, today);
    assert.deepEqual([by(gym).activityId, by(long).state], ['99', 'missed']);
    assert.equal(await loadFeedback(user, [`plan:${easy}`], easy), null);

    // Unlink: the gym run lets go and nothing counts for it; done marks the easy run done without a recording.
    const second = checkProposalInput({
      title: 'Fix Wednesday', why: 'Based on your message',
      changes: [{ op: 'unlink', id: gym }, { op: 'done', id: easy }],
    }, { rows: view.rows, today, activities: view.activities }, 2);
    assert.ok(second.ok, JSON.stringify(second));
    const done = await applyAll(user, second.value.changes, view.rows, today);
    view = await planView(user, today);
    assert.deepEqual([by(gym).state, by(long).state, by(long).activityId], ['missed', 'done', '99']);
    assert.deepEqual([by(easy).state, by(easy).status], ['done', 'done']);
    await undoAll(user, done.undo, today);
    view = await planView(user, today);
    assert.deepEqual([by(gym).activityId, by(long).state, by(easy).state], ['99', 'missed', 'missed']);
  } finally {
    await clean();
  }
});
