/**
 * The web's /lift overview for the Lift iPhone app (lift/APP-API.md, "Lift"). Read-only; Bearer LIFT_SYNC_TOKEN.
 *
 *   GET /api/app/lift?tz=America/Los_Angeles
 */

import { appRoute } from '@/lib/app-api/route';
import { loadAppLift } from '@/lib/lift-dashboard/app-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return appRoute(request, 'lift', ({ userId, today, timeZone }) => loadAppLift(userId, today, timeZone));
}
