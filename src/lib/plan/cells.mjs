// Day cells and week rows of the continuous calendar: what each cell shows, how many chips fit, and which week rows
// can keep their old objects (so memoized rows do not re-render). No framework or database imports, so node --test
// can run it (cells.test.mjs).

import { addDays, matchActivityId, mondayOf } from './week.mjs';

/** Chips that fit in one grid day cell (the row height is fixed). With more items, the cell shows MAX - 1 and "+N more". */
export const MAX_CHIPS = 3;

/** Minutes as a short duration: "45m", "1:05", "2:30". */
export function dur(min) {
  const m = Math.max(0, Math.round(Number(min) || 0));
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * The items of one day, in display order: planned workouts (by sort order, then start time), then completed
 * activities and Lift sessions that no planned workout matched. A planned workout carries its matched Strava
 * activity as `actual` (for a strength workout, the watch activity next to its Lift session). An unplanned Lift
 * session takes the day's unmatched Strava strength activity as `a`, so one lift logged in Lift and on the watch
 * shows once.
 *
 * @param {Array<{ id: string, sortOrder: number, startTime: string | null, match: { source: string, id: string, activityId?: string | null } | null }>} planned
 * @param {Array<{ id: string, sport?: string }>} activities  the day's Strava activities
 * @param {Array<{ id: string }>} lifts  the day's Lift sessions
 */
export function cellItems(planned, activities, lifts) {
  const sorted = [...planned].sort((a, b) => a.sortOrder - b.sortOrder || (a.startTime ?? '99').localeCompare(b.startTime ?? '99'));
  const matched = new Set(sorted.flatMap((w) => [w.match?.id, w.match?.activityId]).filter(Boolean));
  const byId = new Map(activities.map((a) => [a.id, a]));
  const looseLifts = lifts.filter((l) => !matched.has(l.id)).map((l) => {
    const a = activities.find((x) => x.sport === 'strength' && !matched.has(x.id)) ?? null;
    if (a) matched.add(a.id);
    return { kind: 'lift', key: `l-${l.id}`, l, a };
  });
  return [
    ...sorted.map((w) => ({ kind: 'planned', key: `w-${w.id}`, w, actual: byId.get(matchActivityId(w.match)) ?? null })),
    ...activities.filter((a) => !matched.has(a.id)).map((a) => ({ kind: 'activity', key: `a-${a.id}`, a })),
    ...looseLifts,
  ];
}

/** The chips a fixed-height cell shows, and how many go behind "+N more". */
export function visibleChips(items, max = MAX_CHIPS) {
  if (items.length <= max) return { shown: items, more: 0 };
  return { shown: items.slice(0, max - 1), more: items.length - (max - 1) };
}

/** Rows of `list` grouped by the Monday of their `date`. */
export function groupByWeek(list) {
  const out = new Map();
  for (const row of list) {
    const m = mondayOf(row.date);
    if (!out.has(m)) out.set(m, []);
    out.get(m).push(row);
  }
  return out;
}

/** True when two arrays hold the same objects in the same order (a week whose rows did not change). */
export function sameItems(a, b) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/**
 * The week rows for the calendar. A week whose workouts, activities, Lift sessions and summary are the same objects
 * as last time keeps its old row object, so a memoized row skips its render after a load elsewhere.
 *
 * @param {{ weeks: string[], workouts: any[], activities: any[], lifts: any[], summaries: { monday: string }[] }} data
 * @param {Map<string, { src: unknown[], week: object }>} cache  kept between calls (updated in place)
 */
export function weekRows(data, cache) {
  const w = groupByWeek(data.workouts);
  const a = groupByWeek(data.activities);
  const l = groupByWeek(data.lifts);
  const s = new Map(data.summaries.map((x) => [x.monday, x]));
  return data.weeks.map((monday) => {
    const ws = w.get(monday) ?? [];
    const as = a.get(monday) ?? [];
    const ls = l.get(monday) ?? [];
    const summary = s.get(monday) ?? null;
    const src = [...ws, '|', ...as, '|', ...ls, '|', summary];
    const prev = cache.get(monday);
    if (prev && sameItems(prev.src, src)) return prev.week;
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i);
      return { date, items: cellItems(ws.filter((x) => x.date === date), as.filter((x) => x.date === date), ls.filter((x) => x.date === date)) };
    });
    const week = { monday, days, summary };
    cache.set(monday, { src, week });
    return week;
  });
}

/**
 * What the week column shows:
 * - 'empty'   no plan, no training and no load data: nothing (a future week shows a muted "No plan")
 * - 'planned' a week that has not started, with a plan: the planned totals only
 * - 'done'    a week that has started (or has training): done / planned totals, and fitness when there is load data
 *
 * @param {{ monday: string, done: { count: number, liftSessions: number, min: number }, planned: { count: number }, fitness: object | null } | null} s
 * @param {string} today
 */
export function weekColumnMode(s, today) {
  if (!s) return 'empty';
  const trained = s.done.count > 0 || s.done.liftSessions > 0 || s.done.min > 0;
  const plan = s.planned.count > 0;
  if (s.monday > today) return plan ? 'planned' : trained ? 'done' : 'empty';
  return trained || plan || s.fitness ? 'done' : 'empty';
}
