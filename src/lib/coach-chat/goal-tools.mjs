// @ts-check
// The Coach chat's goals, races and week planning (lift/COACH-CHAT.md, "Tools"): the get_goals read tool, and three
// changes for the change card: { op: "event" } (a race or event day, Settings → Events), { op: "goal" } (a milestone
// goal, Settings → Goals) and { op: "plan_week" } (the weekly planner drafts a week, Paolo accepts it on Plan). Pure:
// goal-tools.ts reads and writes.

import { EVENT_SPORTS, PRIORITIES, countdown, parseEvent } from '../performance/events.mjs';
import { GOAL_KINDS, cleanGoals, describe, formatValue, goalLine, parseValue } from '../goals/goals.mjs';
import { cleanRequest } from '../plan/proposal.mjs';
import { addDays, mondayOf } from '../plan/week.mjs';

/** A week Coach can plan from the chat: this week and the seven after it, as the planning screen. */
export const PLAN_WEEKS_AHEAD = 7;

export const GOALS_TOOL = {
  name: 'get_goals',
  description:
    'His races and event days (Settings → Events: name, date, A/B/C priority, sport, target, notes, with ids) and his ' +
    'milestone goals (Settings → Goals: kind, target, deadline, progress now, with ids). Read it before changing one, ' +
    'and when he asks what he is training for.',
  input_schema: { type: 'object', properties: {} },
};

/**
 * @typedef {{ id: string, name: string, date: string, priority: string, sport: string | null, notes: string | null,
 *   target: string | null }} CoachEvent
 * @typedef {import('../goals/goals.mjs').Goal} Goal
 * @typedef {{ name: string, date: string, priority: string, sport: string | null, notes: string | null, target: string | null }} EventFields
 * @typedef {{ op: 'event', action: 'add' | 'update' | 'remove', id: string | null, event: EventFields | null, was: EventFields | null }} EventChange
 * @typedef {{ op: 'goal', action: 'add' | 'update' | 'remove', id: string, goal: Goal | null, was: Goal | null }} GoalChange
 * @typedef {{ op: 'plan_week', request: Record<string, any> }} WeekPlanChange
 */

/** "Sat 22 Mar 2027" @param {string} day */
const longDay = (day) => {
  const d = new Date(`${day}T12:00:00Z`);
  const part = (/** @type {Intl.DateTimeFormatOptions} */ o) => d.toLocaleDateString('en-GB', { ...o, timeZone: 'UTC' });
  return `${part({ weekday: 'short' })} ${part({ day: 'numeric' })} ${part({ month: 'short' })} ${d.getUTCFullYear()}`;
};

/**
 * get_goals' answer.
 * @param {CoachEvent[]} events @param {any[]} goals  measured goals (measureGoals) @param {string} today
 */
export function goalsText(events, goals, today) {
  const up = events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = events.filter((e) => e.date < today && e.date >= addDays(today, -365)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const line = (/** @type {CoachEvent} */ e) => {
    const bits = [e.sport, e.target ? `target ${e.target}` : null, e.notes].filter(Boolean).join('; ');
    return `- id ${e.id}: ${e.name}, ${longDay(e.date)} (${e.date}), priority ${e.priority}${e.date >= today ? `, ${countdown(today, e.date).label}` : ''}${bits ? `. ${bits}` : ''}`;
  };
  const out = ['Races and events (upcoming):', ...(up.length ? up.map(line) : ['(none)'])];
  if (past.length) out.push('', 'Past events (last year):', ...past.map(line));
  out.push('', 'Milestone goals:');
  if (!goals.length) out.push('(none)');
  for (const g of goals) out.push(`${goalLine(g).replace(/^- /, `- id ${g.id}: `)}`);
  out.push('', `Goal kinds: ${Object.entries(GOAL_KINDS).map(([k, v]) => `${k} (${v.label}, ${v.unit})`).join(', ')}.`);
  return out.join('\n');
}

const ACTIONS = ['add', 'update', 'remove'];
const pick = (/** @type {CoachEvent} */ e) => ({ name: e.name, date: e.date, priority: e.priority, sport: e.sport, notes: e.notes, target: e.target });

/**
 * { op: "event", action?, id?, name?, date?, priority?, sport?, target?, notes? } checked against his events.
 * @param {Record<string, unknown>} b @param {{ events: CoachEvent[], today: string }} ctx
 * @returns {{ change: EventChange } | { problem: string }}
 */
export function cleanEventChange(b, { events, today }) {
  const action = String(b.action ?? (b.id ? 'update' : 'add'));
  if (!ACTIONS.includes(action)) return { problem: 'event action must be add, update or remove' };
  if (action === 'add') {
    const p = parseEvent(b);
    if (!p.ok) return { problem: `event: ${p.error.toLowerCase()} (sport one of ${EVENT_SPORTS.join(', ')}; priority ${PRIORITIES.join(', ')})` };
    if (p.value.date < today) return { problem: `event: ${p.value.date} is in the past` };
    const same = events.find((e) => e.date === p.value.date && e.name.toLowerCase() === p.value.name.toLowerCase());
    if (same) return { problem: `${same.name} on ${same.date} is already an event (id ${same.id}): update it instead` };
    return { change: { op: 'event', action: 'add', id: null, event: p.value, was: null } };
  }
  const id = String(b.id ?? '');
  const e = events.find((x) => x.id === id);
  if (!e) return { problem: `no event with id ${id || '(none)'}: read get_goals for the ids` };
  if (action === 'remove') return { change: { op: 'event', action: 'remove', id, event: null, was: pick(e) } };
  /** @type {Record<string, unknown>} */
  const merged = { ...pick(e) };
  for (const k of ['name', 'date', 'priority', 'sport', 'notes', 'target']) if (b[k] !== undefined) merged[k] = b[k];
  const p = parseEvent(merged);
  if (!p.ok) return { problem: `event: ${p.error.toLowerCase()}` };
  if (JSON.stringify(p.value) === JSON.stringify(pick(e))) return { problem: `the event update names nothing to change for ${e.name}` };
  return { change: { op: 'event', action: 'update', id, event: p.value, was: pick(e) } };
}

/** "Oakland Half: Sun 22 Mar 2027, A race" @param {EventChange} c */
export function eventChangeText(c) {
  const e = c.event ?? c.was;
  if (!e) return '';
  const base = `${longDay(e.date)} · ${e.priority} priority${e.target ? ` · ${e.target}` : ''}`;
  if (c.action !== 'update' || !c.was || !c.event) return base;
  const bits = [];
  if (c.was.date !== c.event.date) bits.push(`${longDay(c.was.date)} → ${longDay(c.event.date)}`);
  if (c.was.priority !== c.event.priority) bits.push(`priority ${c.was.priority} → ${c.event.priority}`);
  if (c.was.target !== c.event.target) bits.push(`target ${c.event.target ?? 'none'}`);
  if (c.was.name !== c.event.name) bits.push(`was ${c.was.name}`);
  if (c.was.sport !== c.event.sport || c.was.notes !== c.event.notes) bits.push('new details');
  return bits.join(' · ');
}

/**
 * A goal value from the model: a number, or "4:30" for a pace.
 * @param {string} kind @param {unknown} v
 */
function goalValue(kind, v) {
  if (typeof v === 'number') return v;
  return parseValue(kind, String(v ?? ''));
}

/**
 * { op: "goal", action?, id?, kind?, title?, target?, baseline?, start?, deadline? } checked against his goals.
 * @param {Record<string, unknown>} b @param {{ goals: Goal[], today: string }} ctx
 * @returns {{ change: GoalChange } | { problem: string }}
 */
export function cleanGoalChange(b, { goals, today }) {
  const action = String(b.action ?? (b.id ? 'update' : 'add'));
  if (!ACTIONS.includes(action)) return { problem: 'goal action must be add, update or remove' };
  const kinds = Object.keys(GOAL_KINDS).join(', ');
  if (action !== 'add') {
    const id = String(b.id ?? '');
    const g = goals.find((x) => x.id === id);
    if (!g) return { problem: `no goal with id ${id || '(none)'}: read get_goals for the ids` };
    if (action === 'remove') return { change: { op: 'goal', action: 'remove', id, goal: null, was: g } };
    /** @type {Record<string, unknown>} */
    const next = { ...g };
    if (b.title !== undefined) next.title = b.title;
    for (const k of ['target', 'baseline']) if (b[k] !== undefined) next[k] = goalValue(g.kind, b[k]);
    for (const k of ['start', 'deadline']) if (b[k] !== undefined) next[k] = b[k];
    const [clean] = cleanGoals([next]);
    if (!clean) return { problem: `that goal isn't valid: target and baseline are numbers in ${GOAL_KINDS[g.kind].unit}${g.kind === 'run_10k_pace' ? ' ("4:30")' : ''}, dates YYYY-MM-DD, start before deadline` };
    if (JSON.stringify(clean) === JSON.stringify(g)) return { problem: `the goal update names nothing to change for ${g.title ?? describe(g)}` };
    return { change: { op: 'goal', action: 'update', id, goal: clean, was: g } };
  }
  const kind = String(b.kind ?? '');
  if (!(kind in GOAL_KINDS)) return { problem: `a goal's kind is one of ${kinds}; a race is an event ({ op: "event" })` };
  const k = /** @type {keyof typeof GOAL_KINDS} */ (kind);
  const target = goalValue(k, b.target);
  const baseline = goalValue(k, b.baseline);
  if (!Number.isFinite(baseline)) return { problem: `a new goal needs its baseline, where he is now, in ${GOAL_KINDS[k].unit} (read his data first)` };
  const id = `chat${Math.random().toString(36).slice(2, 8)}`;
  const [clean] = cleanGoals([{ id, kind: k, title: b.title, target, baseline, start: b.start ?? today, deadline: b.deadline }]);
  if (!clean) return { problem: `that goal isn't valid: target in ${GOAL_KINDS[k].unit}${k === 'run_10k_pace' ? ' ("4:30")' : ''}, deadline YYYY-MM-DD after the start` };
  if (clean.deadline < today) return { problem: 'a new goal\'s deadline is in the past' };
  return { change: { op: 'goal', action: 'add', id, goal: clean, was: null } };
}

/** "10k pace 4:30/km by 1 Jun 2027" @param {GoalChange} c */
export function goalChangeText(c) {
  const g = c.goal ?? c.was;
  if (!g) return '';
  const base = `${formatValue(g.kind, g.target)} by ${longDay(g.deadline)}`;
  if (c.action !== 'update' || !c.was || !c.goal) return base;
  const bits = [];
  if (c.was.target !== c.goal.target) bits.push(`target ${formatValue(g.kind, c.was.target)} → ${formatValue(g.kind, c.goal.target)}`);
  if (c.was.deadline !== c.goal.deadline) bits.push(`by ${longDay(c.was.deadline)} → ${longDay(c.goal.deadline)}`);
  if (c.was.baseline !== c.goal.baseline) bits.push(`baseline ${formatValue(g.kind, c.goal.baseline)}`);
  if ((c.was.title ?? '') !== (c.goal.title ?? '')) bits.push('renamed');
  return bits.join(' · ') || base;
}

/** A goal's name on the card. @param {GoalChange} c */
export const goalTitle = (c) => {
  const g = c.goal ?? c.was;
  return g ? g.title || describe(g) : 'Goal';
};

/**
 * { op: "plan_week", week, away?, busy?, sick?, daysOff?, hours?, gym?, hard?, longDay?, feel?, focus?, notes?, note? }:
 * the planner's request for the week (proposal.mjs cleanRequest, the planning screen's answers). `note` is what to
 * keep or plan around, in his words.
 * @param {Record<string, unknown>} b @param {{ today: string }} ctx
 * @returns {{ change: WeekPlanChange } | { problem: string }}
 */
export function cleanWeekPlan(b, { today }) {
  const week = String(b.week ?? b.weekStart ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return { problem: 'plan_week needs week: a day of the week, YYYY-MM-DD' };
  const monday = mondayOf(week);
  const first = mondayOf(today);
  const last = addDays(first, 7 * PLAN_WEEKS_AHEAD);
  if (monday < first || monday > last) return { problem: `plan_week can plan this week up to the week of ${last}` };
  const note = typeof b.note === 'string' ? b.note : typeof b.lock === 'string' ? b.lock : undefined;
  const c = /** @type {{ value?: Record<string, any>, error?: string }} */ (cleanRequest({ ...b, lock: note, weekStart: monday }));
  if (!c.value) return { problem: `plan_week: ${c.error ?? 'not valid'}` };
  // Answers outside the week were dropped by cleanRequest: say so instead of planning without them.
  const asked = ['away', 'busy', 'sick', 'daysOff'].reduce((n, k) => n + (Array.isArray(b[k]) ? b[k].length : 0), 0);
  const kept = ['away', 'busy', 'sick', 'daysOff'].reduce((n, k) => n + (c.value?.[k]?.length ?? 0), 0);
  if (kept < asked) return { problem: `plan_week: away, busy, sick and daysOff are days of the week of ${monday} to ${addDays(monday, 6)}, each in one list` };
  const request = { ...c.value };
  // Apply decides weekly or check-in from the day it runs.
  delete request.kind;
  return { change: { op: 'plan_week', request } };
}

/** "Away Tue–Thu · 8 h · 2 lifts" @param {WeekPlanChange} c */
export function weekPlanText(c) {
  const r = c.request;
  const wd = (/** @type {string} */ d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
  const days = (/** @type {string[]} */ ds) => (ds.length > 2 && ds.every((d, i) => i === 0 || d === addDays(ds[i - 1], 1)) ? `${wd(ds[0])}–${wd(ds[ds.length - 1])}` : ds.map(wd).join(', '));
  const bits = [
    r.away?.length ? `away ${days(r.away)}` : null,
    r.busy?.length ? `busy ${days(r.busy)}` : null,
    r.sick?.length ? `sick ${days(r.sick)}` : null,
    r.daysOff?.length ? `rest ${days(r.daysOff)}` : null,
    r.hours != null ? `${r.hours} h` : null,
    r.gym != null ? `${r.gym} ${r.gym === 1 ? 'lift' : 'lifts'}` : null,
    r.hard != null ? `${r.hard} hard` : null,
    r.longDay ? `long day ${wd(r.longDay)}` : null,
    r.feel ? `feeling ${r.feel}` : null,
    r.lock ? `"${r.lock.length > 60 ? `${r.lock.slice(0, 57)}…` : r.lock}"` : null,
  ].filter(Boolean);
  return ['Coach drafts it; you accept it on Plan', ...bits].join(' · ');
}

/** "Week of 9 Nov" @param {string} monday */
export const weekLabel = (monday) =>
  `Week of ${new Date(`${monday}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`;
