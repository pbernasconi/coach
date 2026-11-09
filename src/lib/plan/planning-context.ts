/**
 * Loads what Coach knows before planning a week (planning-context.mjs builds the facts): the "Plan with Coach" form
 * shows it, and the review's load outlook uses the same load history.
 */

import { sql } from '@/db';
import { toDay } from '@/lib/db-time.mjs';
import { HOME_TZ } from '@/lib/calendar-sync/push.mjs';
import { loadUpcomingEvents } from '@/lib/performance/events';
import { loadReadiness } from '@/lib/vitals/queries';
import { planningContext } from './planning-context.mjs';
import { HOME, localBlocks, weekPlaces } from './where.mjs';
import { geocode } from '../../../scripts/travel.mjs';
import { weekOutlook } from './review.mjs';
import { addDays, mondayOf, todayIn } from './week.mjs';
import type { Proposal } from './proposals';

type Row = Record<string, unknown>;

export type PlanningFact = { id: string; label: string; value: string; note: string | null; tone: 'good' | 'warn' | 'bad' | 'neutral' };
export type PlanningContext = {
  facts: PlanningFact[];
  days: Record<string, string>;
  suggested: { feel: string; feelWhy: string | null; hours: number | null };
};

async function loadHistory(userId: string, from: string) {
  const rows = (await sql`
    SELECT date, ctl, atl, tsb, tss FROM daily_training_load
    WHERE user_id = ${userId} AND date >= ${from} ORDER BY date`) as Row[];
  return rows.map((r) => ({ date: String(r.date), ctl: Number(r.ctl), atl: Number(r.atl), tsb: Number(r.tsb), tss: Number(r.tss ?? 0) }));
}

/**
 * Facts and suggested answers for planning the week of `weekStart`. Each source that fails is left out; `strict`
 * (the health check) throws instead.
 */
export async function loadPlanningContext(userId: string, weekStart: string, { strict = false } = {}): Promise<PlanningContext> {
  const today = todayIn(HOME_TZ);
  const monday = mondayOf(today);
  const since = addDays(monday, -28);
  const quiet = <T,>(p: PromiseLike<T>, fallback: T) => Promise.resolve(p).catch((e) => { if (strict) throw e; console.error('Planning context:', e instanceof Error ? e.message : e); return fallback; });

  const [history, weeks, readiness, feedback, skips, events, calendar] = await Promise.all([
    quiet(loadHistory(userId, since), []),
    quiet(sql`
      SELECT to_char(date_trunc('week', start_date_local), 'YYYY-MM-DD') AS monday,
             SUM(COALESCE(moving_time, 0)) / 60.0 AS min, COUNT(*) AS sessions
      FROM strava_activities
      WHERE user_id = ${userId} AND start_date_local >= ${since}::date AND start_date_local < ${monday}::date
      GROUP BY 1` as Promise<Row[]>, []),
    quiet(loadReadiness(userId, today), null),
    quiet(sql`
      SELECT date, title, feel, rpe FROM workout_feedback
      WHERE user_id = ${userId} AND date >= ${addDays(today, -14)}::date ORDER BY date` as Promise<Row[]>, []),
    quiet(sql`
      SELECT a.scheduled_date, a.title, a.skip_reason
      FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
      WHERE p.user_id = ${userId} AND a.status = 'skipped'
        AND a.scheduled_date >= ${addDays(today, -14)}::date AND a.scheduled_date <= ${today}::date` as Promise<Row[]>, []),
    quiet(loadUpcomingEvents(userId, today, 180), []),
    quiet(loadWeekCalendar(userId, weekStart), []),
  ]);

  // Week TSS from the load history (the same TSS the Fitness numbers use).
  const tssByWeek = new Map<string, number>();
  const load = history.filter((l) => l.date >= addDays(today, -21));
  for (const l of history) {
    if (l.date >= monday) continue;
    const m = mondayOf(l.date);
    tssByWeek.set(m, (tssByWeek.get(m) ?? 0) + l.tss);
  }
  const minByWeek = new Map(weeks.map((w) => [String(w.monday), { min: Number(w.min), sessions: Number(w.sessions) }]));
  const mondays = [0, 1, 2, 3].map((i) => addDays(monday, -7 * (i + 1))).filter((m) => tssByWeek.has(m) || minByWeek.has(m));

  return planningContext({
    load,
    weeks: mondays.map((m) => ({ monday: m, tss: tssByWeek.get(m) ?? 0, min: minByWeek.get(m)?.min ?? 0, sessions: minByWeek.get(m)?.sessions ?? 0 })),
    readiness: readiness as never,
    feedback: feedback.map((f) => ({ date: toDay(f.date) ?? '', title: (f.title as string) ?? null, feel: f.feel == null ? null : Number(f.feel), rpe: f.rpe == null ? null : Number(f.rpe) })),
    skips: skips.map((s) => ({ date: toDay(s.scheduled_date) ?? '', title: String(s.title), reason: (s.skip_reason as string) ?? null })),
    events: events.map((e) => ({ name: e.name, date: e.date, priority: e.priority, days: e.countdown.days })),
    calendar,
    weekStart,
    today,
  }) as PlanningContext;
}

export type CalendarBlock = { date: string; title: string; allDay: boolean; start: string | null; minutes: number };
/** Where Paolo is on a day, and the zone its times are in (where.mjs). */
export type DayPlace = { date: string; label: string; short: string; tz: string; home: boolean; travel: boolean };
export type WeekWhere = { days: DayPlace[]; zones: { tz: string; short: string }[] };

/** Home all week: what the screen shows when the calendar can't be read. */
export function homeWeek(weekStart: string): WeekWhere {
  const days = Array.from({ length: 7 }, (_, i) => ({
    date: addDays(weekStart, i), label: HOME.label, short: 'SF', tz: HOME_TZ, home: true, travel: false,
  }));
  return { days, zones: [{ tz: HOME_TZ, short: 'SF' }] };
}

/**
 * Paolo's calendar for the week of `weekStart`, each day on the clock of where he is that day (where.mjs: flights
 * and all-day holds like "NYC"), and those places. Coach's own workouts, declined events and cancelled ones are not
 * busy time. The three weeks before are read for a trip that began earlier.
 */
export async function loadWeekView(userId: string, weekStart: string): Promise<{ calendar: CalendarBlock[]; where: WeekWhere }> {
  const rows = (await sql`
    SELECT ce.summary, ce.start_time, ce.end_time, ce.is_all_day, ce.location
    FROM calendar_events ce JOIN calendar_connections cc ON cc.id = ce.connection_id
    WHERE cc.user_id = ${userId} AND ce.status <> 'cancelled'
      AND ce.start_time >= ${addDays(weekStart, -21)}::date AND ce.start_time < ${addDays(weekStart, 8)}::date
      -- Coach's own workouts (pushWeek writes this line into each event) are not busy time.
      AND COALESCE(ce.description, '') NOT LIKE '%Open in Coach: %'
      AND NOT COALESCE(ce.attendees::jsonb @> '[{"self": true, "responseStatus": "declined"}]', false)
      -- Before the week only flights and all-day holds matter (where he is when the week starts).
      AND (ce.start_time >= ${addDays(weekStart, -2)}::date OR ce.is_all_day OR ce.summary ILIKE 'flight to %')
    ORDER BY ce.start_time
    LIMIT 300`) as Row[];
  let where: WeekWhere;
  try {
    where = await weekPlaces(rows, weekStart, { geocode });
  } catch (e) {
    console.error('Where Paolo is (assuming home):', e instanceof Error ? e.message : e);
    where = homeWeek(weekStart);
  }
  return { calendar: localBlocks(rows, where.days), where };
}

/** The week's calendar blocks on each day's own clock (loadWeekView). */
export async function loadWeekCalendar(userId: string, weekStart: string): Promise<CalendarBlock[]> {
  return (await loadWeekView(userId, weekStart)).calendar;
}

export type WeekOutlook = ReturnType<typeof weekOutlook>;

/** The proposal's week against the load history: fitness and form in and out, and TSS against the last 4 weeks. */
export async function loadOutlook(userId: string, proposal: Proposal): Promise<WeekOutlook> {
  const today = todayIn(HOME_TZ);
  const [history, before] = await Promise.all([
    loadHistory(userId, addDays(mondayOf(today), -120)),
    sql`
      SELECT a.scheduled_date, a.activity_type, a.workout_type, a.title, a.intensity, a.duration, a.tss
      FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
      WHERE p.user_id = ${userId} AND a.status <> 'skipped'
        AND a.scheduled_date >= ${today}::date AND a.scheduled_date < ${proposal.weekStart}::date` as Promise<Row[]>,
  ]);
  return weekOutlook(
    history,
    before.map((r) => ({
      date: toDay(r.scheduled_date) ?? '', tss: r.tss == null ? null : Number(r.tss), duration: r.duration == null ? null : Number(r.duration),
      sport: String(r.activity_type ?? ''), workoutType: (r.workout_type as string) ?? null, intensity: (r.intensity as string) ?? null, title: String(r.title ?? ''),
    })),
    proposal.rows,
    { today, weekStart: proposal.weekStart },
  );
}
