/**
 * GET /api/health with `Authorization: Bearer $HEALTH_TOKEN`.
 *
 * Runs every page loader on the real data (src/lib/health.ts) and answers 200 when all pass, 503 when one fails,
 * with one line per check, plus the commit and Vercel deployment it runs on. `?skip=migrations` leaves out the
 * migrations check (a staged build, checked before the merge runs its migrations). The Deploy workflow calls it
 * before and after each promote; the deploy check calls it on previews and on a schedule.
 */
import { runChecks } from '@/lib/health';
import { isAuthorized } from '@/lib/lift-sync/auth.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.HEALTH_TOKEN)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const skip = new URL(request.url).searchParams.get('skip');
  const checks = await runChecks(new Date(), { migrations: skip !== 'migrations' });
  const ok = checks.every((c) => c.ok);
  return Response.json(
    { ok, commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null, deployment: process.env.VERCEL_DEPLOYMENT_ID ?? null, checks },
    { status: ok ? 200 : 503, headers: { 'cache-control': 'no-store' } }
  );
}
