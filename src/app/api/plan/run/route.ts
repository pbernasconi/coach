/**
 * POST /api/plan/run: the server planner (src/lib/planner/run.ts), started by plan.yml (scripts/plan-cloud/client.mjs
 * server). Bearer CRON_SECRET.
 *   { id }  → plans that request on the server, if the server planner is on and hasn't tried it yet
 *   { }     → the Sunday run: a new weekly request for next week, unless one is already waiting or accepted
 * Answers at once with { handled: true } (the plan follows in the background, up to 5 minutes) or
 * { handled: false, reason } (the GitHub job plans it, as before).
 */

import { after } from 'next/server';
import { sql } from '@/db';
import { isAuthorized } from '@/lib/lift-sync/auth.mjs';
import { HOME_TZ } from '@/lib/calendar-sync/push.mjs';
import { ownerId } from '@/lib/plan/queries';
import { createRequest } from '@/lib/plan/proposals';
import { addDays, mondayOf, todayIn } from '@/lib/plan/week.mjs';
import { plannerRunner, runServerPlan, serverTried } from '@/lib/planner/run';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const headers = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const userId = await ownerId();
  if (!userId) return Response.json({ error: 'no Coach user' }, { status: 409, headers });

  const runner = await plannerRunner(userId);
  if (!runner.server) return Response.json({ handled: false, reason: runner.reason }, { headers });

  let id = typeof body.id === 'string' && body.id ? body.id.slice(0, 64) : null;
  if (id) {
    const [r] = (await sql`SELECT kind FROM plan_proposals WHERE id = ${id} AND user_id = ${userId}`) as { kind: string }[];
    if (!r || r.kind !== 'weekly' || (await serverTried(id))) {
      return Response.json({ handled: false, reason: 'The GitHub job plans this one.' }, { headers });
    }
  } else {
    const weekStart = addDays(mondayOf(todayIn(HOME_TZ)), 7);
    const open = (await sql`
      SELECT 1 FROM plan_proposals
      WHERE user_id = ${userId} AND week_start = ${weekStart} AND status IN ('requested', 'running', 'proposed', 'accepted')
      LIMIT 1`) as unknown[];
    if (open.length) return Response.json({ handled: true, reason: 'Next week already has a plan.' }, { headers });
    id = await createRequest(userId, { kind: 'weekly', weekStart, feel: null, focus: null, lock: null });
  }
  const proposalId = id;
  after(() => runServerPlan(userId, proposalId));
  return Response.json({ handled: true, id: proposalId }, { status: 202, headers });
}
