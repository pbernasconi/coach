/**
 * Moves a planned workout to another day from the Lift app (lift/APP-API.md, "Move a workout"): the Week tab's drag
 * and the workout page's "Move to another day". The web's drag on /plan does the same (moveWorkout). Bearer
 * LIFT_SYNC_TOKEN, as every /api/app route.
 *
 *   PUT /api/app/plan/<id>/date?tz=…  { date: "YYYY-MM-DD" }
 *
 * Answers with the workout, as GET /api/app/workouts/plan-<id>; 409 for a workout already done.
 */

import { appWrite } from '@/lib/app-api/route';
import { PLAN_ID, loadAppWorkout } from '@/lib/plan/app-workout';
import { canChangePlan, cleanPlanDate } from '@/lib/plan/app-status.mjs';
import { afterPlanWrite } from '@/lib/plan/app-writes';
import { moveWorkout, workoutDate } from '@/lib/plan/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return appWrite(request, 'plan move', async ({ userId, today, timeZone }, body) => {
    if (!PLAN_ID.test(id)) return { status: 400, body: { error: 'id must be a plan activity id' } };
    const move = cleanPlanDate(body);
    if ('error' in move) return { status: 400, body: { error: move.error } };
    const from = await workoutDate(userId, id);
    if (!from) return { status: 404, body: { error: 'not found' } };
    if (!canChangePlan(await loadAppWorkout(userId, id, today))) return { status: 409, body: { error: 'a done workout stays on its day' } };
    if (move.date !== from) await moveWorkout(userId, id, move.date);
    const workout = await afterPlanWrite(userId, id, move.date, today, timeZone, [from]);
    return workout ? { status: 200, body: workout } : { status: 404, body: { error: 'not found' } };
  });
}
