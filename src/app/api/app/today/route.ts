/**
 * The web's Today page for the Lift iPhone app (lift/APP-API.md). Read-only. Public to Clerk; authenticated by the
 * LIFT_SYNC_TOKEN bearer token, as the Lift sync routes.
 *
 *   GET /api/app/today?tz=America/Los_Angeles
 */

import { appRoute } from '@/lib/app-api/route';
import { loadAppToday } from '@/lib/performance/app-pages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return appRoute(request, 'today', ({ userId, today, timeZone }) => loadAppToday(userId, today, timeZone));
}
