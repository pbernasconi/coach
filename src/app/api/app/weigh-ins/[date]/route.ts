/**
 * One day's weigh-in for the Lift iPhone app (lift/APP-API.md, "Weigh-in"): the screen a weigh-in push opens.
 * Read-only; Bearer LIFT_SYNC_TOKEN.
 *
 *   GET /api/app/weigh-ins/2026-10-22
 *   GET /api/app/weigh-ins/latest
 */

import { appRoute } from '@/lib/app-api/route';
import { WEIGH_IN_DAY, loadAppWeighIn } from '@/lib/vitals/weigh-in-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const invalid = WEIGH_IN_DAY.test(date) ? null : 'date must be YYYY-MM-DD or latest';
  return appRoute(request, 'weigh-in', ({ userId }) => loadAppWeighIn(userId, date), invalid);
}
