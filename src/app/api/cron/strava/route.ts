/**
 * Daily Strava sync (vercel.json cron), the backup for a missed webhook event. Vercel sends
 * `Authorization: Bearer $CRON_SECRET`. Public to Clerk (/api/cron).
 */

import { sql } from '@/db';
import { isAuthorized } from '@/lib/lift-sync/auth.mjs';
import { syncStrava } from '@/lib/strava-sync/sync.mjs';
import { syncActivityPeaks } from '@/lib/performance/peaks-sync.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await syncStrava(sql, { detailed: true, waitOnRateLimit: false });
    // Peak performances: a failure here must not fail the Strava sync.
    const peaks = await syncActivityPeaks(sql, { limit: 30 }).catch((e: unknown) => ({ error: String(e) }));
    return Response.json({ ...result, peaks });
  } catch (error) {
    console.error('Strava cron sync failed:', error);
    return Response.json({ error: String((error as Error).message ?? error) }, { status: 500 });
  }
}
