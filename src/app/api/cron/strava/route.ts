/**
 * Strava sync (vercel.json daily, sync.yml every 3 hours), the backup for a missed webhook event. Then it fills in
 * up to 15 older activities that lack their detail, streams or weather (fillMissingParts), so every activity ends
 * up stored in full and no page calls Strava. Vercel sends `Authorization: Bearer $CRON_SECRET`. Public to Clerk
 * (/api/cron).
 */

import { after } from 'next/server';
import { sql } from '@/db';
import { isAuthorized } from '@/lib/lift-sync/auth.mjs';
import { syncStrava } from '@/lib/strava-sync/sync.mjs';
import { fillMissingParts } from '@/lib/activity/fetch.mjs';
import { clearCache } from '@/lib/data-cache';
import { prefillWatchFeedback } from '@/lib/activity/watch-feedback.mjs';
import { syncActivityPeaks } from '@/lib/performance/peaks-sync.mjs';
import { notifyStravaWorkouts } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await syncStrava(sql, { detailed: true, streams: 'new', waitOnRateLimit: false });
    // An activity the webhook missed still gets its notice, when it ended in the last 12 hours.
    after(() => notifyStravaWorkouts(result.created));
    // Peak performances: a failure here must not fail the Strava sync.
    const peaks = await syncActivityPeaks(sql, { limit: 30 }).catch((e: unknown) => ({ error: String(e) }));
    // Older activities without their detail, streams or weather: a few per run, newest first.
    const filled = await fillMissingParts(sql, { limit: 15 }).catch((e: unknown) => ({ error: String(e) }));
    // The watch's feel and RPE for a Garmin activity that arrived before its Strava activity.
    const feedback = await prefillWatchFeedback(sql).catch((e: unknown) => ({ error: String(e) }));
    clearCache('activities');
    return Response.json({ ...result, created: result.created.length, peaks, filled, feedback });
  } catch (error) {
    console.error('Strava cron sync failed:', error);
    return Response.json({ error: String((error as Error).message ?? error) }, { status: 500 });
  }
}
