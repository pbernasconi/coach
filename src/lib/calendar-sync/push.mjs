// Puts a plan week's workouts on Google Calendar (the personal calendar of the active connection), purple.
// The database is the source: the CLI (/plan, /check-in) and the web (move, skip, how I feel) both call
// pushWeek. Each event carries the workout id, so a re-push updates, creates and deletes only what changed.

import { refreshAccessToken } from './sync.mjs';

export const HOME_TZ = 'America/Los_Angeles';
const COLOR_ID = '3'; // Grape (purple)
const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
// Always the live app, even from a local run: the link lands on the real calendar.
export const COACH_URL = 'https://coach.paolobernasconi.com';

const addDays = (key, n) => new Date(Date.parse(`${key}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const day = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

function addMinutes(date, time, minutes) {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const nextDay = Math.floor(total / 1440);
  const mins = ((total % 1440) + 1440) % 1440;
  return { date: addDays(date, nextDay), time: `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}` };
}

/** The workout's page in Coach: its week on the Plan page, with the workout open. */
export const workoutUrl = (id, weekStart) => `${COACH_URL}/plan?week=${weekStart}&open=${encodeURIComponent(`w-${id}`)}`;

/** The Google Calendar event body for a workout row (training_plan_activities). Pure; tested. */
export function eventFor(w, weekStart) {
  const date = day(w.scheduled_date);
  const url = workoutUrl(w.id, weekStart);
  const body = {
    summary: w.title,
    description: [w.description, w.why ? `Why: ${w.why}` : null, `Open in Coach: ${url}`].filter(Boolean).join('\n\n'),
    source: { title: 'Coach', url },
    colorId: COLOR_ID,
    reminders: { useDefault: true },
    extendedProperties: {
      private: { coachManaged: 'true', coachPlanDate: weekStart, coachWorkoutId: String(w.id), ...(w.workout_type ? { coachWorkoutType: w.workout_type } : {}) },
    },
  };
  if (w.start_time) {
    const tz = w.time_zone || HOME_TZ;
    const end = w.end_time ? { date, time: w.end_time } : addMinutes(date, w.start_time, w.duration || 60);
    body.start = { dateTime: `${date}T${w.start_time}:00`, timeZone: tz };
    body.end = { dateTime: `${end.date}T${end.time}:00`, timeZone: tz };
    body.transparency = 'opaque';
  } else {
    body.start = { date };
    body.end = { date: addDays(date, 1) };
    body.transparency = 'transparent';
  }
  return body;
}

/**
 * Makes the calendar match the plan week starting `weekStart` (a Monday). Rest days and skipped workouts get no
 * event. Returns counts, or { skipped } when there is no calendar connection or Google credentials.
 */
export async function pushWeek(sql, userId, weekStart, { env = process.env, dryRun = false, log = () => {} } = {}) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return { skipped: 'no Google credentials' };
  const [conn] = await sql`
    SELECT id, google_email, refresh_token FROM calendar_connections
    WHERE user_id = ${userId} AND is_active = true ORDER BY last_synced_at DESC NULLS LAST LIMIT 1`;
  if (!conn) return { skipped: 'no calendar connection' };
  const token = await refreshAccessToken(sql, conn, env, log);
  if (!token) return { skipped: 'Google refused the token' };
  const google = async (url, init = {}) => {
    const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
    if (!r.ok) throw new Error(`${init.method ?? 'GET'} calendar: ${r.status} ${await r.text()}`);
    return r.status === 204 ? null : r.json();
  };

  const workouts = await sql`
    SELECT a.id, a.scheduled_date, a.start_time, a.end_time, a.time_zone, a.title, a.description, a.why,
           a.workout_type, a.activity_type, a.duration, a.status
    FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
    WHERE p.user_id = ${userId} AND p.week_start_date = ${weekStart}`;
  const wanted = new Map(
    workouts.filter((w) => w.status !== 'skipped' && w.activity_type !== 'rest').map((w) => [String(w.id), w])
  );

  const params = new URLSearchParams({
    privateExtendedProperty: `coachPlanDate=${weekStart}`,
    timeMin: `${addDays(weekStart, -1)}T00:00:00Z`,
    timeMax: `${addDays(weekStart, 9)}T00:00:00Z`,
    singleEvents: 'true',
    maxResults: '250',
  });
  const existing = (await google(`${API}?${params}`)).items ?? [];
  const counts = { created: 0, updated: 0, deleted: 0 };
  const seen = new Set();
  for (const e of existing) {
    const id = e.extendedProperties?.private?.coachWorkoutId;
    const w = id ? wanted.get(id) : undefined;
    if (!w || seen.has(id)) {
      log(`delete ${e.summary}`);
      if (!dryRun) await google(`${API}/${encodeURIComponent(e.id)}`, { method: 'DELETE' });
      counts.deleted++;
      continue;
    }
    seen.add(id);
    log(`update ${w.title}`);
    if (!dryRun) await google(`${API}/${encodeURIComponent(e.id)}`, { method: 'PUT', body: JSON.stringify(eventFor(w, weekStart)) });
    counts.updated++;
  }
  for (const [id, w] of wanted) {
    if (seen.has(id)) continue;
    log(`create ${w.title}`);
    if (!dryRun) await google(API, { method: 'POST', body: JSON.stringify(eventFor(w, weekStart)) });
    counts.created++;
  }
  return counts;
}
