// Imports a plans/<weekStart>.json file (written by /plan and /check-in) into training_plans and
// training_plan_activities, so the web week page and the start page can show and change it.
//
// The JSON stays the source for workouts nobody changed on the web. A workout moved, adapted or skipped on
// the web (edited_at or adapted_from set) keeps its web version. A workout removed from the JSON is
// deleted unless it was changed on the web.

import { createId } from '@paralleldrive/cuid2';
import { sportOf } from './week.mjs';

function minutesBetween(start, end) {
  const ms = Date.parse(end) - Date.parse(start);
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 60_000) : null;
}

/** The rows a plan JSON describes, without database ids. */
export function rowsFromPlan(plan) {
  const weekStart = plan.weekStart;
  const rows = (plan.events ?? []).map((e, i) => ({
    sourceKey: `${weekStart}#${i}`,
    date: String(e.start).slice(0, 10),
    startTime: String(e.start).length > 10 ? String(e.start).slice(11, 16) : null,
    endTime: e.end && String(e.end).length > 10 ? String(e.end).slice(11, 16) : null,
    timeZone: e.timeZone ?? null,
    title: e.title,
    activityType: sportOf(e),
    workoutType: e.workoutType ?? null,
    intensity: e.intensity ?? null,
    duration: e.end ? minutesBetween(e.start, e.end) : null,
    tss: typeof e.tss === 'number' ? e.tss : null,
    why: e.why ?? null,
    description: e.description ?? null,
    sortOrder: i,
  }));
  for (const r of plan.rest ?? []) {
    rows.push({
      sourceKey: `${weekStart}#rest-${r.day}`,
      date: r.day,
      startTime: null,
      endTime: null,
      timeZone: null,
      title: 'Rest day',
      activityType: 'rest',
      workoutType: 'rest',
      intensity: 'rest',
      duration: 0,
      tss: 0,
      why: r.reason ?? null,
      description: r.reason ?? null,
      sortOrder: 100,
    });
  }
  return rows;
}

/**
 * @param {import('@neondatabase/serverless').NeonQueryFunction<false, false>} sql
 * @param {string} userId
 * @param {object} plan  parsed plans/<weekStart>.json
 * @param {string} [markdown]  plans/<weekStart>.md, stored as plan_content
 * @returns {Promise<{ planId: string, inserted: number, updated: number, kept: number, deleted: number }>}
 */
export async function importPlan(sql, userId, plan, markdown) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plan.weekStart ?? '')) throw new Error('plan.weekStart must be YYYY-MM-DD');
  const weekEnd = plan.weekEnd ?? plan.weekStart;
  const context = {
    title: plan.title ?? null,
    philosophy: plan.philosophy ?? null,
    constraints: plan.constraints ?? null,
    context: plan.context ?? null,
  };
  const [planRow] = await sql`
    INSERT INTO training_plans (id, user_id, week_start_date, week_end_date, plan_content, ai_model, context_data, status)
    VALUES (${createId()}, ${userId}, ${plan.weekStart}, ${weekEnd}, ${markdown ?? plan.title ?? plan.weekStart},
            ${'claude /plan'}, ${JSON.stringify(context)}, 'active')
    ON CONFLICT (user_id, week_start_date) DO UPDATE SET
      week_end_date = EXCLUDED.week_end_date, plan_content = EXCLUDED.plan_content,
      context_data = EXCLUDED.context_data, updated_at = NOW()
    RETURNING id`;
  const planId = planRow.id;

  const existing = await sql`
    SELECT id, source_key, edited_at, adapted_from FROM training_plan_activities WHERE plan_id = ${planId}`;
  const bySource = new Map(existing.filter((r) => r.source_key).map((r) => [r.source_key, r]));
  const touched = (r) => r.edited_at != null || r.adapted_from != null;

  const counts = { planId, inserted: 0, updated: 0, kept: 0, deleted: 0 };
  const rows = rowsFromPlan(plan);
  for (const r of rows) {
    const old = bySource.get(r.sourceKey);
    if (old && touched(old)) {
      counts.kept++;
      continue;
    }
    if (old) {
      await sql`
        UPDATE training_plan_activities SET
          scheduled_date = ${r.date}, start_time = ${r.startTime}, end_time = ${r.endTime}, time_zone = ${r.timeZone},
          title = ${r.title}, activity_type = ${r.activityType}, workout_type = ${r.workoutType},
          intensity = ${r.intensity}, duration = ${r.duration}, tss = ${r.tss}, why = ${r.why},
          description = ${r.description}, sort_order = ${r.sortOrder}, updated_at = NOW()
        WHERE id = ${old.id}`;
      counts.updated++;
    } else {
      await sql`
        INSERT INTO training_plan_activities (
          id, plan_id, source_key, scheduled_date, start_time, end_time, time_zone, title, activity_type,
          workout_type, intensity, duration, tss, why, description, sort_order)
        VALUES (
          ${createId()}, ${planId}, ${r.sourceKey}, ${r.date}, ${r.startTime}, ${r.endTime}, ${r.timeZone}, ${r.title},
          ${r.activityType}, ${r.workoutType}, ${r.intensity}, ${r.duration}, ${r.tss}, ${r.why}, ${r.description},
          ${r.sortOrder})`;
      counts.inserted++;
    }
  }
  const keys = new Set(rows.map((r) => r.sourceKey));
  for (const old of existing) {
    if (old.source_key && !keys.has(old.source_key) && !touched(old)) {
      await sql`DELETE FROM training_plan_activities WHERE id = ${old.id}`;
      counts.deleted++;
    }
  }
  return counts;
}
