import { sql } from '@/db';
import { appRoute } from '@/lib/app-api/route';
import { load, safe } from '@/lib/safe';
import { loadRange } from '@/lib/plan/month';
import { addDays, matchActivityId, mondayOf } from '@/lib/plan/week.mjs';
import { stravaTypeLabel } from '@/lib/sports';
import { loadActivity, loadActivityContext } from './queries';
import { detailResponse, listResponse, parseDetailQuery } from './app-api.mjs';

type Row = Record<string, unknown>;

// The most plan weeks one page reads: a page that spans a long break would otherwise load every week between.
const PLANNED_WEEKS = 8;

/**
 * The plan workouts that matched these activities (the plan's own matching, as the web calendar): Strava id → title.
 * Only the newest PLANNED_WEEKS weeks of the page: older activities get no title.
 */
async function plannedTitles(userId: string, rows: Row[], today: string) {
  const days = rows.map((r) => String(r.start_local ?? '').slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (!days.length) return { ok: true, titles: new Map<string, string>() };
  return safe(
    'app activities: planned titles',
    async () => {
      const last = mondayOf(days[days.length - 1]);
      const first = mondayOf(days[0]) > addDays(last, -7 * (PLANNED_WEEKS - 1)) ? mondayOf(days[0]) : addDays(last, -7 * (PLANNED_WEEKS - 1));
      const range = await loadRange(userId, first, last, today);
      const titles = new Map<string, string>();
      for (const w of range.workouts) {
        const id = matchActivityId(w.match);
        if (id && w.state === 'done') titles.set(String(id), w.title);
      }
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
 * independent section). Null when there is no such activity.
 */
export async function loadAppActivity(userId: string, id: string, today: string, timeZone: string, now = new Date()) {
  const v = await loadActivity(userId, id);
  if (!v) return null;
  const context = await load("app activity: coach's view", () => loadActivityContext(userId, v, today));
  return { body: detailResponse({ v, context, timeZone, today, now, typeLabel: stravaTypeLabel }), rowId: v.id };
}

/**
 * The handler of GET /api/app/activities/:id, through the shared appRoute (token, owner, tz, errors). It reads the
 * database only: the Strava webhook stores a new activity in full before the app can open it.
 */
export async function appActivityResponse(request: Request, rawId: string) {
  let id: string | null = null;
  try {
    const q = parseDetailQuery(rawId, new URLSearchParams());
    if (!('error' in q)) id = q.id;
  } catch {}
  return appRoute(
    request,
    'activity',
    async ({ userId, today, timeZone }) => {
      const loaded = await loadAppActivity(userId, id!, today, timeZone);
      if (!loaded) return null;
      return loaded.body;
    },
    id ? null : 'id must be a Strava id, a row id or latest'
  );
}
