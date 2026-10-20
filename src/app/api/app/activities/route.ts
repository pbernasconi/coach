/**
 * The activity list for the Lift iPhone app (lift/APP-API.md, "Activities"). Read-only. Public to Clerk; authenticated
 * by the LIFT_SYNC_TOKEN bearer token, as the Lift sync routes.
 *
 *   GET /api/app/activities?before=<activityId>&limit=30&tz=America/Los_Angeles
 */

import { appRoute } from '@/lib/app-api/route';
import { loadAppActivities } from '@/lib/activity/app-api';
import { parseListQuery } from '@/lib/activity/app-api.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const query = parseListQuery(new URL(request.url).searchParams);
  const invalid = 'error' in query ? query.error : null;
  // A `before` that is not one of the owner's activities: null, so 404.
  return appRoute(
    request,
    'activities',
    ({ userId, today, timeZone }) => loadAppActivities(userId, 'error' in query ? null : query.before, 'error' in query ? 30 : query.limit, today, timeZone),
    invalid
  );
}
