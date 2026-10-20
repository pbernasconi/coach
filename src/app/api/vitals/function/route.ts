/**
 * POST /api/vitals/function: one Function Health sync (scripts/function-sync.mjs, the "Function Health sync"
 * workflow). The job reads Function and sends the results here, so it never holds the database URL. Public to Clerk;
 * authenticated by `Authorization: Bearer $CRON_SECRET`. A body of { error } records a failed run.
 * Errors are logged without the body: it is health data.
 */

import { sql } from '@/db';
import { clearCache } from '@/lib/data-cache';
import { isAuthorized } from '@/lib/lift-sync/auth.mjs';
import { ownerId } from '@/lib/plan/queries';
import { checkPayload, recordFunctionRun, storeFunctionSync } from '@/lib/vitals/function-store.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const headers = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'bad json' }, { status: 400, headers });
  }
  const invalid = checkPayload(body);
  if (invalid) return Response.json({ error: invalid }, { status: 400, headers });
  const userId = await ownerId();
  if (!userId) return Response.json({ error: 'no Coach user' }, { status: 409, headers });

  const p = body as { error?: string };
  if (p.error) {
    await recordFunctionRun(sql, userId, { error: p.error });
    clearCache('status');
    return Response.json({ recorded: 'failed run' }, { headers });
  }
  try {
    const result = await storeFunctionSync(sql, userId, body);
    await recordFunctionRun(sql, userId, { partial: result.partial, counts: result });
    clearCache('labs');
    clearCache('status');
    return Response.json(result, { headers });
  } catch (error) {
    console.error('Function sync store failed:', error instanceof Error ? error.name : 'unknown error');
    await recordFunctionRun(sql, userId, { error: 'Coach could not store the results' }).catch(() => {});
    return Response.json({ error: 'internal error' }, { status: 500, headers });
  }
}
