/**
 * Everything the planning screen (/plan/week) shows for one week: the draft and its version, what changed from the
 * version before, Paolo's calendar, what Coach knows going in (planning-context), and last week day by day.
 */

import { HOME_TZ } from '@/lib/calendar-sync/push.mjs';
import { diffPlans, gaveUp } from './draft.mjs';
import { loadRange } from './month';
import { homeWeek, loadPlanningContext, loadWeekView, type CalendarBlock, type PlanningContext, type WeekWhere } from './planning-context';
import { convert, zoneOf } from './where.mjs';
import { planOf, weekProposal, type Proposal } from './proposals';
import { addDays, mondayOf, sportOf, todayIn } from './week.mjs';

export type DraftEvent = {
  index: number; title: string; date: string; start: string | null; minutes: number | null; sport: string;
  hard: boolean; why: string | null; description: string | null; tss: number | null;
  /** The zone the session was planned in; `date` and `start` are already on the clock of the day it lands on. */
  timeZone: string;
};
export type LastWeekDay = {
  date: string;
  items: { title: string; sport: string; level: string }[];
  /** What Strava recorded that day (commutes left out). */
  done: { name: string; sport: string; km: number; min: number }[];
};
export type LastWeek = {
  /** The week isn't over yet (planning next week mid-week): lifts and hard count only what was due by today. */
  monday: string; ongoing: boolean; doneMin: number; plannedMin: number; runMin: number; planned: number; done: number; missed: number; skipped: number;
  lifts: { planned: number; done: number }; hard: { planned: number; done: number }; days: LastWeekDay[];
};
export type DraftChange = { changed: { what: string; how: string }[]; gaveUp: string | null; note: string | null };
export type PlannerWeek = {
  weekStart: string;
  today: string;
  proposal: Proposal | null;
  /** The draft's sessions by their index in the plan JSON (the index a move or remove names). */
  events: DraftEvent[];
  change: DraftChange | null;
  calendar: CalendarBlock[];
  /** Where Paolo is each day and the week's zones: each day's times are on its own clock. */
  where: WeekWhere;
  context: PlanningContext | null;
  lastWeek: LastWeek | null;
  /** What is already on the plan for the week when no draft is open (an accepted week): Review shows it. */
  planned: DraftEvent[];
};

const HARD = /threshold|vo2|tempo|interval|sweet ?spot|race|test|hill repeats|fartlek/i;

/** The draft's events for the screen. Rows from checkPlan carry sport and TSS; the plan JSON keeps the index. */
function eventsOf(plan: unknown, proposal: Proposal, where: WeekWhere): DraftEvent[] {
  const events = ((plan as { events?: unknown[] } | null)?.events ?? []) as Record<string, unknown>[];
  return events.map((e, index) => {
    const row = proposal.rows.find((r) => r.id === `${proposal.weekStart}#${index}`);
    const start = String(e.start ?? '');
    const intensity = String(row?.intensity ?? e.intensity ?? '');
    return local(where, {
      timeZone: typeof e.timeZone === 'string' && e.timeZone ? e.timeZone : HOME_TZ,
      index,
      title: String(e.title ?? ''),
      date: start.slice(0, 10),
      start: row?.startTime ?? (start.length > 10 ? start.slice(11, 16) : null),
      minutes: row?.duration ?? minutesBetween(start, String(e.end ?? '')),
      sport: row?.activityType ?? sportOf(e),
      hard: /hard|high|threshold|vo2/i.test(intensity) || HARD.test(String(e.title ?? '')) || HARD.test(String(e.workoutType ?? '')),
      why: (e.why as string) ?? null,
      description: (e.description as string) ?? null,
      tss: row?.tss ?? null,
    });
  });
}

/** A session on the clock of the day it lands on: 07:00 in Zurich is shown at 07:00, on Zurich's day. */
function local(where: WeekWhere, e: DraftEvent): DraftEvent {
  if (!e.start) return e;
  const tz = zoneOf(where.days, e.date, HOME_TZ);
  if (tz === e.timeZone) return e;
  const at = convert(e.date, e.start, e.timeZone, tz);
  return { ...e, date: at.date, start: at.time };
}

/** A session's length from its start and end ("YYYY-MM-DDTHH:MM…" on the same day), for a draft still being written. */
function minutesBetween(start: string, end: string): number | null {
  const m = (s: string) => (/T(\d{2}):(\d{2})/.exec(s) ? Number(s.slice(11, 13)) * 60 + Number(s.slice(14, 16)) : null);
  const a = m(start);
  const b = end.slice(0, 10) === start.slice(0, 10) ? m(end) : null;
  return a != null && b != null && b > a ? b - a : null;
}

/** Last week, day by day, with what was done of the plan. */
async function loadLastWeek(userId: string, monday: string, today: string): Promise<LastWeek> {
  const range = await loadRange(userId, monday, monday, today);
  const summary = range.summaries.find((s) => s.monday === monday) ?? null;
  const workouts = range.workouts.filter((w) => w.date >= monday && w.date <= addDays(monday, 6) && w.sport !== 'rest');
  const levelOf = (w: (typeof workouts)[number]) => (w.state === 'skipped' ? 'skipped' : w.state === 'missed' ? 'missed' : w.compliance.level);
  const ok = (l: string) => ['good', 'done', 'partial'].includes(l);
  // A session still ahead isn't missed yet: count it only once its day has passed or it's done.
  const due = workouts.filter((w) => w.date < today || ok(levelOf(w)));
  const lifts = due.filter((w) => w.sport === 'strength');
  const hard = due.filter((w) => HARD.test(`${w.title} ${w.workoutType ?? ''} ${w.intensity ?? ''}`));
  const acts = range.activities.filter((a) => a.date >= monday && a.date <= addDays(monday, 6) && !a.commute);
  return {
    monday,
    ongoing: addDays(monday, 6) >= today,
    doneMin: Math.round(summary?.done.min ?? 0),
    plannedMin: Math.round(summary?.planned.min ?? 0),
    runMin: acts.filter((a) => a.sport === 'run').reduce((n, a) => n + a.min, 0),
    planned: summary?.planned.count ?? workouts.length,
    done: summary?.planned.done ?? 0,
    missed: summary?.planned.missed ?? 0,
    skipped: summary?.planned.skipped ?? 0,
    lifts: { planned: lifts.length, done: lifts.filter((w) => ok(levelOf(w))).length },
    hard: { planned: hard.length, done: hard.filter((w) => ok(levelOf(w))).length },
    days: Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i);
      return {
        date,
        items: workouts.filter((w) => w.date === date).map((w) => ({ title: w.title, sport: w.sport, level: levelOf(w) })),
        done: acts.filter((a) => a.date === date).map((a) => ({ name: a.name, sport: a.sport, km: a.km, min: a.min })),
      };
    }),
  };
}

/** The week's planned workouts as the screen's events, by date and start. */
async function loadPlanned(userId: string, monday: string, today: string, where: WeekWhere): Promise<DraftEvent[]> {
  const range = await loadRange(userId, monday, monday, today);
  return range.workouts
    .filter((w) => w.date >= monday && w.date <= addDays(monday, 6) && w.sport !== 'rest')
    .sort((a, b) => `${a.date} ${a.startTime ?? ''}`.localeCompare(`${b.date} ${b.startTime ?? ''}`))
    .map((w, index) => local(where, {
      timeZone: w.timeZone || HOME_TZ,
      index,
      title: w.title,
      date: w.date,
      start: w.startTime ? w.startTime.slice(0, 5) : null,
      minutes: w.duration,
      sport: w.sport,
      hard: /hard|high|threshold|vo2/i.test(w.intensity ?? '') || HARD.test(`${w.title} ${w.workoutType ?? ''}`),
      why: w.why,
      description: w.description,
      tss: w.tss,
    }));
}

const minDay = (a: string, b: string) => (a < b ? a : b);

/** Each part that fails is left out (the screen still opens); `strict` (the health check) throws instead. */
export async function loadPlannerWeek(userId: string, weekStart: string, { strict = false } = {}): Promise<PlannerWeek> {
  const today = todayIn(HOME_TZ);
  const quiet = <T,>(label: string, p: () => Promise<T>, fallback: T) =>
    p().catch((e) => {
      if (strict) throw e;
      console.error(`Planning screen (${label}):`, e instanceof Error ? e.message : e);
      return fallback;
    });
  const monday = mondayOf(weekStart);
  const [proposal, view, context, lastWeek] = await Promise.all([
    quiet('draft', () => weekProposal(userId, monday), null),
    quiet('calendar', () => loadWeekView(userId, monday), { calendar: [] as CalendarBlock[], where: homeWeek(monday) }),
    quiet('context', () => loadPlanningContext(userId, monday, { strict }), null),
    // The week before the one being planned: last week on a Sunday, the week just gone on Monday. A week further
    // ahead looks at this week so far, the latest real training.
    quiet('last week', () => loadLastWeek(userId, minDay(addDays(monday, -7), mondayOf(today)), today), null),
  ]);
  let events: DraftEvent[] = [];
  let change: DraftChange | null = null;
  if (proposal?.status === 'running') {
    // The sessions Coach has written so far (saveDraftSoFar), shown while it writes the rest.
    const plan = await quiet('draft so far', () => planOf(userId, proposal.id), null);
    events = eventsOf(plan, proposal, view.where);
  }
  if (proposal?.status === 'proposed') {
    const plan = await quiet('plan', () => planOf(userId, proposal.id), null);
    events = eventsOf(plan, proposal, view.where);
    const revise = proposal.request.revise;
    if (revise) {
      const before = await quiet('version before', () => planOf(userId, revise.fromId), null);
      if (before && plan) {
        const d = diffPlans(before, plan);
        change = { changed: d.changed, gaveUp: gaveUp(d), note: revise.note };
      }
    }
  }
  const open = proposal && ['requested', 'running', 'proposed'].includes(proposal.status);
  const planned = open
    ? []
    : await quiet('planned', () => loadPlanned(userId, monday, today, view.where), []);
  return {
    weekStart: monday,
    today,
    proposal,
    planned,
    events,
    change,
    calendar: view.calendar.filter((c) => c.date >= monday && c.date <= addDays(monday, 6)),
    where: view.where,
    context,
    lastWeek,
  };
}
