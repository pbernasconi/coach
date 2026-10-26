// @ts-check
// The Coach tab's change sets (lift/COACH-CHAT.md): the changes Coach proposes through `propose_changes`, checked
// against the plan as it is, turned into the rows the card shows, and checked against Paolo's rules for the weeks
// they touch. Nothing here writes: Apply (server.ts) runs the plan's own writes. Pure, so node --test can run it.

import { SPORT_IDS, EFFORTS } from '../plan/create.mjs';
import { checkRules, sessionsFromRows } from '../plan/rules.mjs';
import { SKIP_REASONS } from '../plan/skip.mjs';
import { addDays, mondayOf } from '../plan/week.mjs';

/** At most this many changes in one card: a bigger change is a new plan, from the Plan page. */
export const MAX_CHANGES = 10;
/** Coach changes today and the next three weeks, not the past. */
export const HORIZON_DAYS = 21;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const OPS = new Set(['move', 'skip', 'unskip', 'add', 'remove', 'update']);

/**
 * A planned workout as Coach sees it (loadRange's workouts, server.ts `planRows`).
 * @typedef {{ id: string, date: string, startTime: string | null, title: string, sport: string,
 *   workoutType: string | null, intensity: string | null, duration: number | null, description?: string | null,
 *   status: string, skipReason?: string | null, state: string }} PlanRow
 */
/**
 * One checked change.
 * @typedef {{ op: 'move', id: string, date: string, startTime: string | null }
 *   | { op: 'skip', id: string, reason: string }
 *   | { op: 'unskip', id: string }
 *   | { op: 'remove', id: string }
 *   | { op: 'update', id: string, title?: string, duration?: number, effort?: string, description?: string, startTime?: string | null }
 *   | { op: 'add', date: string, sport: string, startTime: string | null, title: string, duration: number | null,
 *       effort: string, description: string }} Change
 */
/** A row of the card, as Kobo's ChangeItem: added, removed or changed. @typedef {{ kind: 'added' | 'removed' | 'changed', title: string, detail: string }} Item */

/** "HH:MM" of a stored time ("09:00:00"), or null. @param {unknown} t */
export function hm(t) {
  const m = /^(\d{2}):(\d{2})/.exec(String(t ?? ''));
  return m ? `${m[1]}:${m[2]}` : null;
}

const str = (/** @type {unknown} */ v, /** @type {number} */ max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * The model's changes, checked against the plan: each names a workout that exists and isn't done, a day from today
 * to the horizon, a real time. Returns the clean changes, or the problems for the model to fix.
 * @param {unknown} raw  propose_changes' `changes`
 * @param {{ rows: PlanRow[], today: string }} plan
 * @returns {{ changes: Change[], problems: string[] }}
 */
export function cleanChanges(raw, { rows, today }) {
  /** @type {string[]} */
  const problems = [];
  /** @type {Change[]} */
  const changes = [];
  if (!Array.isArray(raw) || raw.length === 0) return { changes, problems: ['changes must be a list of 1 or more changes'] };
  if (raw.length > MAX_CHANGES) return { changes, problems: [`at most ${MAX_CHANGES} changes in one proposal`] };
  const byId = new Map(rows.map((r) => [r.id, r]));
  const last = addDays(today, HORIZON_DAYS);
  const seen = new Set();
  raw.forEach((c, i) => {
    const at = `change ${i + 1}`;
    const b = c && typeof c === 'object' ? /** @type {Record<string, unknown>} */ (c) : {};
    const op = String(b.op ?? '');
    if (!OPS.has(op)) return problems.push(`${at}: op must be one of ${[...OPS].join(', ')}`);
    const dayIn = (/** @type {unknown} */ d, /** @type {string} */ what) => {
      if (typeof d !== 'string' || !DATE.test(d)) return problems.push(`${at}: ${what} must be YYYY-MM-DD`) && null;
      if (d < today) return problems.push(`${at}: ${d} is in the past; Coach changes today and later only`) && null;
      if (d > last) return problems.push(`${at}: ${d} is more than ${HORIZON_DAYS} days out`) && null;
      return d;
    };
    const time = (/** @type {unknown} */ t) => {
      if (t == null || t === '') return { ok: true, value: null };
      return typeof t === 'string' && TIME.test(t) ? { ok: true, value: t } : { ok: false, value: null };
    };
    if (op === 'add') {
      const sport = String(b.sport ?? '');
      if (!SPORT_IDS.includes(sport)) return problems.push(`${at}: sport must be one of ${SPORT_IDS.join(', ')}`);
      const date = dayIn(b.date, 'date');
      if (!date) return;
      const t = time(b.startTime);
      if (!t.ok) return problems.push(`${at}: startTime must be HH:MM`);
      const duration = typeof b.duration === 'number' && b.duration >= 5 && b.duration <= 600 ? Math.round(b.duration) : null;
      if (sport !== 'rest' && duration == null) return problems.push(`${at}: duration must be 5 to 600 minutes`);
      const effort = typeof b.effort === 'string' && b.effort in EFFORTS ? b.effort : 'easy';
      const title = str(b.title, 120);
      if (!title) return problems.push(`${at}: an added workout needs a title`);
      return changes.push({ op: 'add', date, sport, startTime: t.value, title, duration, effort, description: str(b.description, 2000) });
    }
    const id = String(b.id ?? '');
    const row = byId.get(id);
    if (!row) return problems.push(`${at}: no workout with id ${id || '(none)'} in the plan`);
    if (seen.has(id)) return problems.push(`${at}: ${row.title} has more than one change; merge them into one`);
    seen.add(id);
    if (row.state === 'done') return problems.push(`${at}: ${row.title} is done; a done workout stays as it is`);
    if (row.date < today) return problems.push(`${at}: ${row.title} is on ${row.date}, in the past`);
    if (op === 'move') {
      const date = dayIn(b.date, 'date');
      if (!date) return;
      const t = time(b.startTime);
      if (!t.ok) return problems.push(`${at}: startTime must be HH:MM`);
      const startTime = b.startTime === undefined ? hm(row.startTime) : t.value;
      if (date === row.date && startTime === hm(row.startTime)) return problems.push(`${at}: ${row.title} is already on ${date}`);
      return changes.push({ op: 'move', id, date, startTime });
    }
    if (op === 'skip') {
      if (row.status === 'skipped') return problems.push(`${at}: ${row.title} is already skipped`);
      const reason = str(b.reason, 40).toLowerCase();
      return changes.push({ op: 'skip', id, reason: SKIP_REASONS.includes(reason) ? reason : 'other' });
    }
    if (op === 'unskip') {
      if (row.status !== 'skipped') return problems.push(`${at}: ${row.title} is not skipped`);
      return changes.push({ op: 'unskip', id });
    }
    if (op === 'remove') return changes.push({ op: 'remove', id });
    // update: only the fields it names.
    /** @type {Extract<Change, { op: 'update' }>} */
    const u = { op: 'update', id };
    if (b.title != null) u.title = str(b.title, 120);
    if (b.duration != null) {
      if (typeof b.duration !== 'number' || b.duration < 5 || b.duration > 600) return problems.push(`${at}: duration must be 5 to 600 minutes`);
      u.duration = Math.round(b.duration);
    }
    if (b.effort != null) {
      if (typeof b.effort !== 'string' || !(b.effort in EFFORTS)) return problems.push(`${at}: effort must be one of ${Object.keys(EFFORTS).join(', ')}`);
      u.effort = b.effort;
    }
    if (b.description != null) u.description = str(b.description, 2000);
    if (b.startTime !== undefined) {
      const t = time(b.startTime);
      if (!t.ok) return problems.push(`${at}: startTime must be HH:MM`);
      u.startTime = t.value;
    }
    if (Object.keys(u).length === 2) return problems.push(`${at}: update names nothing to change`);
    return changes.push(u);
  });
  return { changes, problems };
}

/** "Tue 27 Oct" @param {string} day */
export function dayLabel(day) {
  const d = new Date(`${day}T12:00:00Z`);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

const when = (/** @type {string} */ date, /** @type {string | null | undefined} */ time) => `${dayLabel(date)}${time ? ` ${time}` : ''}`;

/**
 * The card's rows: one per change, before → after.
 * @param {Change[]} changes @param {PlanRow[]} rows
 * @returns {Item[]}
 */
export function describeChanges(changes, rows) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return changes.map((c) => {
    if (c.op === 'add') {
      const bits = [when(c.date, c.startTime), c.duration ? `${c.duration} min` : null, EFFORTS[/** @type {keyof typeof EFFORTS} */ (c.effort)]?.label];
      return { kind: 'added', title: c.title, detail: bits.filter(Boolean).join(' · ') };
    }
    const row = /** @type {PlanRow} */ (byId.get(c.id));
    const title = row?.title ?? 'Workout';
    const was = when(row?.date ?? '', hm(row?.startTime));
    switch (c.op) {
      case 'move': return { kind: 'changed', title, detail: `${was} → ${when(c.date, c.startTime)}` };
      case 'skip': return { kind: 'removed', title, detail: `Skip · ${was} · ${c.reason}` };
      case 'unskip': return { kind: 'added', title, detail: `Back in the plan · ${was}` };
      case 'remove': return { kind: 'removed', title, detail: `Delete · ${was}` };
      default: {
        const bits = [];
        if (c.title != null && c.title !== row?.title) bits.push(`renamed "${c.title}"`);
        if (c.duration != null) bits.push(`${row?.duration ?? '?'} → ${c.duration} min`);
        if (c.effort != null) bits.push(`${row?.intensity ?? '?'} → ${EFFORTS[/** @type {keyof typeof EFFORTS} */ (c.effort)].label}`);
        if (c.startTime !== undefined) bits.push(`${hm(row?.startTime) ?? 'no time'} → ${c.startTime ?? 'no time'}`);
        if (c.description != null) bits.push('new notes');
        return { kind: 'changed', title: c.title || title, detail: `${dayLabel(row?.date ?? '')} · ${bits.join(', ')}` };
      }
    }
  });
}

/**
 * The plan after the changes, for the rule check. An added workout gets the id `new-<n>`.
 * @param {PlanRow[]} rows @param {Change[]} changes
 * @returns {PlanRow[]}
 */
export function simulate(rows, changes) {
  let out = rows.map((r) => ({ ...r }));
  changes.forEach((c, i) => {
    if (c.op === 'add') {
      out.push({
        id: `new-${i}`, date: c.date, startTime: c.startTime, title: c.title, sport: c.sport, workoutType: null,
        intensity: EFFORTS[/** @type {keyof typeof EFFORTS} */ (c.effort)]?.label ?? null, duration: c.duration, status: 'planned', state: 'planned',
      });
      return;
    }
    if (c.op === 'remove') {
      out = out.filter((r) => r.id !== c.id);
      return;
    }
    const r = out.find((x) => x.id === c.id);
    if (!r) return;
    if (c.op === 'move') Object.assign(r, { date: c.date, startTime: c.startTime });
    else if (c.op === 'skip') Object.assign(r, { status: 'skipped', state: 'skipped', skipReason: c.reason });
    else if (c.op === 'unskip') Object.assign(r, { status: 'planned', state: 'planned', skipReason: null });
    else if (c.op === 'update') {
      if (c.title) r.title = c.title;
      if (c.duration != null) r.duration = c.duration;
      if (c.effort != null) r.intensity = EFFORTS[/** @type {keyof typeof EFFORTS} */ (c.effort)].label;
      if (c.startTime !== undefined) r.startTime = c.startTime;
    }
  });
  return out;
}

/** @param {PlanRow[]} rows @param {string} weekStart @param {string} today */
function weekIssues(rows, weekStart, today) {
  const week = rows
    .filter((r) => r.date >= weekStart && r.date <= addDays(weekStart, 6) && r.status !== 'skipped')
    .map((r) => ({
      date: r.date, start_time: hm(r.startTime), duration: r.duration, title: r.title, activity_type: r.sport,
      workout_type: r.workoutType, intensity: r.intensity,
    }));
  return checkRules(sessionsFromRows(week), { weekStart, today })
    // Days before today are history; a weekly count (no day) still counts.
    .filter((i) => i.day == null || i.day >= today);
}

/**
 * The rules the changes break that the plan didn't break before (rules.mjs, for each week they touch). The card shows
 * them; the model gets them first and can fix them.
 * @param {PlanRow[]} rows @param {Change[]} changes @param {string} today
 * @returns {string[]}
 */
export function newRuleIssues(rows, changes, today) {
  const after = simulate(rows, changes);
  const touched = new Set();
  for (const c of changes) {
    if ('date' in c && c.date) touched.add(mondayOf(c.date));
    const row = 'id' in c ? rows.find((r) => r.id === c.id) : null;
    if (row) touched.add(mondayOf(row.date));
  }
  /** @type {string[]} */
  const out = [];
  for (const week of [...touched].sort()) {
    const before = new Set(weekIssues(rows, week, today).map((i) => i.message));
    for (const i of weekIssues(after, week, today)) if (!before.has(i.message)) out.push(`${i.id}: ${i.message}`);
  }
  return out;
}

/**
 * What a workout looked like when Coach proposed: Apply refuses a proposal whose workouts changed since (409).
 * @param {PlanRow} r
 */
export function fingerprint(r) {
  return [r.date, hm(r.startTime) ?? '', r.status, r.title, r.duration ?? ''].join('|');
}

/**
 * The ids a proposal touches, with their fingerprints, stored with it.
 * @param {Change[]} changes @param {PlanRow[]} rows
 * @returns {Record<string, string>}
 */
export function basisOf(changes, rows) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const c of changes) {
    const row = 'id' in c ? rows.find((r) => r.id === c.id) : null;
    if (row) out[row.id] = fingerprint(row);
  }
  return out;
}

/**
 * Whether the plan still looks as it did when Coach proposed: every touched workout is there, unchanged, not done.
 * @param {Record<string, string>} basis @param {PlanRow[]} rows
 */
export function isStale(basis, rows) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return Object.entries(basis).some(([id, print]) => {
    const r = byId.get(id);
    return !r || r.state === 'done' || fingerprint(r) !== print;
  });
}

/**
 * The plan as text for the model: each workout of the weeks with its id, day, time, what it is and its state.
 * @param {PlanRow[]} rows @param {string} today
 */
export function planText(rows, today) {
  if (!rows.length) return 'No workouts planned.';
  return rows
    .map((r) => {
      const flag = r.state === 'done' ? 'DONE' : r.status === 'skipped' ? `SKIPPED${r.skipReason ? ` (${r.skipReason})` : ''}` : r.date < today ? 'MISSED' : r.date === today ? 'TODAY' : 'planned';
      const what = [r.sport, r.duration ? `${r.duration} min` : null, r.intensity].filter(Boolean).join(', ');
      return `${r.id}  ${r.date} ${dayLabel(r.date).slice(0, 3)} ${hm(r.startTime) ?? '--:--'}  ${r.title} (${what})  [${flag}]`;
    })
    .join('\n');
}

/**
 * propose_changes' input, checked: the changes must be valid (else the model fixes them). Rules they newly break go
 * back to the model on its first try; on a later try (it kept them, or Paolo asked for it) they go on the card as
 * warnings.
 * @param {any} input @param {{ rows: PlanRow[], today: string }} plan @param {number} attempt  1 for the first try
 * @returns {{ ok: true, value: { title: string, why: string, changes: Change[], items: Item[], warnings: string[],
 *   basis: Record<string, string> } } | { ok: false, problems: string[] }}
 */
export function checkProposalInput(input, plan, attempt) {
  const title = str(input?.title, 80);
  const why = str(input?.why, 400);
  const { changes, problems } = cleanChanges(input?.changes, plan);
  if (!title) problems.unshift('title is missing');
  if (problems.length) return { ok: false, problems };
  const warnings = newRuleIssues(plan.rows, changes, plan.today);
  if (warnings.length && attempt <= 1) {
    return {
      ok: false,
      problems: [
        ...warnings,
        "These break Paolo's rules. Fix them, or, if he asked for this on purpose, call propose_changes again with the same changes and say so in why.",
      ],
    };
  }
  return { ok: true, value: { title, why, changes, items: describeChanges(changes, plan.rows), warnings, basis: basisOf(changes, plan.rows) } };
}
