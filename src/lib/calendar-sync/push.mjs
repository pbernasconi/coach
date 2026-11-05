// Puts a plan week's workouts on Google Calendar (the personal calendar of the active connection), purple.
// The database is the source. Every plan write pushes the weeks it touched right after it answers: the web (Plan
// page), the iPhone (/api/app/plan), Coach chat's Apply, an accepted planner week, Lift moves, scripts/plan-edit.mjs.
// Each event carries the workout id (and, since 2026-11, the workout's own event id, eventIdFor), so a re-push
// updates, creates and deletes only what changed, and never makes a second event for a workout.
// A workout moved on the calendar (another time or day) keeps that move: the push copies it into the database
// first (adoptMove). Each event records the time Coach last wrote (coachTime), so a push can tell a move on the
// calendar from a change in Coach. The calendar sync (/api/cron/calendar) runs the push every hour, so a
// move reaches Coach, Zwift and the watch soon after.

import { refreshAccessToken } from './sync.mjs';

export const HOME_TZ = 'America/Los_Angeles';
const COLOR_ID = '3'; // Grape (purple)
const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
// Always the live app, even from a local run: the link lands on the real calendar.
export const COACH_URL = 'https://coach.paolobernasconi.com';

const addDays = (key, n) => new Date(Date.parse(`${key}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const day = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
const mondayOf = (key) => addDays(key, -((new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7));

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
export function eventFor(w, weekStart = mondayOf(day(w.scheduled_date))) {
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
    // An end at or before the start (an old end after a move) would be refused by Google: start + length then.
    const end = w.end_time && w.end_time > w.start_time ? { date, time: w.end_time } : addMinutes(date, w.start_time, w.duration || 60);
    body.start = { dateTime: `${date}T${w.start_time}:00`, timeZone: tz };
    body.end = { dateTime: `${end.date}T${end.time}:00`, timeZone: tz };
    body.transparency = 'opaque';
  } else {
    body.start = { date };
    body.end = { date: addDays(date, 1) };
    body.transparency = 'transparent';
  }
  body.extendedProperties.private.coachTime = timeKey(wallOf(body));
  return body;
}

/** Wall-clock 'YYYY-MM-DD' and 'HH:MM' of an instant in a time zone. */
function wallAt(ms, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/**
 * An event's start and end as local wall-clock in its own zone: { date, time, endDate, endTime, timeZone, minutes },
 * time null for an all-day event. Works for an event body Coach writes (no offset) and one Google returns (an
 * offset, maybe of another zone). Pure; tested.
 */
export function wallOf(e) {
  if (!e.start?.dateTime) {
    const date = day(e.start?.date);
    return { date, time: null, endDate: null, endTime: null, timeZone: null, minutes: null };
  }
  const timeZone = e.start.timeZone || HOME_TZ;
  const local = (dt) => (/(Z|[+-]\d{2}:\d{2})$/.test(dt) ? wallAt(Date.parse(dt), timeZone) : { date: dt.slice(0, 10), time: dt.slice(11, 16) });
  const start = local(e.start.dateTime);
  const end = e.end?.dateTime ? local(e.end.dateTime) : start;
  const asMin = (x) => Date.parse(`${x.date}T${x.time}:00Z`) / 60_000;
  return { date: start.date, time: start.time, endDate: end.date, endTime: end.time, timeZone, minutes: Math.round(asMin(end) - asMin(start)) };
}

/** A short key for an event's time, to compare what is on the calendar with what Coach wrote. */
export const timeKey = (t) => (t.time ? `${t.date}T${t.time}/${t.endDate}T${t.endTime}@${t.timeZone}` : t.date);

/**
 * Whether the calendar's time for a workout wins over the database's: it was moved on the calendar since Coach last
 * wrote it, and, when Coach changed the time too, the calendar change is the later one. An event from before
 * coachTime existed counts as moved when it differs and was edited after the workout. Pure; tested.
 */
export function calendarWins(e, w, weekStart) {
  const onCalendar = timeKey(wallOf(e));
  const inCoach = eventFor(w, weekStart).extendedProperties.private.coachTime;
  if (onCalendar === inCoach) return false;
  const written = e.extendedProperties?.private?.coachTime;
  const calendarNewer = Date.parse(e.updated ?? 0) > new Date(w.updated_at ?? 0).getTime();
  if (!written) return calendarNewer;
  if (onCalendar === written) return false; // only Coach changed it
  return written === inCoach || calendarNewer;
}

/** The database fields for a workout moved on the calendar to `t` (wallOf). Pure; tested. */
export function movedFields(t) {
  if (!t.time) return { scheduled_date: t.date, start_time: null, end_time: null, time_zone: null };
  return {
    scheduled_date: t.date,
    start_time: t.time,
    end_time: t.endDate === t.date ? t.endTime : null,
    time_zone: t.timeZone === HOME_TZ ? null : t.timeZone,
    duration: t.minutes > 0 ? t.minutes : null,
  };
}

/** Copies a calendar move into the workout row (and its plan week, when the day is in another week). */
async function adoptMove(sql, userId, w, f) {
  const week = mondayOf(f.scheduled_date);
  const [plan] = await sql`
    INSERT INTO training_plans (id, user_id, week_start_date, week_end_date, plan_content, ai_model, status)
    VALUES (${crypto.randomUUID()}, ${userId}, ${week}, ${addDays(week, 6)}, '', 'calendar', 'active')
    ON CONFLICT (user_id, week_start_date) DO UPDATE SET updated_at = NOW() RETURNING id`;
  await sql`
    UPDATE training_plan_activities SET
      plan_id = ${plan.id}, scheduled_date = ${f.scheduled_date}, start_time = ${f.start_time}, end_time = ${f.end_time},
      time_zone = ${f.time_zone}, duration = COALESCE(${f.duration ?? null}, duration), change_source = 'calendar',
      edited_at = NOW(), updated_at = NOW()
    WHERE id = ${w.id}`;
  return { ...w, ...f, duration: f.duration ?? w.duration, week };
}

/** Whether an event already shows what Coach would write, so the push can leave it alone. */
function unchanged(e, body) {
  const p = e.extendedProperties?.private ?? {};
  const want = body.extendedProperties.private;
  return (
    e.status !== 'cancelled' &&
    e.summary === body.summary &&
    (e.description ?? '') === body.description &&
    e.colorId === body.colorId &&
    e.source?.url === body.source.url &&
    timeKey(wallOf(e)) === want.coachTime &&
    Object.entries(want).every(([k, v]) => p[k] === v) &&
    (e.transparency ?? 'opaque') === body.transparency
  );
}

/**
 * The calendar event id Coach gives a workout's event: the same id every time, so two pushes at once can't both
 * create it (Google answers the second with 409), and a workout moved to another week keeps its event. Google
 * allows a-v and 0-9; hex of the workout id fits. Pure; tested.
 */
export const eventIdFor = (workoutId) => `coach${Buffer.from(String(workoutId), 'utf8').toString('hex')}`;

/** Whether a workout gets an event: not skipped, not a rest day. */
const onCalendarAtAll = (w) => w.status !== 'skipped' && w.activity_type !== 'rest';

/**
 * Makes the calendar match the plan week starting `weekStart` (a Monday), after copying any calendar moves into the
 * database. Precise: it touches only events Coach wrote (tagged with a workout id), changes an event only when it
 * differs from the workout, and never leaves two events for one workout.
 *
 * - A workout of the week with no event of this week: its event from another week (the workout was moved here)
 *   moves along; else Coach creates one, under the workout's own event id (eventIdFor).
 * - An event of this week whose workout is now in another week moves to that week; one whose workout is gone,
 *   skipped or a rest day is deleted. A second event for one workout is deleted.
 * - One event that Google refuses never stops the rest; the errors come back in `errors`.
 *
 * Returns counts and the workouts moved on the calendar ({ id, from, to }), or { skipped } when there is no
 * calendar connection or Google credentials.
 */
export async function pushWeek(sql, userId, weekStart, { env = process.env, dryRun = false, log = () => {} } = {}) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return { skipped: 'no Google credentials' };
  const [conn] = await sql`
    SELECT id, google_email, refresh_token FROM calendar_connections
    WHERE user_id = ${userId} AND is_active = true ORDER BY last_synced_at DESC NULLS LAST LIMIT 1`;
  if (!conn) return { skipped: 'no calendar connection' };
  const token = await refreshAccessToken(sql, conn, env, log);
  if (!token) return { skipped: 'Google refused the token' };
  /** @returns {Promise<any>} */
  const google = async (url, init = {}, okStatuses = []) => {
    const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
    if (okStatuses.includes(r.status)) return { status: r.status };
    if (!r.ok) throw new Error(`${init.method ?? 'GET'} calendar: ${r.status} ${await r.text()}`);
    return r.status === 204 ? null : r.json();
  };
  const eventUrl = (id) => `${API}/${encodeURIComponent(id)}`;
  const list = async (property) => {
    const params = new URLSearchParams({ privateExtendedProperty: property, singleEvents: 'true', maxResults: '250' });
    return (await google(`${API}?${params}`)).items ?? [];
  };

  const workouts = await sql`
    SELECT a.id, a.scheduled_date, a.start_time, a.end_time, a.time_zone, a.title, a.description, a.why, a.workout_type,
           a.activity_type, a.duration, a.status, a.updated_at, to_char(p.week_start_date, 'YYYY-MM-DD') AS week
    FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
    WHERE p.user_id = ${userId} AND p.week_start_date = ${weekStart}`;
  const wanted = new Map(workouts.filter(onCalendarAtAll).map((w) => [String(w.id), w]));

  // No time window: an event moved on the calendar to another week still carries this week's tag.
  const existing = await list(`coachPlanDate=${weekStart}`);

  // Events of this week for workouts that now live in another week (moved in Coach): they move along, not go.
  const strayIds = [...new Set(existing.map((e) => e.extendedProperties?.private?.coachWorkoutId).filter((id) => id && !wanted.has(id)))];
  const elsewhere = new Map();
  if (strayIds.length) {
    const rows = await sql`
      SELECT a.id, a.scheduled_date, a.start_time, a.end_time, a.time_zone, a.title, a.description, a.why, a.workout_type,
           a.activity_type, a.duration, a.status, a.updated_at, to_char(p.week_start_date, 'YYYY-MM-DD') AS week
      FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
      WHERE p.user_id = ${userId} AND a.id::text = ANY(${strayIds})`;
    for (const w of rows) if (onCalendarAtAll(w)) elsewhere.set(String(w.id), w);
  }

  /** @type {{ id: string, from: string, to: string }[]} */
  const moved = [];
  /** @type {string[]} */
  const errors = [];
  const counts = { created: 0, updated: 0, deleted: 0, unchanged: 0, moved, errors };
  const seen = new Set();

  /** One event step; a refusal is logged and counted, the rest of the week still goes. */
  const step = async (what, fn) => {
    try {
      await fn();
    } catch (error) {
      const message = `${what}: ${error instanceof Error ? error.message : String(error)}`;
      log(message);
      errors.push(message);
    }
  };
  const remove = (e) =>
    step(`delete ${e.summary}`, async () => {
      log(`delete ${e.summary}`);
      // 404/410: already gone (a push running at the same time deleted it first).
      if (!dryRun) await google(eventUrl(e.id), { method: 'DELETE' }, [404, 410]);
      counts.deleted++;
    });

  /** Brings one event in line with its workout: a calendar move goes into Coach first, then the event is rewritten. */
  const settle = (e, w0, week0) =>
    step(`update ${w0.title}`, async () => {
      let w = w0;
      let week = week0;
      if (calendarWins(e, w, week)) {
        const f = movedFields(wallOf(e));
        log(`moved on the calendar: ${w.title} ${day(w.scheduled_date)} ${w.start_time ?? ''} → ${f.scheduled_date} ${f.start_time ?? ''}`);
        moved.push({ id: String(w.id), from: day(w.scheduled_date), to: f.scheduled_date });
        if (!dryRun) ({ week, ...w } = await adoptMove(sql, userId, w, f));
        else week = mondayOf(f.scheduled_date);
      }
      const body = eventFor(w, week);
      if (unchanged(e, body)) {
        counts.unchanged++;
        return;
      }
      log(`update ${w.title}`);
      if (!dryRun) await google(eventUrl(e.id), { method: 'PUT', body: JSON.stringify({ ...body, status: 'confirmed' }) });
      counts.updated++;
    });

  for (const e of existing) {
    const id = e.extendedProperties?.private?.coachWorkoutId;
    const w = id ? (wanted.get(id) ?? elsewhere.get(id)) : undefined;
    if (!w || seen.has(id)) {
      await remove(e);
      continue;
    }
    if (!wanted.has(id)) {
      // Its workout moved to another week in Coach. When that week already has its event, this one goes.
      const others = (await list(`coachWorkoutId=${id}`)).filter((o) => o.id !== e.id && o.status !== 'cancelled');
      if (others.length) {
        await remove(e);
        continue;
      }
    }
    seen.add(id);
    await settle(e, w, wanted.has(id) ? weekStart : w.week);
  }

  for (const [id, w] of wanted) {
    if (seen.has(id)) continue;
    await step(`create ${w.title}`, async () => {
      // Its event may still sit in another week (moved here in Coach, that week not pushed yet): move it.
      const found = (await list(`coachWorkoutId=${id}`)).filter((e) => e.status !== 'cancelled');
      if (found.length) {
        const [keep, ...extra] = [...found].sort((a, b) => Number(b.id === eventIdFor(id)) - Number(a.id === eventIdFor(id)));
        for (const e of extra) await remove(e);
        await settle(keep, w, weekStart);
        return;
      }
      log(`create ${w.title}`);
      if (!dryRun) {
        const body = { ...eventFor(w, weekStart), id: eventIdFor(id) };
        const r = await google(API, { method: 'POST', body: JSON.stringify(body) }, [409]);
        // 409: the id is taken: a push at the same time made it, or Coach deleted it before (Undo). Rewrite it.
        if (r?.status === 409) await google(eventUrl(body.id), { method: 'PUT', body: JSON.stringify({ ...eventFor(w, weekStart), status: 'confirmed' }) });
      }
      counts.created++;
    });
  }
  // Every caller runs after the answer: the server log is where a refusal shows. The hourly sync tries again.
  if (errors.length) console.error(`Calendar push ${weekStart}: ${errors.length} event(s) failed: ${errors.join(' | ')}`);
  return counts;
}
