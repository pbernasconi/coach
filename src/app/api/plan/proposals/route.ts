/**
 * POST /api/plan/proposals: plan-apply.yml's call after Paolo accepts a plan. Public to Clerk; authenticated by
 * `Authorization: Bearer $CRON_SECRET`.
 *   { action: 'push', weeks: 'YYYY-MM-DD,…' } → pushes those plan weeks to Google Calendar (after Lift added the
 *     planned sets to the descriptions)
 */

import { isAuthorized } from '@/lib/lift-sync/auth.mjs';
import { ownerId } from '@/lib/plan/queries';
import { pushWeeks } from '@/lib/plan/proposals';

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
  try {
    if (body.action === 'push') {
      const weeks = String(body.weeks ?? '').split(',').filter((w) => /^\d{4}-\d{2}-\d{2}$/.test(w)).slice(0, 8);
      return Response.json({ pushed: await pushWeeks(userId, weeks) }, { headers });
    }
    return bad('action must be push');
  } catch (error) {
    console.error('Plan proposals failed:', error instanceof Error ? error.message : 'unknown error');
    return Response.json({ error: 'internal error' }, { status: 500, headers });
  }
}
