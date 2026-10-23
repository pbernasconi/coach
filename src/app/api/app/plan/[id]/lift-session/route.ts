/**
 * Links the Lift session the phone started for a planned workout (lift/APP-API.md, "Workout Lift session"), so the
 * phone and the web show the two as one. The session itself arrives with the next sync. Bearer LIFT_SYNC_TOKEN.
 *
 *   PUT /api/app/plan/<id>/lift-session?tz=…  { sessionId: "<Lift session UUID>" }
 *
 * 200 with the workout, as GET /api/app/workouts/plan-<id>; 409 when the workout already has another session.
 */

import { appWrite } from '@/lib/app-api/route';
import { PLAN_ID } from '@/lib/plan/app-workout';
import { cleanLiftLink } from '@/lib/plan/app-status.mjs';
import { afterPlanWrite } from '@/lib/plan/app-writes';
import { linkLiftSession, workoutDate } from '@/lib/plan/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return appWrite(request, 'plan lift session', async ({ userId, today, timeZone }, body) => {
    if (!PLAN_ID.test(id)) return { status: 400, body: { error: 'id must be a plan activity id' } };
    const link = cleanLiftLink(body);
    if ('error' in link) return { status: 400, body: { error: link.error } };
    const date = await workoutDate(userId, id);
    if (!date) return { status: 404, body: { error: 'not found' } };
    if (!(await linkLiftSession(userId, id, link.sessionId))) return { status: 409, body: { error: 'the workout has another Lift session' } };
    const workout = await afterPlanWrite(userId, id, date, today, timeZone);
    return workout ? { status: 200, body: workout } : { status: 404, body: { error: 'not found' } };
  });
}
