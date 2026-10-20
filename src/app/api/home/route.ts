/**
 * Start-page summary for Dia Home. Public to Clerk; authenticated by the HOME_TOKEN bearer token.
 *
 *   GET /api/home?tz=Asia/Tokyo
 *
 * `activities` and `sessions` have the same shape as dia-home's data/feed.json, so the page can use either.
 */

import { sql } from '@/db';
import { isAuthorized } from '@/lib/lift-sync/auth.mjs';
import { loadLiftModel } from '@/lib/lift-dashboard/queries';
import { sessionSummaries, weeklyVolume } from '@/lib/lift-dashboard/stats.mjs';
import { loadWeek, ownerId } from '@/lib/plan/queries';
import { addDays, mondayOf, todayIn } from '@/lib/plan/week.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

function zone(tz: string | null) {
  try {
    if (tz) {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return tz;
    }
  } catch {}
  return 'America/Los_Angeles';
}

type Row = Record<string, unknown>;
const iso = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 19) : String(v ?? ''));

export async function GET(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.HOME_TOKEN)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: CORS });
  }
  try {
    const userId = await ownerId();
    if (!userId) return Response.json({ error: 'no user' }, { status: 404, headers: CORS });

    const timeZone = zone(new URL(request.url).searchParams.get('tz'));
    const today = todayIn(timeZone);
    const weekStart = mondayOf(today);
    const base = process.env.BASE_URL ?? 'https://coach-paolo.vercel.app';

    const [week, nextWeek, acts, load, conn, liftChange, lift] = await Promise.all([
      loadWeek(userId, weekStart, today),
      loadWeek(userId, addDays(weekStart, 7), today),
      sql`
        SELECT strava_activity_id, name, sport_type, start_date_local, distance, moving_time, total_elevation_gain,
               location_city, location_state, location_country, suffer_score, tss
        FROM strava_activities
        WHERE user_id = ${userId} AND start_date_local >= ${addDays(today, -35)}
        ORDER BY start_date_local DESC LIMIT 100` as Promise<Row[]>,
      sql`SELECT date, ctl, atl, tsb FROM daily_training_load WHERE user_id = ${userId} ORDER BY date DESC LIMIT 1` as Promise<Row[]>,
      sql`SELECT last_synced_at, is_active FROM strava_connections LIMIT 1` as Promise<Row[]>,
      sql`SELECT max(updated_at) AS at FROM lift_rows` as Promise<Row[]>,
      loadLiftModel(),
    ]);

    const workouts = [...week.workouts, ...nextWeek.workouts].map((w) => ({
      id: w.id,
      date: w.date,
      startTime: w.startTime,
      endTime: w.endTime,
      title: w.title,
      sport: w.sport,
      intensity: w.intensity,
      duration: w.duration,
      tss: w.tss,
      why: w.why,
      description: w.description,
      state: w.state,
      match: w.match,
      adapted: Boolean(w.adaptedFrom),
    }));
    const upcoming = workouts.filter((w) => w.date >= today && w.date <= addDays(today, 6) && w.state !== 'skipped');

    const summaries = sessionSummaries(lift.model, lift.unit);
    const lastLift = summaries[0] ?? null;
    const liftWeek = weeklyVolume(lift.model, lift.unit).find((x: { week: string }) => x.week === weekStart);

    return Response.json(
      {
        generatedAt: new Date().toISOString(),
        timeZone,
        today,
        planUrl: `${base}/plan`,
        week: {
          start: weekStart,
          title: week.title,
          feel: week.feel,
          hasPlan: Boolean(week.planId),
          workouts: workouts.filter((w) => w.date >= weekStart && w.date <= addDays(weekStart, 6)),
        },
        upcoming,
        // feed.json shape
        appUrl: base,
        activities: acts.map((a) => ({
          id: String(a.strava_activity_id ?? ''),
          url: a.strava_activity_id ? `https://www.strava.com/activities/${a.strava_activity_id}` : null,
          name: String(a.name ?? ''),
          sport: String(a.sport_type ?? ''),
          start: iso(a.start_date_local),
          distanceKm: Math.round(Number(a.distance ?? 0) / 10) / 100,
          movingMin: Math.round(Number(a.moving_time ?? 0) / 6) / 10,
          elevM: Number(a.total_elevation_gain ?? 0),
          place: [a.location_city, a.location_state ?? a.location_country].filter(Boolean).join(', '),
          effort: Number(a.suffer_score ?? 0),
          tss: a.tss == null ? null : Number(a.tss),
        })),
        sessions: upcoming
          .filter((w) => w.sport !== 'rest')
          .map((w) => ({
            title: w.title,
            start: `${w.date}T${w.startTime ?? '00:00'}:00`,
            end: `${w.date}T${w.endTime ?? w.startTime ?? '00:00'}:00`,
          })),
        lift: {
          last: lastLift
            ? { date: lastLift.day, name: lastLift.title || 'Lift session', setsLogged: lastLift.setsLogged, volume: Math.round(lastLift.volume), unit: lift.unit }
            : null,
          weekSessions: summaries.filter((s: { day: string }) => s.day >= weekStart).length,
          recent: summaries
            .filter((s: { day: string }) => s.day >= addDays(today, -35))
            .map((s: { day: string; title: string; startedAt: string | null; setsLogged: number }) => ({
              date: s.day,
              name: s.title || 'Lift session',
              startedAt: s.startedAt,
              setsLogged: s.setsLogged,
            })),
          weekHardSets: liftWeek?.sets ?? 0,
        },
        fitness: load[0]
          ? { date: String(load[0].date).slice(0, 10), ctl: Number(load[0].ctl), atl: Number(load[0].atl), tsb: Number(load[0].tsb) }
          : null,
        sync: {
          stravaLastSyncedAt: conn[0]?.last_synced_at ?? null,
          stravaConnected: Boolean(conn[0]?.is_active),
          liftLastChangeAt: liftChange[0]?.at ?? null,
        },
      },
      { headers: { ...CORS, 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Home summary failed:', error);
    return Response.json({ error: 'internal error' }, { status: 500, headers: CORS });
  }
}
