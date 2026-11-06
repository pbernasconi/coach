/**
 * Indoor rides to Zwift through intervals.icu (src/lib/workouts/intervals.mjs), called every 30 minutes by
 * .github/workflows/sync.yml. Bearer CRON_SECRET; public to Clerk (/api/cron). The next 14 days. First, a planned run
 * or ride without steps gets the ones it implies (fill-steps.mjs), so every one of them is a structured workout.
 */

import { sql } from '@/db';
import { HOME_TZ } from '@/lib/calendar-sync/push.mjs';
import { isAuthorized } from '@/lib/lift-sync/auth.mjs';
import { addDays, todayIn } from '@/lib/plan/week.mjs';
import { fillMissingSteps } from '@/lib/workouts/fill-steps.mjs';
import { intervalsClient, syncIntervals } from '@/lib/workouts/intervals.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const [u] = (await sql`SELECT id FROM users ORDER BY created_at LIMIT 1`) as { id: string }[];
    if (!u) return Response.json({ skipped: 'no user' });
    const from = todayIn(HOME_TZ);
    const filled = await fillMissingSteps(sql, u.id, { from, to: addDays(from, 13) });
    const r = await syncIntervals(sql, u.id, intervalsClient(), { from, to: addDays(from, 13) });
    return Response.json({ ...r, filled }, { status: r.errors.length ? 502 : 200 });
  } catch (error) {
    console.error('Workout sync failed:', error);
    return Response.json({ error: String((error as Error).message ?? error) }, { status: 500 });
  }
}
