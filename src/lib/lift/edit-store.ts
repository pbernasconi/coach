import { sql } from '@/db';
import { mergeDescription, intensityText } from '@/lib/plan/lift-plan.mjs';
import { push } from '@/lib/lift-sync/sync.mjs';
import { drizzleLiftRepository } from '@/lib/lift-sync/drizzle-repository';
import { strengthExercises } from '@/lib/plan/strength-text.mjs';
import { plainTitle } from '@/lib/plan/calendar.mjs';
import { linkLiftSession } from '@/lib/plan/queries';
import { catalogIdByName } from './catalog';
import { planLiftEdit, planShape, type LiftEdit } from './edit.mjs';
import { planSessionChanges } from './plan-session.mjs';
import { followLiftSession, followWorkout } from './follow-plan.mjs';

type Row = Record<string, unknown>;

/** The rows of one Lift session (and the exercise library), as the edit planner reads them. */
async function sessionRows(sessionId: string) {
  const [session] = (await sql`
    SELECT payload FROM lift_rows WHERE entity = 'session' AND id = ${sessionId}::uuid AND deleted_at IS NULL`) as { payload: Row }[];
  if (!session) return null;
  const exercises = (await sql`
    SELECT payload FROM lift_rows
    WHERE entity = 'sessionExercise' AND deleted_at IS NULL AND lower(payload->>'sessionID') = lower(${sessionId})`) as { payload: Row }[];
  const ids = exercises.map((e) => String(e.payload.id).toLowerCase());
  const sets = ids.length
    ? ((await sql`
        SELECT payload FROM lift_rows
        WHERE entity = 'set' AND deleted_at IS NULL AND lower(payload->>'sessionExerciseID') = ANY(${ids})`) as { payload: Row }[])
    : [];
  const library = (await sql`
    SELECT payload FROM lift_rows WHERE entity = 'exercise' AND deleted_at IS NULL`) as { payload: Row }[];
  return { session: session.payload, exercises: exercises.map((r) => r.payload), sets: sets.map((r) => r.payload), library: library.map((r) => r.payload) };
}

/** The Lift exercise library for "Add exercise": name, id, load mode, newest names first by name. */
export async function liftLibrary(): Promise<{ id: string; name: string; loadMode: string | null; equipment: string | null }[]> {
  const rows = (await sql`
    SELECT payload FROM lift_rows WHERE entity = 'exercise' AND deleted_at IS NULL
      AND coalesce(payload->>'isArchived', '0') NOT IN ('1', 'true')`) as { payload: Row }[];
  return rows
    .map((r) => ({ id: String(r.payload.id), name: String(r.payload.name ?? ''), loadMode: (r.payload.loadMode as string) ?? null, equipment: (r.payload.equipment as string) ?? null }))
    .filter((e) => e.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Applies edits to a planned Lift session through the Lift sync push code (so the iPhone pulls them), then
 * refreshes the plan's text copy of the sets. Returns the Mondays of the plan weeks that changed, or the problem.
 */
export async function applyLiftEdit(userId: string, sessionId: string, edits: LiftEdit[], when: { today?: string; timeZone?: string } = {}): Promise<{ weeks: string[] } | { error: string }> {
  const rows = await sessionRows(sessionId);
  if (!rows) return { error: 'The Lift session is not there.' };
  const plan = planLiftEdit(rows, edits, when) as { changes: { entity: string; op: string; payload: Row }[]; after: { exercises: Row[]; sets: Row[] } } | { error: string };
  if ('error' in plan) return plan;
  if (plan.changes.length === 0) return { weeks: [] };
  const result = await push(
    drizzleLiftRepository,
    plan.changes.map((c) => ({ idempotencyKey: crypto.randomUUID(), entity: c.entity, op: c.op, rowId: String(c.payload.id), payload: c.payload }))
  );
  if (result.rejected.length) return { error: `Lift refused the edit: ${result.rejected[0].reason}` };

  const shape = planShape(rows.session, plan.after.exercises, plan.after.sets);
  const linked = (await sql`
    SELECT a.id, a.description, to_char(p.week_start_date, 'YYYY-MM-DD') AS week
    FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
    WHERE p.user_id = ${userId} AND lower(a.lift_session_id) = lower(${sessionId})`) as { id: string; description: string | null; week: string }[];
  for (const a of linked) {
    await sql`
      UPDATE training_plan_activities SET description = ${mergeDescription(a.description, shape)}, intensity = ${intensityText(shape)},
        edited_at = NOW(), updated_at = NOW()
      WHERE id = ${a.id}`;
  }
  return { weeks: [...new Set(linked.map((a) => a.week))] };
}

type FollowResult = { done: string } | { skip: string };
const pushLift = (changes: Record<string, unknown>[]) => push(drizzleLiftRepository, changes);

/**
 * After a plan workout moved, was skipped or un-skipped, or came back with Undo: puts its Lift session on its day, or
 * removes it (src/lib/lift/follow-plan.mjs). Never throws: the plan change is already saved, and lift-plan.mjs puts
 * the session right on its next run.
 */
export async function followWorkoutInLift(activityId: string, opts: { restore?: boolean } = {}): Promise<FollowResult> {
  try {
    return (await followWorkout(sql, pushLift, activityId, opts)) as FollowResult;
  } catch (error) {
    console.error('Lift follow failed:', error);
    return { skip: 'error' };
  }
}

/** After a plan workout was deleted: removes its Lift session when nothing was logged in it. Never throws. */
export async function removeFromLift(sessionId: string | null | undefined): Promise<FollowResult> {
  try {
    return (await followLiftSession(sql, pushLift, sessionId, { remove: true })) as FollowResult;
  } catch (error) {
    console.error('Lift remove failed:', error);
    return { skip: 'error' };
  }
}

/**
 * "Log sets" on a planned strength workout written as text (a home session): a Lift session with the coach's
 * exercises (src/lib/lift/plan-session.mjs), pushed through Lift sync and linked to the workout, as the phone's
 * "Start workout" does. Returns the session id; a workout that already has one returns it.
 */
export async function startPlanLift(userId: string, planId: string, unit: 'kg' | 'lb'): Promise<{ sessionId: string } | { error: string }> {
  const [w] = (await sql`
    SELECT a.id, a.title, a.description, a.lift_session_id, to_char(a.scheduled_date, 'YYYY-MM-DD') AS day
    FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
    WHERE a.id = ${planId} AND p.user_id = ${userId}`) as { id: string; title: string | null; description: string | null; lift_session_id: string | null; day: string }[];
  if (!w) return { error: 'The workout is not there.' };
  if (w.lift_session_id) return { sessionId: String(w.lift_session_id).toLowerCase() };
  const library = (await sql`SELECT payload FROM lift_rows WHERE entity = 'exercise' AND deleted_at IS NULL`) as { payload: Row }[];
  const plan = planSessionChanges({
    title: plainTitle(w.title ?? 'Strength'),
    day: w.day,
    unit,
    exercises: strengthExercises(w.description),
    library: library.map((r) => r.payload),
    catalogId: catalogIdByName,
  });
  if ('error' in plan) return plan;
  const result = await push(
    drizzleLiftRepository,
    plan.changes.map((c) => ({ idempotencyKey: crypto.randomUUID(), entity: c.entity, op: c.op, rowId: String(c.payload.id), payload: c.payload }))
  );
  if (result.rejected.length) return { error: `Lift refused the session: ${result.rejected[0].reason}` };
  const sessionId = plan.sessionId.toLowerCase();
  if (!(await linkLiftSession(userId, w.id, sessionId))) {
    // Linked by the phone in the meantime: drop the copy just made and use that one.
    await followLiftSession(sql, pushLift, sessionId, { remove: true });
    const [again] = (await sql`SELECT lift_session_id FROM training_plan_activities WHERE id = ${w.id}`) as { lift_session_id: string | null }[];
    return again?.lift_session_id ? { sessionId: String(again.lift_session_id).toLowerCase() } : { error: 'The workout changed; try again.' };
  }
  return { sessionId };
}
