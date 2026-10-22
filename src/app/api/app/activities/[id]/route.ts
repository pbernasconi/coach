/**
 * One activity for the Lift iPhone app: the web's /activities/[id] page as JSON (lift/APP-API.md, "Activities").
 * Reads the database only (the Strava webhook stores each activity in full when it arrives).
 * Public to Clerk; authenticated by the LIFT_SYNC_TOKEN bearer token, as the Lift sync routes.
 *
 *   GET /api/app/activities/<Strava id | row id | latest>?tz=America/Los_Angeles
 */

import { appActivityResponse } from '@/lib/activity/app-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return appActivityResponse(request, (await params).id);
}
