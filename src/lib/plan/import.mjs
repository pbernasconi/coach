// Imports an accepted plan (the planner's plan JSON) into training_plans and training_plan_activities, so the web
// week page and the start page can show and change it.
//
// The JSON stays the source for workouts nobody changed on the web. A workout moved, adapted or skipped on
// the web (edited_at or adapted_from set) keeps its web version. A workout removed from the JSON is
// deleted unless it was changed on the web, or (a check-in) it is on a day before `keepBefore`: past days are
// history. `liftTemplate` names the Lift template of a strength workout; scripts/lift-plan.mjs (plan-apply.yml) then
// plans the Lift session.

import { createId } from '@paralleldrive/cuid2';
import { LIFT_MARKER } from './lift-plan.mjs';
import { sportOf } from './week.mjs';
import { bankWorkout } from '../workouts/bank.mjs';
import { totals, validate } from '../workouts/steps.mjs';
import { stackDays } from './day-blocks.mjs';
import { toDay } from '../db-time.mjs';

function minutesBetween(start, end) {
  const ms = Date.parse(end) - Date.parse(start);
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 60_000) : null;
}

/**
 * The steps of a plan event: its own `steps` (a structured workout), or `workout: { bank, level }` built from the
 * coach's bank for the event's sport (from workoutType: ride-… or run-…) and planned time. Null for neither.
 */
export function stepsOf(e, duration) {
  if (e.steps) {
    const errors = validate(e.steps);
    if (errors.length) throw new Error(`${e.title}: ${errors.join('; ')}`);
    return e.steps;
  }
  if (!e.workout?.bank) return null;
  const sport = e.workout.sport ?? (/^run-/.test(e.workoutType ?? '') ? 'run' : 'ride');
  return bankWorkout(e.workout.bank, sport, e.workout.level ?? 0, e.workout.minutes ?? duration ?? 60, { reps: e.workout.reps, topMin: e.workout.topMin, zone: e.workout.zone });
}

/** The rows a plan JSON describes, without database ids. */
export function rowsFromPlan(plan) {
  const weekStart = plan.weekStart;
  // One session a day, or one stacked block (Paolo's rule): a lift hours after a run moves to straight after it.
  const { events } = stackDays(plan.events ?? []);
  const rows = events.map((e, i) => {
    const duration = e.end ? minutesBetween(e.start, e.end) : null;
    const steps = stepsOf(e, duration);
    return {
    sourceKey: `${weekStart}#${i}`,
    date: String(e.start).slice(0, 10),
    startTime: String(e.start).length > 10 ? String(e.start).slice(11, 16) : null,
    endTime: e.end && String(e.end).length > 10 ? String(e.end).slice(11, 16) : null,
    timeZone: e.timeZone ?? null,
    title: e.title,
    activityType: sportOf(e),
    workoutType: e.workoutType ?? null,
    liftTemplate: e.liftTemplate ?? null,
    intensity: e.intensity ?? null,
    duration,
    // With steps, the planned TSS comes from them: the workout window shows their TSS, and a planner's own number
    // (75 against the steps' 52 on Oct 2026's VO2 run) contradicted it.
    tss: steps ? totals(steps).tss : typeof e.tss === 'number' ? e.tss : null,
    steps,
    why: e.why ?? null,
    description: e.description ?? null,
    sortOrder: i,
  };
  });
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
      liftTemplate: null,
      steps: null,
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
 * @param {object} plan  the plan JSON
 * @param {string} [markdown]  the plan's summary, stored as plan_content
 * @param {{ keepBefore?: string | null }} [opts]  a check-in's day: workouts before it are never deleted
 * @returns {Promise<{ planId: string, inserted: number, updated: number, kept: number, deleted: number }>}
 */
export async function importPlan(sql, userId, plan, markdown, { keepBefore = null } = {}) {
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
            ${'coach planner'}, ${JSON.stringify(context)}, 'active')
    ON CONFLICT (user_id, week_start_date) DO UPDATE SET
      week_end_date = EXCLUDED.week_end_date, plan_content = EXCLUDED.plan_content,
      context_data = EXCLUDED.context_data, updated_at = NOW()
    RETURNING id`;
  const planId = planRow.id;

  const existing = await sql`
    SELECT id, source_key, scheduled_date, edited_at, adapted_from, description, intensity, lift_session_id
    FROM training_plan_activities WHERE plan_id = ${planId}`;
  // A check-in never changes a day before `keepBefore`: those rows are history. Source keys are positions in the
  // plan (weekStart#i), so a new row whose key a past row holds takes another key instead of overwriting it.
  const past = (r) => Boolean(keepBefore) && (toDay(r.scheduled_date) ?? '') < keepBefore;
  const bySource = new Map(existing.filter((r) => r.source_key && !past(r)).map((r) => [r.source_key, r]));
  const pastKeys = new Set(existing.filter((r) => r.source_key && past(r)).map((r) => r.source_key));
  const touched = (r) => r.edited_at != null || r.adapted_from != null;

  const counts = { planId, inserted: 0, updated: 0, kept: 0, deleted: 0 };
  const rows = rowsFromPlan(plan);
  for (const r of rows) while (pastKeys.has(r.sourceKey)) r.sourceKey += '~';
  for (const r of rows) {
    const old = bySource.get(r.sourceKey);
    if (old && touched(old)) {
      counts.kept++;
      continue;
    }
    if (old) {
      // A workout planned in Lift keeps its generated sets and summary until scripts/lift-plan.mjs writes new ones.
      const linked = old.lift_session_id && r.liftTemplate;
      const block = linked && String(old.description ?? '').includes(LIFT_MARKER)
        ? `${LIFT_MARKER}${String(old.description).split(LIFT_MARKER)[1]}`
        : null;
      const description = block ? [r.description, block].filter(Boolean).join('\n\n') : r.description;
      const intensity = linked && r.intensity == null ? old.intensity : r.intensity;
      await sql`
        UPDATE training_plan_activities SET
          scheduled_date = ${r.date}, start_time = ${r.startTime}, end_time = ${r.endTime}, time_zone = ${r.timeZone},
          title = ${r.title}, activity_type = ${r.activityType}, workout_type = ${r.workoutType},
          lift_template = ${r.liftTemplate}, steps = ${r.steps ? JSON.stringify(r.steps) : null}::jsonb,
          intensity = ${intensity}, duration = ${r.duration}, tss = ${r.tss},
          why = ${r.why}, description = ${description}, sort_order = ${r.sortOrder}, updated_at = NOW()
        WHERE id = ${old.id}`;
      counts.updated++;
    } else {
      await sql`
        INSERT INTO training_plan_activities (
          id, plan_id, source_key, scheduled_date, start_time, end_time, time_zone, title, activity_type,
          workout_type, lift_template, steps, intensity, duration, tss, why, description, sort_order)
        VALUES (
          ${createId()}, ${planId}, ${r.sourceKey}, ${r.date}, ${r.startTime}, ${r.endTime}, ${r.timeZone}, ${r.title},
          ${r.activityType}, ${r.workoutType}, ${r.liftTemplate}, ${r.steps ? JSON.stringify(r.steps) : null}::jsonb,
          ${r.intensity}, ${r.duration}, ${r.tss}, ${r.why},
          ${r.description}, ${r.sortOrder})`;
      counts.inserted++;
    }
  }
  const keys = new Set(rows.map((r) => r.sourceKey));
  for (const old of existing) {
    if (old.source_key && !keys.has(old.source_key) && !touched(old) && !past(old)) {
      await sql`DELETE FROM training_plan_activities WHERE id = ${old.id}`;
      counts.deleted++;
    }
  }
  return counts;
}
