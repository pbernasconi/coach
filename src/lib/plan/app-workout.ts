import { sql } from '@/db';
import { toDay } from '@/lib/db-time.mjs';
import { SPORTS, sport } from '@/lib/sports';
import { liftTemplateExercises, loadRange } from './month';
import { mondayOf } from './week.mjs';
import { appWorkout } from './app-workout.mjs';
import { LIFT_MARKER } from './lift-plan.mjs';
import { plainTitle } from './calendar.mjs';
import { feedbackBlock } from './feedback.mjs';
import { loadFeedback } from './feedback';
import { load } from '@/lib/safe';

const sports = { known: new Set<string>(SPORTS.map((s) => s.id)), label: (id: string) => sport(id).label };

/** A plan activity id as the Week API sends it (a UUID or another plain id). */
export const PLAN_ID = /^[A-Za-z0-9-]{1,64}$/;

/**
 * GET /api/app/plan/{id} (lift/APP-API.md, "Planned workout"): the owner's planned workout `id` with its state and
 * match from loadRange (the same data as the web calendar), or null when the owner has no such workout.
 */
export async function loadAppWorkout(userId: string, id: string, today: string) {
  const found = await loadPlanWorkout(userId, id, today);
  if (!found) return null;
  // A gym lift Lift has not planned yet (no session, no generated sets): the template's exercises, so the page still
  // lists them and Start workout has them.
  const name = found.liftTemplate;
  const unplanned = name && !found.liftSessionId && found.state !== 'done' && !String(found.description ?? '').includes(LIFT_MARKER);
  const template = unplanned ? await load('app plan: lift template', () => liftTemplateExercises(name)) : null;
  const w = template?.ok ? { ...found, templateExercises: template.value } : found;
  // "How did it feel" from the workout's day on, as the web's workout window (EffortLog).
  if (w.date > today) return { ...appWorkout(w, sports), feedback: null };
  const item = `plan:${w.id}`;
  const row = await load('app plan: feedback', () => loadFeedback(userId, [item], String(w.id)));
  const feedback = row.ok ? feedbackBlock({ item, date: w.date, title: plainTitle(w.title), planActivityId: String(w.id), row: row.value }) : null;
  return { ...appWorkout(w, sports), feedback };
}

/** The owner's planned workout `id` as the web calendar has it (loadRange), or null when there is none. */
export async function loadPlanWorkout(userId: string, id: string, today: string) {
  const rows = (await sql`
    SELECT a.scheduled_date, a.lift_template FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
    WHERE p.user_id = ${userId} AND a.id::text = ${id}
    LIMIT 1`) as { scheduled_date: unknown; lift_template: string | null }[];
  const date = rows[0] ? toDay(rows[0].scheduled_date) : null;
  if (!date) return null;
  const monday = mondayOf(date);
  const range = await loadRange(userId, monday, monday, today);
  const w = range.workouts.find((x) => String(x.id) === id);
  return w ? { ...w, liftTemplate: rows[0].lift_template ?? null } : null;
}
