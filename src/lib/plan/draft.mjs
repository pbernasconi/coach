// Changes Paolo makes to a draft week on the planning screen (/plan/week): move a session, change its length,
// remove it, and the "what changed, what you gave up" line between two versions. Pure, so node --test can run it
// (draft.test.mjs); proposals.ts stores the result.

import { addDays } from './week.mjs';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const HOME_TZ = 'America/Los_Angeles';
const TIME = /^\d{2}:\d{2}$/;

/** @param {string} s "YYYY-MM-DDTHH:MM[:SS]" → minutes since midnight */
const minutesOf = (s) => Number(s.slice(11, 13)) * 60 + Number(s.slice(14, 16));
/** @param {string} day @param {number} min */
const at = (day, min) => `${day}T${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:00`;

/**
 * The event's length in minutes, or null when it has no end time.
 * @param {any} e
 */
export function lengthOf(e) {
  const s = String(e?.start ?? '');
  const end = String(e?.end ?? '');
  if (s.length < 16 || end.length < 16) return null;
  return (Date.parse(`${end.slice(0, 16)}:00Z`) - Date.parse(`${s.slice(0, 16)}:00Z`)) / 60_000;
}

/**
 * One change to the plan JSON's events, or { error }. `op` is one of:
 * - { kind: 'move', index, date, time, timeZone? }  the session starts on `date` at `time` (HH:MM) on the clock of
 *   `timeZone` (that day's zone; none or home = no zone on the event), same length
 * - { kind: 'length', index, minutes }   the session lasts `minutes` (10 to 360), same start
 * - { kind: 'remove', index }            the session goes
 * The plan's other fields stay as they are.
 * @param {any} plan
 * @param {{ kind: string, index: number, date?: string, time?: string, minutes?: number, timeZone?: string }} op
 * @returns {{ plan: any } | { error: string }}
 */
export function editPlan(plan, op) {
  const events = Array.isArray(plan?.events) ? plan.events : null;
  if (!events) return { error: 'This draft has no sessions.' };
  const i = Number(op?.index);
  if (!Number.isInteger(i) || i < 0 || i >= events.length) return { error: 'That session is not in this draft.' };
  const e = events[i];
  const next = events.slice();
  if (op.kind === 'remove') {
    next.splice(i, 1);
    return { plan: { ...plan, events: next } };
  }
  if (op.kind === 'move') {
    const date = String(op.date ?? '');
    const time = String(op.time ?? '');
    if (!DAY.test(date) || date < plan.weekStart || date > addDays(plan.weekStart, 6)) return { error: 'Pick a day in this week.' };
    if (!TIME.test(time)) return { error: 'Pick a time.' };
    const start = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
    const len = lengthOf(e) ?? 60;
    if (start < 4 * 60 || start + len > 23 * 60 + 59) return { error: 'Pick a time between 4:00 and the end of the day.' };
    next[i] = { ...e, start: at(date, start), end: at(date, start + len) };
    if (typeof op.timeZone === 'string') {
      if (op.timeZone && op.timeZone !== HOME_TZ) next[i].timeZone = op.timeZone;
      else delete next[i].timeZone;
    }
    return { plan: { ...plan, events: next } };
  }
  if (op.kind === 'length') {
    const m = Number(op.minutes);
    if (!Number.isInteger(m) || m < 10 || m > 360) return { error: 'A session lasts 10 minutes to 6 hours.' };
    const s = String(e?.start ?? '');
    if (s.length < 16) return { error: 'This session has no start time.' };
    const day = s.slice(0, 10);
    const start = minutesOf(s);
    if (start + m > 23 * 60 + 59) return { error: 'That runs past midnight.' };
    const old = lengthOf(e);
    // A planned TSS scales with the time; steps (when there are any) are rebuilt from the bank on import.
    const tss = typeof e.tss === 'number' && old ? Math.round((e.tss * m) / old) : e.tss;
    next[i] = { ...e, end: at(day, start + m), ...(tss === undefined ? {} : { tss }) };
    return { plan: { ...plan, events: next } };
  }
  return { error: 'Unknown change.' };
}

/** @param {any} e */
const keyOf = (e) => String(e?.title ?? '').replace(/[^\p{L}\p{N} ]/gu, '').trim().toLowerCase();
/** @param {any} e */
const dayName = (e) => new Date(`${String(e.start).slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
/** @param {number} m */
export const hm = (m) => {
  const a = Math.abs(Math.round(m));
  if (a < 60) return `${a} min`;
  return a % 60 ? `${Math.floor(a / 60)}h${String(a % 60).padStart(2, '0')}` : `${a / 60}h`;
};

/**
 * What changed from plan `a` to plan `b`, for the "Changed / Gave up" lines: sessions removed, added, moved and
 * made longer or shorter (matched by title), and the week's minutes before and after.
 * @param {any} a
 * @param {any} b
 * @returns {{ changed: { what: string, how: string }[], minutesBefore: number, minutesAfter: number, removed: string[] }}
 */
export function diffPlans(a, b) {
  const ea = (a?.events ?? []).filter((e) => lengthOf(e) != null);
  const eb = (b?.events ?? []).filter((e) => lengthOf(e) != null);
  const used = new Set();
  /** @type {{ what: string, how: string }[]} */
  const changed = [];
  const removed = [];
  for (const x of ea) {
    // Same title, preferring the same day.
    let j = eb.findIndex((y, k) => !used.has(k) && keyOf(y) === keyOf(x) && String(y.start).slice(0, 10) === String(x.start).slice(0, 10));
    if (j < 0) j = eb.findIndex((y, k) => !used.has(k) && keyOf(y) === keyOf(x));
    if (j < 0) {
      changed.push({ what: `${dayName(x)} ${x.title}`, how: 'removed' });
      removed.push(String(x.title));
      continue;
    }
    used.add(j);
    const y = eb[j];
    const la = lengthOf(x) ?? 0;
    const lb = lengthOf(y) ?? 0;
    const moved = String(x.start).slice(0, 16) !== String(y.start).slice(0, 16);
    if (moved && String(x.start).slice(0, 10) !== String(y.start).slice(0, 10)) {
      changed.push({ what: String(x.title), how: `${dayName(x)} → ${dayName(y)} ${String(y.start).slice(11, 16)}` });
    } else if (moved) {
      changed.push({ what: `${dayName(x)} ${x.title}`, how: `${String(x.start).slice(11, 16)} → ${String(y.start).slice(11, 16)}` });
    }
    if (la !== lb) changed.push({ what: `${dayName(y)} ${y.title}`, how: `${hm(la)} → ${hm(lb)}` });
  }
  eb.forEach((y, k) => {
    if (!used.has(k)) changed.push({ what: `${dayName(y)} ${y.title}`, how: 'added' });
  });
  const total = (es) => es.reduce((n, e) => n + (lengthOf(e) ?? 0), 0);
  return { changed, minutesBefore: total(ea), minutesAfter: total(eb), removed };
}

/**
 * The "Gave up" line for a diff, or null when nothing was given up.
 * @param {{ minutesBefore: number, minutesAfter: number, removed: string[] }} d
 */
export function gaveUp(d) {
  const parts = [];
  if (d.minutesAfter < d.minutesBefore) parts.push(`${hm(d.minutesBefore - d.minutesAfter)} of the week`);
  if (d.removed.length) parts.push(d.removed.length === 1 ? d.removed[0] : `${d.removed.length} sessions`);
  return parts.length ? parts.join(' and ') : null;
}
