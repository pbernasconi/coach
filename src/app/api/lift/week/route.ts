/**
 * The weekly plan for the Lift iPhone app (lift/WEEK-API.md). Read-only. Public to Clerk; authenticated by the
 * LIFT_SYNC_TOKEN bearer token, as the Lift sync routes.
 *
 *   GET /api/lift/week?start=2026-10-19&weeks=2&tz=America/Los_Angeles
 */

import { isAuthorized } from '@/lib/lift-sync/auth.mjs';
import { ownerId } from '@/lib/plan/queries';
import { loadLiftWeeks } from '@/lib/plan/week-api';
import { parseWeekQuery } from '@/lib/plan/week-api.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.LIFT_SYNC_TOKEN)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
  }
  const query = parseWeekQuery(new URL(request.url).searchParams);
  if ('error' in query) return Response.json({ error: query.error }, { status: 400, headers: NO_STORE });
  try {
    const userId = await ownerId();
    if (!userId) return Response.json({ error: 'no user' }, { status: 404, headers: NO_STORE });
    const body = await loadLiftWeeks(userId, query.start, query.weeks, query.today, query.timeZone);
    return Response.json(body, { headers: NO_STORE });
  } catch (error) {
    console.error('Lift week failed:', error);
    return Response.json({ error: 'internal error' }, { status: 500, headers: NO_STORE });
  }
}
