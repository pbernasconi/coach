/**
 * Daily BodySpec sync (sync.yml): new DEXA scans, and a token refresh that keeps the sign-in alive. Bearer
 * CRON_SECRET. The answer has counts and dates only, since the GitHub log is public.
 */

import { isAuthorized } from '@/lib/lift-sync/auth.mjs';
import { ownerId } from '@/lib/plan/queries';
import { BodyspecError, syncBodyspec } from '@/lib/vitals/bodyspec-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const userId = await ownerId();
  if (!userId) return Response.json({ error: 'no owner' }, { status: 500 });
  try {
    return Response.json(await syncBodyspec(userId));
  } catch (error) {
    if (error instanceof BodyspecError && error.message === 'BodySpec is not connected') return Response.json({ skipped: 'not connected' });
    const message = error instanceof Error ? error.message : 'unknown error';
    return Response.json({ error: message }, { status: error instanceof BodyspecError && error.authFailed ? 409 : 500 });
  }
}
