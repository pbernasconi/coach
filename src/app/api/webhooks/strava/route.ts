/**
 * Strava webhook (https://developers.strava.com/docs/webhooks/). Public to Clerk (/api/webhooks).
 *
 * GET answers Strava's subscription check with hub.challenge when hub.verify_token matches
 * STRAVA_WEBHOOK_VERIFY_TOKEN. POST gets an event for each new, changed or deleted activity. Strava wants a
 * 200 within 2 s, so the work runs after the response. Events carry no signature: an event only starts a
 * fetch from Strava, and a delete is applied only when Strava itself no longer has the activity.
 *
 * A new activity is stored in full here (ingestActivity: detail, streams, weather, TSS, load, peaks), in a few
 * seconds, and only then does the "workout completed" notice go out, so the page it opens is complete. Then it
 * starts garmin.yml for the watch's own numbers, which arrive about a minute later.
 */

import { after } from 'next/server';
import { sql } from '@/db';
import { deleteStravaActivity } from '@/lib/strava-sync/sync.mjs';
import { ingestActivity } from '@/lib/strava-sync/ingest.mjs';
import { clearCache } from '@/lib/data-cache';
import { notifyStravaWorkouts } from '@/lib/notifications';
import { dispatchWorkflow } from '@/lib/plan/proposals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// An edit that arrives while the activity's create event is still storing it waits this long, so the two do not
// both insert the row.
const EDIT_WAIT_MS = 8_000;

type StravaEvent = {
  object_type?: string;
  aspect_type?: string;
  object_id?: number;
  owner_id?: number;
  updates?: Record<string, string>;
};

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const expected = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
  if (!expected || params.get('hub.mode') !== 'subscribe' || params.get('hub.verify_token') !== expected) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }
  return Response.json({ 'hub.challenge': params.get('hub.challenge') });
}

export async function POST(request: Request) {
  let event: StravaEvent;
  try {
    event = await request.json();
  } catch {
    return Response.json({ error: 'bad json' }, { status: 400 });
  }

  const [conn] = await sql`SELECT athlete_id FROM strava_connections WHERE is_active = true LIMIT 1`;
  if (!conn || Number(event.owner_id) !== Number(conn.athlete_id)) return Response.json({ ignored: true });

  after(async () => {
    try {
      if (event.object_type === 'athlete' && event.updates?.authorized === 'false') {
        await sql`UPDATE strava_connections SET is_active = false, updated_at = NOW() WHERE athlete_id = ${conn.athlete_id}`;
      } else if (event.object_type === 'activity' && event.aspect_type === 'delete' && event.object_id) {
        await deleteStravaActivity(sql, event.object_id);
        clearCache('activities');
      } else if (event.object_type === 'activity' && event.object_id) {
        const create = event.aspect_type === 'create';
        if (!create && !(await stored(event.object_id))) await new Promise((r) => setTimeout(r, EDIT_WAIT_MS));
        const r = await withRetry(() => ingestActivity(sql, event.object_id!, { streams: create ? 'always' : 'missing' }));
        clearCache('activities');
        console.log(`Strava ${event.aspect_type} ${event.object_id}: ${r.skipped ?? r.parts.join(', ')} in ${r.ms} ms`);
        // A new activity that just ended: "Run completed!" with a link to it (src/lib/notifications).
        if (r.created && r.rowId) await notifyStravaWorkouts([{ id: r.rowId }]);
        // The watch's own numbers (training effect, running dynamics): garmin.yml fetches them from Garmin Connect
        // in about a minute (scripts/garmin/activities.py).
        if (create && process.env.VERCEL_ENV === 'production') {
          const d = await dispatchWorkflow('garmin.yml', { activities: 'true' });
          if ('error' in d) console.error('Garmin activities job not started:', d.error);
        }
      }
    } catch (error) {
      console.error('Strava webhook sync failed:', error);
    }
  });

  return Response.json({ ok: true });
}

async function stored(stravaId: number) {
  const rows = await sql`SELECT 1 FROM strava_activities WHERE strava_activity_id = ${String(stravaId)} LIMIT 1`;
  return rows.length > 0;
}

/** One more try after a short wait: a Strava hiccup should not leave the activity to the 3-hourly sync. */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error('Strava ingest failed, trying again:', error);
    await new Promise((r) => setTimeout(r, 4_000));
    return fn();
  }
}
