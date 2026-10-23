/**
 * The web's Health page for the Lift iPhone app's Today tab (lift/APP-API.md, "Health"). Read-only. Public to Clerk;
 * authenticated by the LIFT_SYNC_TOKEN bearer token, as the Lift sync routes.
 *
 *   GET /api/app/health?tz=America/Los_Angeles&days=30
 */

import { appRoute } from '@/lib/app-api/route';
import { healthDays, loadAppHealth } from '@/lib/vitals/app-health';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return appRoute(request, 'health', ({ userId, today, params }) => loadAppHealth(userId, today, healthDays(params.get('days'))));
}
