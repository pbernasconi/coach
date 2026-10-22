/**
 * One planned workout for the Lift iPhone app, as the web's workout window (lift/APP-API.md, "Planned workout").
 * Read-only. Public to Clerk; authenticated by the LIFT_SYNC_TOKEN bearer token, as the Lift sync routes.
 *
 *   GET /api/app/plan/<plan activity id>?tz=America/Los_Angeles
 */

import { appRoute } from '@/lib/app-api/route';
import { PLAN_ID, loadAppWorkout } from '@/lib/plan/app-workout';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invalid = PLAN_ID.test(id) ? null : 'id must be a plan activity id';
  return appRoute(request, 'planned workout', ({ userId, today }) => loadAppWorkout(userId, id, today), invalid);
}
