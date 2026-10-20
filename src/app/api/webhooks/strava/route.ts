/**
 * Strava webhook (https://developers.strava.com/docs/webhooks/). Public to Clerk (/api/webhooks).
 *
 * GET answers Strava's subscription check with hub.challenge when hub.verify_token matches
 * STRAVA_WEBHOOK_VERIFY_TOKEN. POST gets an event for each new, changed or deleted activity. Strava wants a
 * 200 within 2 s, so the sync runs after the response. Events carry no signature: an event only starts a
 * sync, and a delete is applied only when Strava itself no longer has the activity.
 */

import { after } from 'next/server';
import { sql } from '@/db';
import { deleteStravaActivity, syncStrava } from '@/lib/strava-sync/sync.mjs';
import { syncActivityPeaks } from '@/lib/performance/peaks-sync.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
      } else if (event.object_type === 'activity') {
        await syncStrava(sql, { detailed: true, waitOnRateLimit: false });
        await syncActivityPeaks(sql, { limit: 5 }).catch((e: unknown) => console.error('Peak scan failed:', e));
      }
    } catch (error) {
      console.error('Strava webhook sync failed:', error);
    }
  });

  return Response.json({ ok: true });
}
