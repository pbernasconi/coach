/**
 * The backstop for Lift sessions (sync.yml, hourly): how many gym lifts from today on Lift still has to plan: no
 * live Lift session (none, or a deleted one), or a missing or wrong template name (`loadLiftRepairs`). sync.yml starts plan-apply.yml (scripts/lift-plan.mjs) when any are waiting, so a lift never
 * stays unplanned when the dispatch after an accept did not run. Bearer CRON_SECRET. The answer is a count only,
 * since the GitHub log is public.
 */

import { sql } from '@/db';
import { isAuthorized } from '@/lib/lift-sync/auth.mjs';
import { ownerId } from '@/lib/plan/queries';
import { loadLiftRepairs } from '@/lib/plan/lift-repairs.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const userId = await ownerId();
  if (!userId) return Response.json({ error: 'no owner' }, { status: 500 });
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const repairs = await loadLiftRepairs(sql, userId, today);
  return Response.json({ pending: repairs.length });
}
