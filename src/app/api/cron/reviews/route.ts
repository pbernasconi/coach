/**
 * The coach's review of the last two days' planned runs and rides that have none yet (src/lib/activity/review.ts), so
 * the activity pages find it ready. Called every hour by .github/workflows/sync.yml after the Strava step. One review a
 * call (each takes Claude up to a minute). Bearer CRON_SECRET; public to Clerk (/api/cron).
 */

import { sql } from '@/db';
import { reviewRecent } from '@/lib/activity/review';
import { HOME_TZ } from '@/lib/calendar-sync/push.mjs';
import { isAuthorized } from '@/lib/lift-sync/auth.mjs';
import { todayIn } from '@/lib/plan/week.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const [u] = (await sql`SELECT id FROM users ORDER BY created_at LIMIT 1`) as { id: string }[];
    if (!u) return Response.json({ skipped: 'no user' });
    const reviewed = await reviewRecent(u.id, todayIn(HOME_TZ), 1);
    return Response.json({ reviewed });
  } catch (error) {
    console.error('Workout reviews failed:', error);
    return Response.json({ error: String((error as Error).message ?? error) }, { status: 500 });
  }
}
