/**
 * One planned workout for the Lift iPhone app, as the web's workout window (lift/APP-API.md, "Planned workout"), and
 * its delete ("Delete a workout"). Public to Clerk; authenticated by the LIFT_SYNC_TOKEN bearer token, as the Lift
 * sync routes.
 *
 *   GET    /api/app/plan/<plan activity id>?tz=America/Los_Angeles
 *   DELETE /api/app/plan/<plan activity id>?tz=…   → { removed: true, date }; 409 for a workout already done
 */

import { appRoute, appWrite } from '@/lib/app-api/route';
import { PLAN_ID, loadAppWorkout } from '@/lib/plan/app-workout';
import { canChangePlan } from '@/lib/plan/app-status.mjs';
import { pushPlanWeeks } from '@/lib/plan/app-writes';
import { removeWorkout } from '@/lib/plan/month';

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
