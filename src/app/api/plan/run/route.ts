/**
 * POST /api/plan/run: the Sunday plan. sync.yml calls it every hour on Sunday from 15:00 UTC (08:00 PDT); the first
 * call makes a weekly request for next week (no answers: the planner decides from the data) and plans it with the
 * planner (src/lib/planner/run.ts) in the background, up to 5 minutes. Later calls find that request and do nothing,
 * so a week is planned once, and a failed run waits for Paolo's "Try again" on the Plan page. Bearer CRON_SECRET.
 *   → { started: id } | { skipped: reason }
 */

import { after } from 'next/server';
import { sql } from '@/db';
import { isAuthorized } from '@/lib/lift-sync/auth.mjs';
import { HOME_TZ } from '@/lib/calendar-sync/push.mjs';
import { ownerId } from '@/lib/plan/queries';
import { createRequest } from '@/lib/plan/proposals';
import { addDays, mondayOf, todayIn } from '@/lib/plan/week.mjs';
import { plannerReady, runPlanner } from '@/lib/planner/run';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const headers = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers });
  }
  const userId = await ownerId();
  if (!userId) return Response.json({ error: 'no Coach user' }, { status: 409, headers });

  const weekStart = addDays(mondayOf(todayIn(HOME_TZ)), 7);
  const existing = (await sql`
    SELECT status FROM plan_proposals
    WHERE user_id = ${userId} AND week_start = ${weekStart} AND kind = 'weekly' AND status <> 'rejected'
    LIMIT 1`) as { status: string }[];
  if (existing.length) return Response.json({ skipped: `Next week already has a plan (${existing[0].status}).` }, { headers });

  const ready = await plannerReady(userId);
  if (!ready.ready) return Response.json({ skipped: ready.reason }, { headers });

  const id = await createRequest(userId, { kind: 'weekly', weekStart, feel: null, focus: null, lock: null });
  after(() => runPlanner(userId, id));
  return Response.json({ started: id }, { status: 202, headers });
}
