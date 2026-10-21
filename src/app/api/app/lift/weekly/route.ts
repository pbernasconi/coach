/**
 * The web's /lift/weekly table for the Lift iPhone app (lift/APP-API.md, "Lift"). Read-only; Bearer LIFT_SYNC_TOKEN.
 *
 *   GET /api/app/lift/weekly
 */

import { appRoute } from '@/lib/app-api/route';
import { loadAppLiftWeekly } from '@/lib/lift-dashboard/app-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return appRoute(request, 'lift weekly', () => loadAppLiftWeekly());
}
