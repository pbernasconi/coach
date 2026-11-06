// The backstop for runs and rides without steps: every 30 minutes (/api/cron/workouts) a planned run or ride in the
// next two weeks that has none gets the bank workout it implies (impliedSteps), with the TSS from those steps, so
// Zwift and Garmin always get a structured workout and the phone never shows a ride as free text. The planner and
// Coach chat already give every run and ride steps; this catches anything that slipped past (Nov 6 2026: an easy
// Zwift ride with sprints planned without `workout` showed 169 TSS and no steps).

import { impliedSteps } from './bank.mjs';
import { totals } from './steps.mjs';
import { sportOf } from '../plan/week.mjs';
import { workoutTypeFor } from '../plan/create.mjs';

/**
 * The fills for rows without steps: { id, steps, tss, workoutType } for each planned run or ride. Pure.
 * @param {Array<Record<string, any>>} rows  training_plan_activities rows (snake_case)
 */
export function stepFills(rows) {
  const out = [];
  for (const r of rows) {
    if (r.steps || r.status === 'skipped') continue;
    const sport = sportOf({ sport: r.activity_type, workoutType: r.workout_type, title: r.title });
    if (sport !== 'run' && sport !== 'ride') continue;
    const steps = impliedSteps({
      sport, workoutType: r.workout_type, title: r.title, description: r.description, intensity: r.intensity,
      duration: r.duration == null ? null : Number(r.duration),
    });
    if (!steps) continue;
    out.push({ id: String(r.id), title: String(r.title ?? ''), steps, tss: Math.round(totals(steps).tss), workoutType: r.workout_type ?? workoutTypeFor(sport, steps) });
  }
  return out;
}

/**
 * Gives the planned runs and rides from `from` to `to` (days, inclusive) without steps their implied steps.
 * @param {any} sql @param {string} userId @param {{ from: string, to: string }} range
 * @returns {Promise<Array<{ id: string, title: string }>>} the workouts it filled
 */
export async function fillMissingSteps(sql, userId, { from, to }) {
  const rows = await sql`
    SELECT a.id, a.title, a.activity_type, a.workout_type, a.description, a.intensity, a.duration, a.status, a.steps
    FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
    WHERE p.user_id = ${userId} AND a.steps IS NULL AND a.status = 'planned'
      AND a.scheduled_date >= ${from} AND a.scheduled_date < ${to}::date + 1`;
  const fills = stepFills(rows);
  for (const f of fills) {
    await sql`
      UPDATE training_plan_activities SET steps = ${JSON.stringify(f.steps)}::jsonb, tss = ${f.tss},
        workout_type = ${f.workoutType}, change_source = 'planner', updated_at = NOW()
      WHERE id = ${f.id} AND steps IS NULL`;
    console.warn(`Gave "${f.title}" (${f.id}) the steps it was missing: ${f.steps.name}.`);
  }
  return fills.map((f) => ({ id: f.id, title: f.title }));
}
