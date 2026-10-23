/**
 * Marks a planned workout done by hand, skipped, or back to planned, from the Lift app (lift/APP-API.md, "Workout
 * status"). The web's Mark done and Skip do the same. Bearer LIFT_SYNC_TOKEN, as every /api/app route.
 *
 *   PUT /api/app/plan/<id>/status?tz=…  { status: "done" | "planned" | "skipped", reason? }
 *
 * Answers with the workout, as GET /api/app/workouts/plan-<id>.
 */

import { appWrite } from '@/lib/app-api/route';
import { PLAN_ID } from '@/lib/plan/app-workout';
import { cleanPlanStatus } from '@/lib/plan/app-status.mjs';
import { afterPlanWrite } from '@/lib/plan/app-writes';
import { setDone, setSkipped, workoutDate } from '@/lib/plan/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return appWrite(request, 'plan status', async ({ userId, today, timeZone }, body) => {
    if (!PLAN_ID.test(id)) return { status: 400, body: { error: 'id must be a plan activity id' } };
    const change = cleanPlanStatus(body);
    if ('error' in change) return { status: 400, body: { error: change.error } };
    const date = await workoutDate(userId, id);
    if (!date) return { status: 404, body: { error: 'not found' } };
    if (change.status === 'skipped') await setSkipped(userId, id, true, change.reason, today);
    else await setDone(userId, id, change.status === 'done');
    const workout = await afterPlanWrite(userId, id, date, today, timeZone);
    return workout ? { status: 200, body: workout } : { status: 404, body: { error: 'not found' } };
  });
}
