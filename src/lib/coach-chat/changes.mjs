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
 *   status: string, skipReason?: string | null, state: string, liftTemplate?: string | null,
 *   activityId?: string | null }} PlanRow  `activityId`: the Strava activity a done workout matched (get_activity reads it)
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
    // A missed workout can be moved to today or later (catching it up); nothing else changes the past.
    if (row.date < today && op !== 'move') return problems.push(`${at}: ${row.title} is on ${row.date}, in the past; only a move to today or later can change it`);
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
 * An added gym lift that copies a lift of the same Lift template still open that week (not done, not skipped, not
 * removed by the same card). "Move the heavy lift to Wednesday" written as an add left the old one in place
 * (2026-10-27: Heavy barbell on Monday and Tuesday). A missed copy is always wrong (`hard`: move it instead); a
 * planned one may be on purpose, so it is a rule warning.
 * @param {PlanRow[]} rows @param {Change[]} changes
 * @returns {{ hard: string[], soft: string[] }}
 */
export function duplicateLiftIssues(rows, changes) {
  const after = simulate(rows, changes);
  /** @type {string[]} */
  const hard = [];
  /** @type {string[]} */
  const soft = [];
  changes.forEach((c, i) => {
    if (c.op !== 'add' || !c.liftTemplate) return;
    const week = mondayOf(c.date);
    const template = c.liftTemplate.toLowerCase();
    for (const r of after) {
      if (r.id === `new-${i}` || String(r.id).startsWith('new-')) continue;
      if ((r.liftTemplate ?? '').toLowerCase() !== template || mondayOf(r.date) !== week) continue;
      if (r.state === 'done' || r.status === 'skipped' || r.status === 'done') continue;
      const where = `${r.title} (${r.id}, ${dayLabel(r.date)})`;
      if (r.state === 'missed') hard.push(`add of ${c.liftTemplate} on ${dayLabel(c.date)} copies ${where}, which is missed and still in the plan: move that workout instead ({ op: "move", id: "${r.id}" }), never add a second one`);
      else soft.push(`add of ${c.liftTemplate} on ${dayLabel(c.date)}: ${where} is already planned this week; to change its day use { op: "move", id: "${r.id}" } instead of adding a copy`);
    }
  });
  return { hard, soft };
}

/**
 * What a workout looked like when Coach proposed: Apply refuses a proposal whose workouts changed since (409).
 * @param {PlanRow} r
 */
export function fingerprint(r) {
  return [r.date, hm(r.startTime) ?? '', r.status, r.title, r.duration ?? '', r.intensity ?? '', r.liftTemplate ?? '', textHash(r.description)].join('|');
}

/** The five-field fingerprint cards stored before 2026-10-29; isStale still reads them. @param {PlanRow} r */
const legacyFingerprint = (r) => [r.date, hm(r.startTime) ?? '', r.status, r.title, r.duration ?? ''].join('|');

/** A short hash of a workout's notes, so an edit to them shows in the fingerprint. @param {unknown} text */
function textHash(text) {
  let h = 5381;
  for (const ch of String(text ?? '')) h = ((h * 33) ^ (ch.codePointAt(0) ?? 0)) >>> 0;
  return h.toString(36);
}

/** The fingerprint `print` was made with, of `r`. @param {PlanRow} r @param {string} print */
const printOf = (r, print) => (print.split('|').length === 5 ? legacyFingerprint(r) : fingerprint(r));

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
    return !r || r.state === 'done' || printOf(r, print) !== print;
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
      const flag = r.state === 'done' ? `DONE${r.activityId ? `, activity ${r.activityId}` : ''}` : r.status === 'skipped' ? `SKIPPED${r.skipReason ? ` (${r.skipReason})` : ''}` : r.date < today ? 'MISSED' : r.date === today ? 'TODAY' : 'planned';
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
 * @returns {{ ok: true, value: { title: string, why: string, changes: Change[], items: Item[], card: Card, warnings: string[],
 *   basis: Record<string, string> } } | { ok: false, problems: string[] }}
 */
export function checkProposalInput(input, plan, attempt) {
  const title = str(input?.title, 80);
  const why = str(input?.why, 400);
  const { changes, problems } = cleanChanges(input?.changes, plan);
  if (!title) problems.unshift('title is missing');
  const copies = problems.length ? { hard: [], soft: [] } : duplicateLiftIssues(plan.rows, changes);
  problems.push(...copies.hard);
  if (!problems.length) problems.push(...moveAsAddIssues(plan.rows, changes));
  if (problems.length) return { ok: false, problems };
  const warnings = [...newRuleIssues(plan.rows, changes, plan.today), ...fatigueIssues(plan.rows, changes, plan.today), ...copies.soft];
  if (warnings.length && attempt <= 1) {
    return {
      ok: false,
      problems: [
        ...warnings,
        "These break Paolo's rules. Fix them, or, if he asked for this on purpose, call propose_changes again with the same changes and say so in why.",
      ],
    };
  }
  return {
    ok: true,
    value: { title, why, changes, items: describeChanges(changes, plan.rows), card: cardOf(changes, plan.rows), warnings, basis: basisOf(changes, plan.rows) },
  };
}

/**
 * A card that takes a workout off the plan (skip or remove) and adds the same workout in the same week: that is a
 * move, and must be written as one, or Undo, the Lift session and the calendar event drift apart (2026-10-27: Heavy
 * barbell on Monday and Tuesday). Same workout = the same Lift template, or the same sport and title.
 * @param {PlanRow[]} rows @param {Change[]} changes
 * @returns {string[]}
 */
export function moveAsAddIssues(rows, changes) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  /** @type {string[]} */
  const out = [];
  for (const c of changes) {
    if (c.op !== 'add') continue;
    for (const o of changes) {
      if (o.op !== 'skip' && o.op !== 'remove') continue;
      const r = byId.get(o.id);
      if (!r || mondayOf(r.date) !== mondayOf(c.date)) continue;
      const sameLift = c.liftTemplate && (r.liftTemplate ?? '').toLowerCase() === c.liftTemplate.toLowerCase();
      const sameWorkout = r.sport === c.sport && plainTitle(r.title).toLowerCase() === plainTitle(c.title).toLowerCase();
      if (sameLift || sameWorkout) {
        out.push(`${o.op} of ${r.title} (${r.id}) plus an add of ${c.title} on ${dayLabel(c.date)} is a move: use { op: "move", id: "${r.id}", date: "${c.date}" } instead`);
      }
    }
  }
  return out;
}

/** A title without the emoji some planned workouts start with ("🏋️ Upper" → "Upper"). @param {string} title */
export function plainTitle(title) {
  return String(title ?? '').replace(/^[\p{Extended_Pictographic}\p{Emoji_Modifier}️‍\s]+/u, '').trim() || String(title ?? '').trim();
}

/**
 * The card as the phone draws it (lift/COACH-CHAT.md, "The change card"): the days it touches, each with its rows as
 * they will be after Apply. A row has one tag (`tone` colours it: move, new, skip). A skip or delete and an add on the
 * same day are one row, the new workout "replaces" the old.
 * @typedef {{ title: string, sport: string | null, time: string | null, meta: string, tag: string,
 *   tone: 'move' | 'new' | 'skip' }} CardRow
 * @typedef {{ date: string | null, label: string, rows: CardRow[] }} CardDay
 * @typedef {{ summary: string, days: CardDay[] }} Card
 */

/** "45 min", "1 h", "1 h 30". @param {number | null | undefined} min */
export function durationText(min) {
  if (!min) return null;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}

const weekday = (/** @type {string} */ day) => dayLabel(day).split(' ')[0];

/** "From Sat", or "From 24 Oct" when the old day is more than six days away. @param {string} from @param {string} to */
function fromTag(from, to) {
  const days = Math.abs(Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000;
  return days <= 6 ? `From ${weekday(from)}` : `From ${dayLabel(from).split(' ').slice(1).join(' ')}`;
}

/**
 * The card's days and rows (see Card).
 * @param {Change[]} changes @param {PlanRow[]} rows
 * @returns {Card}
 */
export function cardOf(changes, rows) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  /** @type {Map<string, (CardRow & { order: number })[]>} */
  const days = new Map();
  /** @type {CardRow[]} */
  const notes = [];
  const put = (/** @type {string} */ day, /** @type {CardRow} */ row, /** @type {number} */ order) => {
    if (!days.has(day)) days.set(day, []);
    days.get(day)?.push({ ...row, order });
  };
  const meta = (/** @type {(string | null | undefined)[]} */ bits) => bits.filter(Boolean).join(' · ');
  // An add takes the place of a skip or delete on its day: "Long easy hike · replaces Long ride".
  /** @type {Map<number, PlanRow>} */
  const replaces = new Map();
  const taken = new Set();
  changes.forEach((c, i) => {
    if (c.op !== 'add') return;
    const j = changes.findIndex((o, k) => !taken.has(k) && (o.op === 'skip' || o.op === 'remove') && byId.get(o.id)?.date === c.date);
    if (j < 0) return;
    const gone = byId.get(/** @type {{ id: string }} */ (changes[j]).id);
    if (!gone) return;
    taken.add(j);
    replaces.set(i, gone);
  });
  changes.forEach((c, i) => {
    if (c.op === 'remember') return notes.push({ title: c.text, sport: null, time: null, meta: 'Coach keeps this in mind', tag: 'Saved', tone: 'new' });
    if (c.op === 'add') {
      const gone = replaces.get(i);
      return put(c.date, {
        title: plainTitle(c.title), sport: c.sport, time: c.startTime,
        meta: meta([c.startTime, durationText(c.duration), gone ? `replaces ${plainTitle(gone.title)}` : null]),
        tag: 'New', tone: 'new',
      }, i);
    }
    if (taken.has(i)) return;
    const row = byId.get(c.id);
    if (!row) return;
    const title = plainTitle(row.title);
    const was = hm(row.startTime);
    switch (c.op) {
      case 'move': {
        const sameDay = c.date === row.date;
        const later = (c.startTime ?? '') > (was ?? '');
        return put(c.date, {
          title, sport: row.sport, time: c.startTime,
          meta: sameDay ? meta([`${c.startTime ?? 'no time'}, was ${was ?? 'no time'}`, durationText(row.duration)]) : meta([c.startTime, durationText(row.duration)]),
          tag: sameDay ? (later ? 'Later' : 'Earlier') : fromTag(row.date, c.date), tone: 'move',
        }, i);
      }
      case 'skip': return put(row.date, { title, sport: row.sport, time: was, meta: meta([was, durationText(row.duration)]), tag: 'Skipped', tone: 'skip' }, i);
      case 'remove': return put(row.date, { title, sport: row.sport, time: was, meta: meta([was, durationText(row.duration)]), tag: 'Deleted', tone: 'skip' }, i);
      case 'unskip': return put(row.date, { title, sport: row.sport, time: was, meta: meta([was, durationText(row.duration)]), tag: 'Back on', tone: 'new' }, i);
      default: {
        const bits = [];
        if (c.startTime !== undefined) bits.push(`${c.startTime ?? 'no time'}, was ${was ?? 'no time'}`);
        if (c.duration != null) bits.push(`${durationText(c.duration)}, was ${durationText(row.duration) ?? 'no time'}`);
        if (c.effort != null) bits.push(`${EFFORTS[/** @type {keyof typeof EFFORTS} */ (c.effort)].label}, was ${row.intensity ?? 'no effort'}`);
        if (c.title != null && c.title !== row.title) bits.push(`was ${title}`);
        if (c.description != null) bits.push('new notes');
        const time = c.startTime !== undefined ? c.startTime : was;
        return put(row.date, { title: plainTitle(c.title || row.title), sport: row.sport, time, meta: bits.join(' · '), tag: 'Changed', tone: 'move' }, i);
      }
    }
  });
  /** @type {CardDay[]} */
  const out = [...days.keys()].sort().map((date) => ({
    date,
    label: dayLabel(date),
    rows: (days.get(date) ?? [])
      .sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99') || a.order - b.order)
      .map((r) => ({ title: r.title, sport: r.sport, time: r.time, meta: r.meta, tag: r.tag, tone: r.tone })),
  }));
  if (notes.length) out.push({ date: null, label: 'Remember', rows: notes });
  const count = changes.length;
  const dated = out.filter((d) => d.date);
  const span = dated.length === 0 ? null : dated.length === 1 ? dated[0].label : `${dated[0].label} to ${dated[dated.length - 1].label}`;
  return { summary: [`${count} ${count === 1 ? 'change' : 'changes'}`, span].filter(Boolean).join(' · '), days: out };
}

/**
 * Apply's last check, on the plan as it is at the tap (not as it was when Coach wrote the card): every change is still
 * valid (no day now in the past, every workout still there and not done), no new copy of a lift, nothing that
 * breaks a rule the card didn't warn about. Returns what is wrong, in Paolo's words; empty when Apply can go.
 * @param {Change[]} changes @param {{ rows: PlanRow[], today: string }} plan @param {string[]} warned  the card's warnings
 * @returns {string[]}
 */
export function recheck(changes, { rows, today }, warned) {
  const templates = [...new Set(changes.flatMap((c) => (c.op === 'add' && c.liftTemplate ? [c.liftTemplate] : [])))];
  const raw = changes.map((c) => ({ ...c }));
  const { problems } = cleanChanges(raw, { rows, today, templates });
  if (problems.length) return problems.map((p) => p.replace(/^change \d+: /, ''));
  const copies = duplicateLiftIssues(rows, changes);
  const known = new Set(warned);
  const fresh = [...copies.hard, ...newRuleIssues(rows, changes, today), ...fatigueIssues(rows, changes, today), ...copies.soft]
    .filter((w) => !known.has(w));
  return fresh;
}

/**
 * After Apply: whether the plan now shows each change where the card said. `added[i]` is the new id of change i when
 * it is an add. Returns the changes that didn't land, in Paolo's words.
 * @param {Change[]} changes @param {(string | null)[]} added @param {PlanRow[]} rows  the plan read back after Apply
 * @returns {string[]}
 */
export function landedIssues(changes, added, rows) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  /** @type {string[]} */
  const out = [];
  changes.forEach((c, i) => {
    if (c.op === 'remember') return;
    if (c.op === 'add') {
      const r = byId.get(added[i] ?? '');
      if (!r || r.date !== c.date) out.push(`${plainTitle(c.title)} isn't on ${dayLabel(c.date)}`);
      return;
    }
    const r = byId.get(c.id);
    if (c.op === 'remove') {
      if (r) out.push(`${plainTitle(r.title)} is still in the plan`);
      return;
    }
    if (!r) return out.push('a workout the card changed is gone from the plan');
    const name = plainTitle(r.title);
    if (c.op === 'move' && (r.date !== c.date || hm(r.startTime) !== c.startTime)) out.push(`${name} isn't at ${when(c.date, c.startTime)}`);
    if (c.op === 'skip' && r.status !== 'skipped') out.push(`${name} isn't skipped`);
    if (c.op === 'unskip' && r.status === 'skipped') out.push(`${name} is still skipped`);
    if (c.op === 'update') {
      if (c.duration != null && r.duration !== c.duration) out.push(`${name} isn't ${c.duration} min`);
      if (c.startTime !== undefined && hm(r.startTime) !== c.startTime) out.push(`${name} isn't at ${c.startTime ?? 'no time'}`);
    }
  });
  return out;
}

/**
 * Which Undo steps are still safe: a step puts back a workout only while it is as Apply left it (`after`, its
 * fingerprint then). One Paolo moved, edited, did or deleted since stays as he left it. `after` null: a card applied
 * before 2026-10-29, which kept no fingerprints; every step goes.
 * @template {{ op: string, id?: string, row?: Record<string, unknown>, title?: string }} U
 * @param {U[]} steps @param {Record<string, string> | null} after @param {PlanRow[]} rows  the plan now
 * @returns {{ run: U[], kept: string[] }}  kept: the titles Undo leaves alone
 */
export function undoPlan(steps, after, rows) {
  if (!after) return { run: steps, kept: [] };
  const byId = new Map(rows.map((r) => [r.id, r]));
  /** @type {U[]} */
  const run = [];
  /** @type {string[]} */
  const kept = [];
  for (const s of steps) {
    if (s.op === 'forget') { run.push(s); continue; }
    if (s.op === 'restore') {
      // A deleted workout comes back unless something took its id since (it never does).
      if (!byId.has(String(s.row?.id ?? ''))) run.push(s);
      continue;
    }
    const r = byId.get(String(s.id ?? ''));
    const print = after[String(s.id ?? '')];
    if (r && r.state !== 'done' && print && printOf(r, print) === print) run.push(s);
    else kept.push(plainTitle(r?.title ?? s.title ?? 'A workout'));
  }
  return { run, kept };
}
