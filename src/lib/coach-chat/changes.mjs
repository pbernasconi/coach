// @ts-check
// The Coach tab's change sets (lift/COACH-CHAT.md): the changes Coach proposes through `propose_changes`, checked
// against the plan as it is, turned into the rows the card shows, and checked against Paolo's rules for the weeks
// they touch. Nothing here writes: Apply (server.ts) runs the plan's own writes. Pure, so node --test can run it.

import { SPORT_IDS, EFFORTS } from '../plan/create.mjs';
import { checkRules, sessionsFromRows } from '../plan/rules.mjs';
import { strengthExercises } from '../plan/strength-text.mjs';
import { isFatigue, SKIP_REASONS } from '../plan/skip.mjs';
import { addDays, isHard, mondayOf } from '../plan/week.mjs';

/** At most this many changes in one card: a bigger change is a new plan, from the Plan page. */
export const MAX_CHANGES = 10;
/** Coach changes today and the next three weeks, not the past. */
export const HORIZON_DAYS = 21;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const OPS = new Set(['move', 'skip', 'unskip', 'add', 'remove', 'update', 'remember']);
/** A coaching preference Coach keeps (Settings → Coaching preferences), one line. */
export const MAX_NOTE = 200;
/**
 * A gym lift's description is the coach's note only (planner.md, "Strength"): Lift plans the exercises, sets, loads and
 * the barbell warm-up ramp from the template. A longer text is a workout written out by hand, which the phone can't
 * log set by set.
 */
export const MAX_LIFT_NOTE = 300;
/** The strength sessions without a Lift template: their numbered `1) Name 3x8: cue` lines are the session. */
export const HOME_TYPES = ['strength-home', 'mobility'];

/** The workout type of a gym lift on a template, as the web's library add sets it. @param {string} template */
export const liftWorkoutType = (template) => (/dumbbell|hotel/i.test(template) ? 'strength-dumbbell' : 'strength-heavy');

/** Whether a planned workout is a gym lift on a Lift template (not a home or physio session). @param {PlanRow} r */
export const isGymLift = (r) =>
  r.sport === 'strength' && (Boolean(r.liftTemplate) || r.workoutType === 'strength-heavy' || r.workoutType === 'strength-dumbbell');

/**
 * The problem with a gym lift's note, or null: no exercise lines, no numbered steps, short.
 * @param {string} text
 */
export function liftNoteProblem(text) {
  if (!text) return null;
  if (strengthExercises(text).length > 0 || /(^|\s)\d{1,2}\)\s/.test(text)) {
    return 'a gym lift\'s description is the coach\'s note only (effort, what to cut when short on time): Lift plans the exercises, sets, loads and warm-up sets from its template, so leave the exercises, the warm-up steps and ramp sets out';
  }
  if (text.length > MAX_LIFT_NOTE) return `a gym lift's description is a short coach's note, at most ${MAX_LIFT_NOTE} characters: Lift plans the exercises and warm-up sets from its template`;
  return null;
}

/**
 * A planned workout as Coach sees it (loadRange's workouts, server.ts `planRows`).
 * @typedef {{ id: string, date: string, startTime: string | null, title: string, sport: string,
 *   workoutType: string | null, intensity: string | null, duration: number | null, description?: string | null,
 *   status: string, skipReason?: string | null, state: string, liftTemplate?: string | null }} PlanRow
 */
/**
 * One checked change.
 * @typedef {{ op: 'move', id: string, date: string, startTime: string | null }
 *   | { op: 'skip', id: string, reason: string }
 *   | { op: 'unskip', id: string }
 *   | { op: 'remove', id: string }
 *   | { op: 'update', id: string, title?: string, duration?: number, effort?: string, description?: string, startTime?: string | null }
 *   | { op: 'add', date: string, sport: string, startTime: string | null, title: string, duration: number | null,
 *       effort: string, description: string, liftTemplate?: string | null, workoutType?: string | null }
 *   | { op: 'remember', text: string }} Change
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
 * A strength workout it adds is a gym lift on one of Lift's `templates` (`liftTemplate`), or a home or physio session
 * whose numbered exercise lines are the session; a gym lift's description is a short coach's note.
 * @param {unknown} raw  propose_changes' `changes`
 * @param {{ rows: PlanRow[], today: string, templates?: string[] }} plan
 * @returns {{ changes: Change[], problems: string[] }}
 */
export function cleanChanges(raw, { rows, today, templates = [] }) {
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
    if (op === 'remember') {
      const text = str(b.text, MAX_NOTE + 1).replace(/\s+/g, ' ');
      if (text.length < 3) return problems.push(`${at}: remember needs the preference as text`);
      if (text.length > MAX_NOTE) return problems.push(`${at}: a preference is one line, at most ${MAX_NOTE} characters`);
      return changes.push({ op: 'remember', text });
    }
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
      const description = str(b.description, 2000);
      if (sport !== 'strength') return changes.push({ op: 'add', date, sport, startTime: t.value, title, duration, effort, description });
      const lift = strengthAdd(b, description, templates);
      if ('problem' in lift) return problems.push(`${at}: ${lift.problem}`);
      return changes.push({ op: 'add', date, sport, startTime: t.value, title, duration, effort, description, ...lift });
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
    if (b.description != null) {
      u.description = str(b.description, 2000);
      const bad = isGymLift(row) ? liftNoteProblem(u.description) : null;
      if (bad) return problems.push(`${at}: ${bad}`);
    }
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

/**
 * An added strength workout: a gym lift on a Lift template, or a home/physio session written as exercise lines.
 * @param {Record<string, unknown>} b @param {string} description @param {string[]} templates
 * @returns {{ liftTemplate: string | null, workoutType: string } | { problem: string }}
 */
function strengthAdd(b, description, templates) {
  const names = templates.length ? templates.join(', ') : 'none synced';
  const shape =
    `a strength workout is either a gym lift ({ liftTemplate: one of ${names} }, description a short coach's note) or a ` +
    `home or physio session ({ workoutType: ${HOME_TYPES.join(' | ')} }, description its numbered lines from the plan ` +
    'structure, "1) Name 3x8: cue", one per line)';
  const workoutType = typeof b.workoutType === 'string' ? b.workoutType : null;
  if (b.liftTemplate != null && b.liftTemplate !== '') {
    const wanted = String(b.liftTemplate).trim().toLowerCase();
    const template = templates.find((n) => n.toLowerCase() === wanted);
    if (!template) return { problem: `liftTemplate "${String(b.liftTemplate)}" is not a Lift template; use one of ${names}` };
    const bad = liftNoteProblem(description);
    if (bad) return { problem: bad };
    return { liftTemplate: template, workoutType: liftWorkoutType(template) };
  }
  if (workoutType && HOME_TYPES.includes(workoutType)) {
    if (strengthExercises(description).length === 0) {
      return { problem: `a ${workoutType} session's description is its exercise lines ("1) Name 3x8: cue", one per line), so each set can be logged` };
    }
    return { liftTemplate: null, workoutType };
  }
  // No templates synced (the profile failed): a gym lift without a name; Lift's repair picks the template later.
  if (templates.length === 0 && (workoutType === 'strength-heavy' || workoutType === 'strength-dumbbell')) {
    const bad = liftNoteProblem(description);
    return bad ? { problem: bad } : { liftTemplate: null, workoutType };
  }
  return { problem: shape };
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
    if (c.op === 'remember') return { kind: 'added', title: 'Coaching preference', detail: c.text };
    if (c.op === 'add') {
      const bits = [when(c.date, c.startTime), c.duration ? `${c.duration} min` : null, c.liftTemplate ?? EFFORTS[/** @type {keyof typeof EFFORTS} */ (c.effort)]?.label];
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
    if (c.op === 'remember') return;
    if (c.op === 'add') {
      out.push({
        id: `new-${i}`, date: c.date, startTime: c.startTime, title: c.title, sport: c.sport, workoutType: c.workoutType ?? null,
        liftTemplate: c.liftTemplate ?? null,
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

/** The heading the chat's preferences go under in Settings → Coaching preferences. */
export const NOTES_HEADING = '## From Coach chat';

/**
 * The coaching preferences with one more line from the chat, under NOTES_HEADING (added at the end when missing).
 * @param {string} notes @param {string} text
 */
export function addNote(notes, text) {
  const line = `- ${text}`;
  const lines = String(notes ?? '').replace(/\s+$/, '').split('\n');
  const at = lines.indexOf(NOTES_HEADING);
  if (at < 0) return [...(lines.join('\n').trim() ? [...lines, ''] : []), NOTES_HEADING, line].join('\n') + '\n';
  let end = at + 1;
  while (end < lines.length && !/^#{1,2} /.test(lines[end])) end++;
  while (end > at + 1 && !lines[end - 1].trim()) end--;
  lines.splice(end, 0, line);
  return lines.join('\n') + '\n';
}

/**
 * The preferences without that line (Undo of a remember). Paolo may have edited the rest since: only the line goes.
 * @param {string} notes @param {string} text
 */
export function dropNote(notes, text) {
  const lines = String(notes ?? '').split('\n');
  const at = lines.lastIndexOf(`- ${text}`);
  if (at < 0) return String(notes ?? '');
  lines.splice(at, 1);
  const h = lines.indexOf(NOTES_HEADING);
  // An empty heading goes too.
  if (h >= 0 && (h + 1 >= lines.length || /^#{1,2} /.test(lines[h + 1]) || lines.slice(h + 1).every((l) => !l.trim()))) {
    lines.splice(h, 1);
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\s+$/, '');
}

/**
 * A skip of today's workout for tired, sore or sick is a fatigue signal (check-in.md): the web's Skip then eases the
 * next quality session, so a chat card must too. Returns a problem for each quality session still on today or
 * tomorrow after such a skip.
 * @param {PlanRow[]} rows @param {Change[]} changes @param {string} today
 * @returns {string[]}
 */
export function fatigueIssues(rows, changes, today) {
  const tiredSkip = changes.find((c) => {
    if (c.op !== 'skip' || !isFatigue(c.reason)) return false;
    return rows.find((r) => r.id === c.id)?.date === today;
  });
  if (!tiredSkip || tiredSkip.op !== 'skip') return [];
  const after = simulate(rows, changes);
  const tomorrow = addDays(today, 1);
  return after
    .filter((r) => (r.date === today || r.date === tomorrow) && r.status !== 'skipped' && r.state !== 'done' && isHard(r))
    .map((r) => `fatigue: today is skipped for ${tiredSkip.reason}, but ${r.title} (${dayLabel(r.date)}) is still a quality session; move it a day later, or skip it and add an easy session in its place`);
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
      // A lift says what kind it is: a gym lift's template, or a home/physio session.
      const kind = r.sport !== 'strength' ? null : r.liftTemplate ? `Lift template ${r.liftTemplate}` : r.workoutType;
      const what = [r.sport, kind, r.duration ? `${r.duration} min` : null, r.intensity]
        .filter(Boolean)
        .join(', ');
      return `${r.id}  ${r.date} ${dayLabel(r.date).slice(0, 3)} ${hm(r.startTime) ?? '--:--'}  ${r.title} (${what})  [${flag}]`;
    })
    .join('\n');
}

/**
 * propose_changes' input, checked: the changes must be valid (else the model fixes them). Rules they newly break go
 * back to the model on its first try; on a later try (it kept them, or Paolo asked for it) they go on the card as
 * warnings.
 * @param {any} input @param {{ rows: PlanRow[], today: string, templates?: string[] }} plan @param {number} attempt  1 for the first try
 * @returns {{ ok: true, value: { title: string, why: string, changes: Change[], items: Item[], warnings: string[],
 *   basis: Record<string, string> } } | { ok: false, problems: string[] }}
 */
export function checkProposalInput(input, plan, attempt) {
  const title = str(input?.title, 80);
  const why = str(input?.why, 400);
  const { changes, problems } = cleanChanges(input?.changes, plan);
  if (!title) problems.unshift('title is missing');
  if (problems.length) return { ok: false, problems };
  const warnings = [...newRuleIssues(plan.rows, changes, plan.today), ...fatigueIssues(plan.rows, changes, plan.today)];
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
