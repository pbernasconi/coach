// prefillWatchFeedback on a real Postgres: the feel and RPE logged on the Garmin watch become the matching Strava
// activity's "How did it go?", once, never over feedback logged in Coach; a save in Coach drops the watch mark.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '@/db';
import { prefillWatchFeedback } from '@/lib/activity/watch-feedback.mjs';
import { loadFeedback, saveFeedback } from '@/lib/plan/feedback';

const user = 'user_watch_fb';

test('the watch feel and RPE prefill the feedback once, and never replace what Paolo logged', async () => {
  const start = new Date(Date.now() - 3 * 3600_000);
  start.setUTCMilliseconds(0);
  const iso = (d: Date) => d.toISOString();
  const naive = (d: Date) => d.toISOString().replace('T', ' ').replace('.000Z', '');
  const later = new Date(start.getTime() - 26 * 3600_000);
  try {
    await sql`DELETE FROM users WHERE id = ${user}`;
    await sql`INSERT INTO users (id, email) VALUES (${user}, 'watchfb@example.com')`;
    await sql`INSERT INTO strava_connections (id, user_id, athlete_id, access_token, refresh_token, expires_at, scope, is_active)
              VALUES ('conn_watch_fb', ${user}, 5151, 't', 'r', 0, 'read', false)`;
    for (const [id, sid, d] of [['wf1', '7001', start], ['wf2', '7002', later]] as const) {
      await sql`INSERT INTO strava_activities (id, user_id, connection_id, strava_activity_id, name, type, sport_type, moving_time, start_date, start_date_local)
                VALUES (${id}, ${user}, 'conn_watch_fb', ${sid}, 'Lunch Run', 'Run', 'Run', 1800, ${naive(d)}, ${naive(new Date(d.getTime() - 7 * 3600_000))})`;
    }
    // Run 1: feel strong (75), RPE 3 (30), Garmin's start 15 s after Strava's. Run 2: already logged in Coach.
    await sql`INSERT INTO garmin_activities (garmin_activity_id, user_id, start_utc, activity_type, detail) VALUES
      ('g7001', ${user}, ${iso(new Date(start.getTime() + 15_000))}, 'running', '{"summaryDTO": {"directWorkoutFeel": 75, "directWorkoutRpe": 30}}'::jsonb),
      ('g7002', ${user}, ${iso(later)}, 'running', '{"summaryDTO": {"directWorkoutFeel": 25, "directWorkoutRpe": 90}}'::jsonb),
      ('g7003', ${user}, ${iso(new Date(start.getTime() + 3600_000))}, 'walking', '{"summaryDTO": {"directWorkoutFeel": 50}}'::jsonb)`;
    await saveFeedback(user, { item: 'strava:7002', date: '2026-10-21', feel: 5, rpe: 6, comment: null, title: null, planActivityId: null });

    const r = await prefillWatchFeedback(sql);
    assert.equal(r.copied, 1);
    const f = await loadFeedback(user, ['strava:7001'], null);
    assert.deepEqual({ feel: f?.feel, rpe: f?.rpe, fromWatch: f?.fromWatch }, { feel: 4, rpe: 3, fromWatch: true });
    const kept = await loadFeedback(user, ['strava:7002'], null);
    assert.deepEqual({ feel: kept?.feel, rpe: kept?.rpe, fromWatch: kept?.fromWatch }, { feel: 5, rpe: 6, fromWatch: false }, 'Coach wins');
    const [pending] = await sql`SELECT feedback_at FROM garmin_activities WHERE garmin_activity_id = 'g7003'`;
    assert.equal(pending.feedback_at, null, 'no Strava match yet: waits');

    // Cleared in Coach: it does not come back.
    await saveFeedback(user, { item: 'strava:7001', date: '2026-10-22', feel: null, rpe: null, comment: null, title: null, planActivityId: null });
    assert.equal((await prefillWatchFeedback(sql)).copied, 0);
    assert.equal(await loadFeedback(user, ['strava:7001'], null), null);

    // Changed in Coach: no longer marked as from the watch.
    const saved = await saveFeedback(user, { item: 'strava:7001', date: '2026-10-22', feel: 3, rpe: 4, comment: null, title: null, planActivityId: null });
    assert.equal(saved.fromWatch, false);
  } finally {
    await sql`DELETE FROM workout_feedback WHERE user_id = ${user}`;
    await sql`DELETE FROM garmin_activities WHERE user_id = ${user}`;
    await sql`DELETE FROM strava_activities WHERE user_id = ${user}`;
    await sql`DELETE FROM strava_connections WHERE id = 'conn_watch_fb'`;
    await sql`DELETE FROM users WHERE id = ${user}`;
  }
});
