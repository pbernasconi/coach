/**
 * One planned workout for the Lift iPhone app, as the web's workout window (lift/APP-API.md, "Planned workout"), and
 * its delete ("Delete a workout"). Public to Clerk; authenticated by the LIFT_SYNC_TOKEN bearer token, as the Lift
 * sync routes.
 *
 *   GET    /api/app/plan/<plan activity id>?tz=America/Los_Angeles
 *   PUT    /api/app/plan/<plan activity id>?tz=…   the Edit form ("Edit a workout") → the workout, as
 *          GET /api/app/workouts/plan-<id>; 409 for a workout already done
 *   DELETE /api/app/plan/<plan activity id>?tz=…   → { removed: true, date }; 409 for a workout already done
 */

import { appRoute, appWrite } from '@/lib/app-api/route';
import { PLAN_ID, loadAppWorkout, loadPlanWorkout } from '@/lib/plan/app-workout';
import { editInput } from '@/lib/plan/app-edit.mjs';
import { canChangePlan } from '@/lib/plan/app-status.mjs';
import { afterPlanWrite, pushPlanWeeks } from '@/lib/plan/app-writes';
import { cleanNewWorkout } from '@/lib/plan/create.mjs';
import { removeWorkout, updateWorkout, type WorkoutInput } from '@/lib/plan/month';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invalid = PLAN_ID.test(id) ? null : 'id must be a plan activity id';
  return appRoute(request, 'planned workout', ({ userId, today }) => loadAppWorkout(userId, id, today), invalid);
}

/** The web's Remove: the row goes, its Lift session too, and the calendar event with the week's next push. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return appWrite(request, 'plan delete', async ({ userId, today }) => {
    if (!PLAN_ID.test(id)) return { status: 400, body: { error: 'id must be a plan activity id' } };
    const workout = await loadAppWorkout(userId, id, today);
    if (!workout) return { status: 404, body: { error: 'not found' } };
    if (!canChangePlan(workout)) return { status: 409, body: { error: 'a done workout stays in the plan' } };
    const gone = await removeWorkout(userId, id);
    if (!gone) return { status: 404, body: { error: 'not found' } };
    pushPlanWeeks(userId, [gone.date]);
    return { status: 200, body: { removed: true, date: gone.date } };
  });
}

/**
 * The web's Edit (updateWorkoutAction): the form from GET's `edit`, filled in on the phone. A new day moves it, its
 * Lift session follows, and the old and new weeks go to Google Calendar after the answer.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return appWrite(request, 'plan edit', async ({ userId, today, timeZone }, body) => {
    if (!PLAN_ID.test(id)) return { status: 400, body: { error: 'id must be a plan activity id' } };
    const w = await loadPlanWorkout(userId, id, today);
    if (!w) return { status: 404, body: { error: 'not found' } };
    if (!canChangePlan(w)) return { status: 409, body: { error: 'a done workout stays as it is' } };
    const input = editInput(body, w);
    if ('error' in input) return { status: 400, body: { error: input.error } };
    const clean = cleanNewWorkout(input.value) as { value?: WorkoutInput; error?: string };
    if (!clean.value) return { status: 400, body: { error: clean.error ?? 'the workout is not valid' } };
    const moved = await updateWorkout(userId, id, clean.value);
    if (!moved) return { status: 404, body: { error: 'not found' } };
    const workout = await afterPlanWrite(userId, id, moved.to, today, timeZone, [moved.from]);
    return workout ? { status: 200, body: workout } : { status: 404, body: { error: 'not found' } };
  });
}
