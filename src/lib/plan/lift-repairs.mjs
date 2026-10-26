// The gym lifts Lift still has to plan, from the database (liftRepairs in lift-plan.mjs): for the hourly backstop
// (/api/cron/lift-pending) and scripts/lift-plan.mjs, so both see the same list.

import { liftRepairs } from './lift-plan.mjs';
import { sportOf } from './week.mjs';

/**
 * @param {any} sql
 * @param {string} userId
 * @param {string} today YYYY-MM-DD
 * @returns {Promise<{ id: string, template: string, sessionId: string | null }[]>}
 */
export async function loadLiftRepairs(sql, userId, today) {
  const [rows, templates, deleted] = await Promise.all([
    sql`
      SELECT a.id, a.status, a.activity_type, a.workout_type, a.lift_template, a.intensity, a.title, a.lift_session_id
      FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
      WHERE p.user_id = ${userId} AND a.scheduled_date >= ${today} AND a.status = 'planned'`,
    sql`
      SELECT payload->>'name' AS name FROM lift_rows
      WHERE entity = 'template' AND deleted_at IS NULL AND (payload->>'deletedAt') IS NULL`,
    sql`SELECT lower(id::text) AS id FROM lift_rows WHERE entity = 'session' AND deleted_at IS NOT NULL`,
  ]);
  return liftRepairs(
    rows.map((r) => ({
      id: String(r.id),
      status: r.status,
      sport: sportOf({ workoutType: r.workout_type, sport: r.activity_type, title: r.title }),
      workoutType: r.workout_type ?? null,
      liftTemplate: r.lift_template ?? null,
      intensity: r.intensity ?? null,
      title: String(r.title ?? ''),
      liftSessionId: r.lift_session_id ?? null,
    })),
    templates.map((t) => t.name).filter(Boolean),
    new Set(deleted.map((d) => d.id)),
  );
}
