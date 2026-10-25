// Checks for the planner's plans (src/lib/planner/): the request Paolo sends from
// the Plan page, and the plan the agent proposes, before Coach stores it. Pure, so node --test can run it.

import { rowsFromPlan } from './import.mjs';
import { addDays, mondayOf } from './week.mjs';

export const FEELS = ['fresh', 'normal', 'fatigued', 'recovery'];
export const FOCUSES = ['endurance', 'cycling', 'running', 'ski', 'test'];
export const KINDS = ['weekly', 'checkin'];

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A clean planning request, or { error }. weekStart becomes the Monday of the given day. `hours` is the time Paolo
 * has for the week (2 to 20), `gym` the strength sessions he wants (0 to 4), `daysOff` the days with no training
 * (in the week); null or empty means Coach decides from the data.
 * @param {Record<string, unknown>} input
 */
export function cleanRequest(input) {
  const kind = KINDS.includes(String(input?.kind)) ? String(input.kind) : 'weekly';
  const day = String(input?.weekStart ?? '');
  if (!DAY.test(day) || Number.isNaN(Date.parse(`${day}T12:00:00Z`))) return { error: 'Pick a week.' };
  const feel = FEELS.includes(String(input?.feel)) ? String(input.feel) : null;
  const focus = FOCUSES.includes(String(input?.focus)) ? String(input.focus) : null;
  const lock = typeof input?.lock === 'string' && input.lock.trim() ? input.lock.trim().slice(0, 500) : null;
  const weekStart = mondayOf(day);
  const n = (v, lo, hi) => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null);
  const hours = n(input?.hours, 2, 20);
  const gym = n(input?.gym, 0, 4);
  const last = addDays(weekStart, 6);
  const daysOff = Array.isArray(input?.daysOff)
    ? [...new Set(input.daysOff.map(String).filter((d) => DAY.test(d) && d >= weekStart && d <= last))].sort()
    : [];
  return { value: { kind, weekStart, feel, focus, lock, hours, gym, daysOff } };
}

/**
 * The problems with a proposed plan for `weekStart` (empty when it is fine), and its rows for the review.
 * The import (importPlan) does the same conversion, so a plan that passes here imports.
 * @param {any} plan
 * @param {string} weekStart
 * @returns {{ errors: string[], rows: ReturnType<typeof rowsFromPlan> }}
 */
export function checkPlan(plan, weekStart) {
  const errors = [];
  if (!plan || typeof plan !== 'object') return { errors: ['The plan is not a JSON object.'], rows: [] };
  if (plan.weekStart !== weekStart) errors.push(`weekStart is ${plan.weekStart}, not ${weekStart}.`);
  if (!Array.isArray(plan.events)) errors.push('events must be a list.');
  if (Array.isArray(plan.events) && plan.events.length > 40) errors.push('More than 40 events.');
  if (errors.length) return { errors, rows: [] };
  const last = addDays(weekStart, 6);
  plan.events.forEach((e, i) => {
    const at = `Event ${i + 1}`;
    if (typeof e?.title !== 'string' || !e.title.trim() || e.title.length > 120) errors.push(`${at}: the title must be 1 to 120 characters.`);
    const day = String(e?.start ?? '').slice(0, 10);
    if (!DAY.test(day) || day < weekStart || day > last) errors.push(`${at}: start ${e?.start} is not in the week ${weekStart} to ${last}.`);
    if (e?.end && Date.parse(e.end) <= Date.parse(e.start)) errors.push(`${at}: end is not after start.`);
    if (e?.tss != null && !(typeof e.tss === 'number' && e.tss >= 0 && e.tss <= 600)) errors.push(`${at}: tss must be 0 to 600.`);
    if (e?.description != null && String(e.description).length > 4000) errors.push(`${at}: the description is over 4,000 characters.`);
  });
  for (const r of plan.rest ?? []) {
    if (!DAY.test(String(r?.day)) || r.day < weekStart || r.day > last) errors.push(`Rest day ${r?.day} is not in the week.`);
  }
  if (errors.length) return { errors, rows: [] };
  try {
    return { errors: [], rows: rowsFromPlan(plan) };
  } catch (e) {
    return { errors: [e instanceof Error ? e.message : String(e)], rows: [] };
  }
}
