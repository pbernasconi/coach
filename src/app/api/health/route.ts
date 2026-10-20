/**
 * GET /api/health with `Authorization: Bearer $HEALTH_TOKEN`.
 *
 * Runs every page loader on the real data (src/lib/health.ts) and answers 200 when all pass, 503 when one fails,
 * with one line per check. The deploy check (.github/workflows/deploy-check.yml) calls it after each deploy and on
 * a schedule, and rolls production back when it fails.
 */
import { runChecks } from '@/lib/health';
import { isAuthorized } from '@/lib/lift-sync/auth.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.HEALTH_TOKEN)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const checks = await runChecks();
  const ok = checks.every((c) => c.ok);
  return Response.json(
    { ok, commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null, checks },
    { status: ok ? 200 : 503, headers: { 'cache-control': 'no-store' } }
  );
}
