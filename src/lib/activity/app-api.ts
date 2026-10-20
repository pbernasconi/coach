import { after } from 'next/server';
import { sql } from '@/db';
import { isAuthorized } from '@/lib/lift-sync/auth.mjs';
import { ownerId } from '@/lib/plan/queries';
import { fetchActivityParts } from './fetch.mjs';
import { load, safe } from '@/lib/safe';
import { loadRange } from '@/lib/plan/month';
import { mondayOf } from '@/lib/plan/week.mjs';
import { stravaTypeLabel } from '@/lib/sports';
import { loadActivity, loadActivityContext } from './queries';
import { detailResponse, listResponse, parseDetailQuery } from './app-api.mjs';

type Row = Record<string, unknown>;

/** The plan workouts that matched these activities (the plan's own matching, as the web calendar): Strava id → title. */
async function plannedTitles(userId: string, rows: Row[], today: string) {
  const days = rows.map((r) => String(r.start_local ?? '').slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (!days.length) return { ok: true, titles: new Map<string, string>() };
  return safe(
    'app activities: planned titles',
    async () => {
      const range = await loadRange(userId, mondayOf(days[0]), mondayOf(days[days.length - 1]), today);
      const titles = new Map<string, string>();
      for (const w of range.workouts) if (w.match?.source === 'strava' && w.state === 'done') titles.set(String(w.match.id), w.title);
      return { ok: true, titles };
    },
    { ok: false, titles: new Map<string, string>() }
  );
}

/**
 * GET /api/app/activities (lift/APP-API.md): `limit` activities, newest first, older than the activity `before`.
 * Returns null when `before` is not an activity of the owner.
 */
export async function loadAppActivities(userId: string, before: string | null, limit: number, today: string, timeZone: string, now = new Date()) {
  const columns = `a.id, a.strava_activity_id, a.name, a.sport_type, a.type, a.distance, a.moving_time, a.elapsed_time, a.average_speed,
    a.tss, a.trainer, a.commute, to_char(a.start_date_local, 'YYYY-MM-DD"T"HH24:MI:SS') AS start_local`;
  let rows: Row[];
  if (before) {
    const [cursor] = (await sql`SELECT start_date, id FROM strava_activities WHERE user_id = ${userId} AND strava_activity_id = ${before} LIMIT 1`) as Row[];
    if (!cursor) return null;
    rows = (await sql.query(
      `SELECT ${columns} FROM strava_activities a
        WHERE a.user_id = $1 AND (a.start_date, a.id) < ((SELECT start_date FROM strava_activities WHERE id = $2), $2)
        ORDER BY a.start_date DESC NULLS LAST, a.id DESC LIMIT $3`,
      [userId, String(cursor.id), limit + 1]
    )) as Row[];
  } else {
    rows = (await sql.query(
      `SELECT ${columns} FROM strava_activities a WHERE a.user_id = $1 ORDER BY a.start_date DESC NULLS LAST, a.id DESC LIMIT $2`,
      [userId, limit + 1]
    )) as Row[];
  }
  const planned = await plannedTitles(userId, rows.slice(0, limit), today);
  return listResponse({ timeZone, today, now, rows, limit, planned, typeLabel: stravaTypeLabel });
}

/**
 * GET /api/app/activities/:id (lift/APP-API.md): the web's activity page (loadActivity, and loadActivityContext as an
 * independent section). Null when there is no such activity. `rowId` and `fetchNeeded` tell the route whether to
 * ask Strava for the missing parts; this loader itself only reads.
 */
export async function loadAppActivity(userId: string, id: string, today: string, timeZone: string, now = new Date()) {
  const v = await loadActivity(userId, id);
  if (!v) return null;
  const context = await load("app activity: coach's view", () => loadActivityContext(userId, v, today));
  return { body: detailResponse({ v, context, timeZone, today, now, typeLabel: stravaTypeLabel }), rowId: v.id, fetchNeeded: v.fetch.needed };
}

// One Strava fetch at a time per activity on this instance: the phone can ask again before the first one ends.
const fetching = new Set<string>();

/**
 * Starts the web page's Strava fetch (fetchActivityParts, as POST /api/activities/[id]/fetch) after the response,
 * so the next request has the details. Never on previews (their database is not the token's owner).
 */
function fetchAfterResponse(rowId: string) {
  if (fetching.has(rowId) || process.env.VERCEL_ENV === 'preview') return;
  fetching.add(rowId);
  try {
    after(async () => {
      try {
        const result = await fetchActivityParts(sql, rowId);
        if (result.error) console.error('App activity fetch failed:', result.error);
      } catch (error) {
        console.error('App activity fetch failed:', error);
      } finally {
        fetching.delete(rowId);
      }
    });
  } catch (error) {
    // after() outside a request (a script): no fetch.
    fetching.delete(rowId);
    console.error('App activity fetch not started:', error);
  }
}

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * The handler of GET /api/app/activities/:id. `fetchMissing`: start the Strava fetch for missing parts. The route
 * passes true; the health check passes false, so a check never calls Strava or after().
 */
export async function appActivityResponse(request: Request, rawId: string, { fetchMissing }: { fetchMissing: boolean }) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.LIFT_SYNC_TOKEN)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
  }
  let query: ReturnType<typeof parseDetailQuery>;
  try {
    query = parseDetailQuery(rawId, new URL(request.url).searchParams);
  } catch {
    query = { error: 'id must be a Strava id, a row id or latest' };
  }
  if ('error' in query) return Response.json({ error: query.error }, { status: 400, headers: NO_STORE });
  try {
    const userId = await ownerId();
    if (!userId) return Response.json({ error: 'no user' }, { status: 404, headers: NO_STORE });
    const loaded = await loadAppActivity(userId, query.id, query.today, query.timeZone);
    if (!loaded) return Response.json({ error: 'not found' }, { status: 404, headers: NO_STORE });
    if (fetchMissing && loaded.fetchNeeded) fetchAfterResponse(loaded.rowId);
    return Response.json(loaded.body, { headers: NO_STORE });
  } catch (error) {
    console.error('App activity failed:', error);
    return Response.json({ error: 'internal error' }, { status: 500, headers: NO_STORE });
  }
}
