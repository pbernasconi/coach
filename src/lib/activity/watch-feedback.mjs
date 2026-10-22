// @ts-check
/**
 * The feel and RPE logged on the Garmin watch after a workout become the workout's "How did it go?" in Coach
 * (workout_feedback, item 'strava:<id>'), so Paolo does not key them in twice. Each Garmin activity is copied once
 * (garmin_activities.feedback_at), when it has a matching Strava activity, and never over feedback logged in
 * Coach. Runs after Garmin activities arrive, after the Strava webhook and in the Strava cron.
 */
import { MATCH_SECONDS, watchFeedback } from './watch.mjs';

/** Garmin activities older than this are not copied (one with no Strava match would wait forever). */
const WINDOW_DAYS = 7;

/**
 * @param {any} sql the `sql` tagged template from '@/db'
 * @returns {Promise<{ copied: number, checked: number }>}
 */
export async function prefillWatchFeedback(sql) {
  const rows = await sql`
    SELECT g.garmin_activity_id, g.user_id, g.summary, g.detail, s.strava_activity_id, s.name,
           to_char(s.start_date_local, 'YYYY-MM-DD') AS day
    FROM garmin_activities g
    CROSS JOIN LATERAL (
      SELECT strava_activity_id, name, start_date_local FROM strava_activities s
      WHERE s.user_id = g.user_id
        AND s.start_date BETWEEN (g.start_utc AT TIME ZONE 'UTC') - make_interval(secs => ${MATCH_SECONDS})
                             AND (g.start_utc AT TIME ZONE 'UTC') + make_interval(secs => ${MATCH_SECONDS})
      ORDER BY abs(extract(epoch FROM s.start_date - (g.start_utc AT TIME ZONE 'UTC'))) LIMIT 1
    ) s
    WHERE g.feedback_at IS NULL AND g.start_utc >= now() - make_interval(days => ${WINDOW_DAYS})`;
  let copied = 0;
  for (const r of rows) {
    const f = watchFeedback(r);
    if (f) {
      const done = await sql`
        INSERT INTO workout_feedback (user_id, item, date, title, feel, rpe, source)
        VALUES (${r.user_id}, ${`strava:${r.strava_activity_id}`}, ${r.day}::date, ${r.name ?? null}, ${f.feel}, ${f.rpe}, 'watch')
        ON CONFLICT (user_id, item) DO NOTHING
        RETURNING item`;
      copied += done.length;
    }
    await sql`UPDATE garmin_activities SET feedback_at = now() WHERE garmin_activity_id = ${r.garmin_activity_id}`;
  }
  return { copied, checked: rows.length };
}
