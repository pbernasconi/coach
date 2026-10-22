/**
 * The watch's activities from Garmin Connect (scripts/garmin/activities.py, COACH-API.md). Public to Clerk;
 * CRON_SECRET bearer only. GET ?since=<ISO>: the Garmin activity ids Coach has from then on. POST
 * { activities: [{ id, startUtc, type, summary, detail, series }] }: stores them in garmin_activities and clears the
 * activity cache, so the activity page shows the watch's numbers at once; the feel and RPE logged on the watch
 * become the workout's feedback (watch-feedback.mjs). Errors are logged without the body.
 */

import { sql } from '@/db';
import { clearCache } from '@/lib/data-cache';
import { isAuthorized } from '@/lib/lift-sync/auth.mjs';
import { ownerId } from '@/lib/plan/queries';
import { parseActivityPush } from '@/lib/activity/watch.mjs';
import { prefillWatchFeedback } from '@/lib/activity/watch-feedback.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'no-store' };
const MAX_BODY_BYTES = 4_000_000;

export async function GET(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers });
  }
  const since = Date.parse(new URL(request.url).searchParams.get('since') ?? '');
  if (!Number.isFinite(since)) return Response.json({ error: 'since must be an ISO time' }, { status: 400, headers });
  const owner = await ownerId();
  if (!owner) return Response.json({ ids: [] }, { headers });
  const rows = (await sql`
    SELECT garmin_activity_id FROM garmin_activities WHERE user_id = ${owner} AND start_utc >= ${new Date(since).toISOString()}::timestamptz`) as {
    garmin_activity_id: string;
  }[];
  return Response.json({ ids: rows.map((r) => r.garmin_activity_id) }, { headers });
}

export async function POST(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers });
  }
  try {
    const text = await request.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) return Response.json({ error: 'body too big' }, { status: 413, headers });
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return Response.json({ error: 'body is not JSON' }, { status: 400, headers });
    }
    const parsed = parseActivityPush(body);
    if ('error' in parsed) return Response.json({ error: parsed.error }, { status: 400, headers });
    const owner = await ownerId();
    if (!owner) return Response.json({ error: 'no Coach user yet' }, { status: 503, headers });
    for (const r of parsed.rows) {
      await sql`
        INSERT INTO garmin_activities (garmin_activity_id, user_id, start_utc, activity_type, summary, detail, series, fetched_at)
        VALUES (${r.id}, ${owner}, ${r.startUtc}::timestamptz, ${r.type}, ${r.summary}::jsonb, ${r.detail}::jsonb, ${r.series}::jsonb, now())
        ON CONFLICT (garmin_activity_id) DO UPDATE SET
          start_utc = EXCLUDED.start_utc, activity_type = EXCLUDED.activity_type, summary = EXCLUDED.summary,
          detail = EXCLUDED.detail, series = EXCLUDED.series, fetched_at = now()`;
    }
    if (parsed.rows.length) clearCache('activities');
    // The feel and RPE logged on the watch become the workout's "How did it go?".
    const feedback = parsed.rows.length ? await prefillWatchFeedback(sql).catch(() => ({ error: true })) : null;
    return Response.json({ accepted: parsed.rows.length, rejected: parsed.rejected, feedback }, { headers });
  } catch (error) {
    console.error('Garmin activities failed:', error instanceof Error ? error.name : 'unknown error');
    return Response.json({ error: 'internal error' }, { status: 500, headers });
  }
}
