/**
 * The activity list for the Lift iPhone app (lift/APP-API.md, "Activities"). Read-only. Public to Clerk; authenticated
 * by the LIFT_SYNC_TOKEN bearer token, as the Lift sync routes.
 *
 *   GET /api/app/activities?before=<activityId>&limit=30&tz=America/Los_Angeles
 */

import { isAuthorized } from '@/lib/lift-sync/auth.mjs';
import { loadAppActivities } from '@/lib/activity/app-api';
import { parseListQuery } from '@/lib/activity/app-api.mjs';
import { ownerId } from '@/lib/plan/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.LIFT_SYNC_TOKEN)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
  }
  const query = parseListQuery(new URL(request.url).searchParams);
  if ('error' in query) return Response.json({ error: query.error }, { status: 400, headers: NO_STORE });
  try {
    const userId = await ownerId();
    if (!userId) return Response.json({ error: 'no user' }, { status: 404, headers: NO_STORE });
    const body = await loadAppActivities(userId, query.before, query.limit, query.today, query.timeZone);
    if (!body) return Response.json({ error: 'unknown cursor' }, { status: 400, headers: NO_STORE });
    return Response.json(body, { headers: NO_STORE });
  } catch (error) {
    console.error('App activities failed:', error);
    return Response.json({ error: 'internal error' }, { status: 500, headers: NO_STORE });
  }
}
