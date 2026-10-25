/**
 * POST /api/plan/proposals: the cloud plan job's calls (scripts/plan-cloud/client.mjs, .github/workflows/plan.yml and
 * plan-apply.yml). Public to Clerk; authenticated by `Authorization: Bearer $CRON_SECRET`.
 *   { action: 'claim', id? }               → { id, request }   (no id: a new weekly request for next week)
 *   { action: 'submit', id, plan, summary, context? } → { events, tss, fails, warns }  (the format is checked, and a
 *     bad one fails the request; the planning rules only report; context is the profile.json, kept for the evals)
 *   { action: 'fail', id, error }
 *   { action: 'push', weeks: 'YYYY-MM-DD,…' } → pushes those plan weeks to Google Calendar
 */

import { isAuthorized } from '@/lib/lift-sync/auth.mjs';
import { ownerId } from '@/lib/plan/queries';
import { claimRequest, failRequest, pushWeeks, submitPlan } from '@/lib/plan/proposals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const headers = { 'Cache-Control': 'no-store' };
const bad = (error: string, status = 400) => Response.json({ error }, { status, headers });

export async function POST(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) return bad('unauthorized', 401);
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return bad('bad json');
  }
  const userId = await ownerId();
  if (!userId) return bad('no Coach user', 409);
  const id = typeof body.id === 'string' && body.id ? body.id.slice(0, 64) : null;

  try {
    if (body.action === 'claim') {
      const r = await claimRequest(userId, id);
      return r ? Response.json(r, { headers }) : bad('no open request with that id', 404);
    }
    if (body.action === 'submit') {
      if (!id) return bad('id is required');
      const summary = typeof body.summary === 'string' ? body.summary.slice(0, 6000) : null;
      const context = body.context && typeof body.context === 'object' && JSON.stringify(body.context).length < 1_000_000 ? body.context : null;
      const r = await submitPlan(userId, id, body.plan, summary, context);
      return 'error' in r ? bad(String(r.error), 422) : Response.json(r, { headers });
    }
    if (body.action === 'fail') {
      if (!id) return bad('id is required');
      await failRequest(userId, id, String(body.error ?? 'The plan job failed.'));
      return Response.json({ ok: true }, { headers });
    }
    if (body.action === 'push') {
      const weeks = String(body.weeks ?? '').split(',').filter((w) => /^\d{4}-\d{2}-\d{2}$/.test(w)).slice(0, 8);
      return Response.json({ pushed: await pushWeeks(userId, weeks) }, { headers });
    }
    return bad('action must be claim, submit, fail or push');
  } catch (error) {
    console.error('Plan proposals failed:', error instanceof Error ? error.message : 'unknown error');
    return Response.json({ error: 'internal error' }, { status: 500, headers });
  }
}
