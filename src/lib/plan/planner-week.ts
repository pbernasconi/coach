/**
 * Everything the planning screen (/plan/week) shows for one week: the draft and its version, what changed from the
 * version before, Paolo's calendar, what Coach knows going in (planning-context), and last week day by day.
 */

import { HOME_TZ } from '@/lib/calendar-sync/push.mjs';
import { diffPlans, gaveUp } from './draft.mjs';
import { loadRange } from './month';
import { loadPlanningContext, loadWeekCalendar, type CalendarBlock, type PlanningContext } from './planning-context';
import { planOf, weekProposal, type Proposal } from './proposals';
import { addDays, mondayOf, todayIn } from './week.mjs';

export type DraftEvent = {
  index: number; title: string; date: string; start: string | null; minutes: number | null; sport: string;
  hard: boolean; why: string | null; description: string | null; tss: number | null;
};
export type LastWeekDay = { date: string; items: { title: string; sport: string; level: string }[] };
export type LastWeek = {
  monday: string; doneMin: number; plannedMin: number; planned: number; done: number; missed: number; skipped: number;
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
  context: PlanningContext | null;
  lastWeek: LastWeek | null;
};

const HARD = /threshold|vo2|tempo|interval|sweet ?spot|race|test|hill repeats|fartlek/i;

/** The draft's events for the screen. Rows from checkPlan carry sport and TSS; the plan JSON keeps the index. */
function eventsOf(plan: unknown, proposal: Proposal): DraftEvent[] {
  const events = ((plan as { events?: unknown[] } | null)?.events ?? []) as Record<string, unknown>[];
  return events.map((e, index) => {
    const row = proposal.rows.find((r) => r.id === `${proposal.weekStart}#${index}`);
    const start = String(e.start ?? '');
    const intensity = String(row?.intensity ?? e.intensity ?? '');
    return {
      index,
      title: String(e.title ?? ''),
      date: start.slice(0, 10),
      start: row?.startTime ?? (start.length > 10 ? start.slice(11, 16) : null),
      minutes: row?.duration ?? null,
      sport: row?.activityType ?? 'other',
      hard: /hard|high|threshold|vo2/i.test(intensity) || HARD.test(String(e.title ?? '')) || HARD.test(String(e.workoutType ?? '')),
      why: (e.why as string) ?? null,
      description: (e.description as string) ?? null,
      tss: row?.tss ?? null,
    };
  });
}

/** Last week, day by day, with what was done of the plan. */
async function loadLastWeek(userId: string, monday: string, today: string): Promise<LastWeek> {
  const range = await loadRange(userId, monday, monday, today);
  const summary = range.summaries.find((s) => s.monday === monday) ?? null;
  const workouts = range.workouts.filter((w) => w.date >= monday && w.date <= addDays(monday, 6) && w.sport !== 'rest');
  const levelOf = (w: (typeof workouts)[number]) => (w.state === 'skipped' ? 'skipped' : w.state === 'missed' ? 'missed' : w.compliance.level);
  const ok = (l: string) => ['good', 'done', 'partial'].includes(l);
  const lifts = workouts.filter((w) => w.sport === 'strength');
  const hard = workouts.filter((w) => HARD.test(`${w.title} ${w.workoutType ?? ''} ${w.intensity ?? ''}`));
  return {
    monday,
    doneMin: Math.round(summary?.done.min ?? 0),
    plannedMin: Math.round(summary?.planned.min ?? 0),
    planned: summary?.planned.count ?? workouts.length,
    done: summary?.planned.done ?? 0,
    missed: summary?.planned.missed ?? 0,
    skipped: summary?.planned.skipped ?? 0,
    lifts: { planned: lifts.length, done: lifts.filter((w) => ok(levelOf(w))).length },
    hard: { planned: hard.length, done: hard.filter((w) => ok(levelOf(w))).length },
    days: Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i);
      return { date, items: workouts.filter((w) => w.date === date).map((w) => ({ title: w.title, sport: w.sport, level: levelOf(w) })) };
    }),
  };
}

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
  const [proposal, calendar, context, lastWeek] = await Promise.all([
    quiet('draft', () => weekProposal(userId, monday), null),
    quiet('calendar', () => loadWeekCalendar(userId, monday), []),
    quiet('context', () => loadPlanningContext(userId, monday, { strict }), null),
    // The week before the one being planned: last week on a Sunday, the week just gone on Monday.
    quiet('last week', () => loadLastWeek(userId, addDays(monday, -7), today), null),
  ]);
  let events: DraftEvent[] = [];
  let change: DraftChange | null = null;
  if (proposal?.status === 'proposed') {
    const plan = await quiet('plan', () => planOf(userId, proposal.id), null);
    events = eventsOf(plan, proposal);
    const revise = proposal.request.revise;
    if (revise) {
      const before = await quiet('version before', () => planOf(userId, revise.fromId), null);
      if (before && plan) {
        const d = diffPlans(before, plan);
        change = { changed: d.changed, gaveUp: gaveUp(d), note: revise.note };
      }
    }
  }
  return {
    weekStart: monday,
    today,
    proposal,
    events,
    change,
    calendar: calendar.filter((c) => c.date >= monday && c.date <= addDays(monday, 6)),
    context,
    lastWeek,
  };
}
