/**
 * The Coach tab's thread (lift/APP-API.md, "Coach"): the open conversation, whether Coach can answer, and the quick
 * prompts. Bearer LIFT_SYNC_TOKEN, as every /api/app route.
 *
 *   GET /api/app/coach?tz=…
 */

import { appRoute } from '@/lib/app-api/route';
import { loadCoach } from '@/lib/coach-chat/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return appRoute(request, 'coach', ({ userId }) => loadCoach(userId));
}
