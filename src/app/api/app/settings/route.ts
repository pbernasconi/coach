/**
 * The phone's Settings page (lift/APP-API.md, "Settings"): every connection's state and the coach's targets and next
 * event. Read-only; edits stay on the web. Authenticated by the LIFT_SYNC_TOKEN bearer token, as the Lift sync routes.
 *
 *   GET /api/app/settings?tz=America/Los_Angeles
 */

import { appRoute } from '@/lib/app-api/route';
import { loadAppSettings } from '@/lib/settings/app-settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return appRoute(request, 'settings', ({ userId, today }) => loadAppSettings(userId, today));
}
