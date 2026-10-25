// @ts-check
// Paolo's planning rules as code (src/lib/planner/prompts/coaching.md, plan-structure.md): the checks a plan should pass
// before he sees it. They report and never change the plan; the import's own fixes (stackDays) come after, so a
// score is the planner's first draft. The planner checks each draft with them (run.ts checkDraft), submitPlan stores them
// with each proposal, and the review shows them. Pure, so node --test can run it.
//
// The plan of record: /mnt/project-files/planning/2026-10-25-server-planner-plan.md (Phase 1).

import { addDays, isHard, sportOf } from './week.mjs';
import { blockWeek } from './consistency.mjs';

/** A gap this short between two sessions still makes one block (the same 15 min as day-blocks.mjs). */
export const GAP_MIN = 15;
export const LONG_RUN_MIN = 90;
export const FLOOR_LONG_RUN_MIN = 75;

/** What each rule checks, in Paolo's words, for the review and the baseline. */
export const RULES = {
  R1: 'One session a day, or one stacked block',
  R2: 'No run after a lift',
  R3: 'No heavy lift on a quality day',
  R4: '2 lifts a week (1 is the floor), not on back-to-back days',
  R5: 'No back-to-back hard days',
  R6: 'A long run each week (90 min or more)',
  R7: 'Days off stay empty, and nothing on top of a meeting',
  R8: 'Within the hours he has',
  R9: 'Physio for the Achilles and knee: 2 a week (1 on a floor week)',
  R17: 'A check-in leaves past days as they were',
};

/**
 * One planned session, from a plan JSON event or a training_plan_activities row.
 * @typedef {{ day: string, start: number | null, end: number | null, title: string, sport: string,
 *   workoutType: string | null, liftTemplate: string | null, intensity: string | null, minutes: number }} Session
 */

/**
 * @typedef {{ id: keyof typeof RULES, level: 'fail' | 'warn', day: string | null, message: string }} Issue
 */

/** @param {unknown} s "YYYY-MM-DDTHH:MM…" → minutes since midnight, or null for a day without a time */
function clock(s) {
  const m = /T(\d{2}):(\d{2})/.exec(String(s ?? ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** @param {number} min */
function hhmm(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/**
 * The sport of a planned session: its workoutType first ("🏃 Easy run to the gym" is a run, not a lift), then the
 * words of its title (sportOf).
 * @param {any} e
 */
export function sportOfSession(e) {
  const t = String(e?.workoutType ?? '');
  if (/^run-|-run$/.test(t)) return 'run';
  if (/^ride-|-ride$|-bike$/.test(t)) return 'ride';
  if (/^strength/.test(t)) return 'strength';
  return sportOf(e ?? {});
}

/**
 * The sessions of a plan JSON (plans/<weekStart>.json, the Step 6 format): its events as written, before the
 * import's fixes. Rest days are not sessions.
 * @param {any} plan
 * @returns {Session[]}
 */
export function sessionsFromPlan(plan) {
  const events = Array.isArray(plan?.events) ? plan.events : [];
  return events
    .map((/** @type {any} */ e) => {
      const day = String(e?.start ?? '').slice(0, 10);
      const start = clock(e?.start);
      const sameDayEnd = String(e?.end ?? '').slice(0, 10) === day ? clock(e?.end) : null;
      const end = start != null && sameDayEnd != null && sameDayEnd > start ? sameDayEnd : null;
      return {
        day,
        start,
        end,
        title: String(e?.title ?? ''),
        sport: sportOfSession(e),
        workoutType: e?.workoutType ?? null,
        liftTemplate: e?.liftTemplate ?? null,
        intensity: e?.intensity ?? null,
        minutes: start != null && end != null ? end - start : 0,
      };
    })
    .filter((/** @type {Session} */ s) => s.sport !== 'rest');
}

/**
 * The sessions of a week in Coach (training_plan_activities rows, as the week loaders read them).
 * @param {Array<Record<string, any>>} rows  { scheduled_date | date, start_time, end_time, duration, title,
 *   activity_type, workout_type, lift_template, intensity }
 * @returns {Session[]}
 */
export function sessionsFromRows(rows) {
  return rows
    .map((r) => {
      const day = String(r.date ?? r.scheduled_date ?? '').slice(0, 10);
      const start = clock(`T${r.start_time ?? r.startTime ?? ''}`);
      const endRaw = clock(`T${r.end_time ?? r.endTime ?? ''}`);
      const minutes = Number(r.duration) || (start != null && endRaw != null && endRaw > start ? endRaw - start : 0);
      const end = start != null ? (endRaw != null && endRaw > start ? endRaw : minutes ? start + minutes : null) : null;
      const w = { title: r.title, workoutType: r.workout_type ?? r.workoutType };
      return {
        day,
        start,
        end,
        title: String(r.title ?? ''),
        sport: w.workoutType ? sportOfSession(w) : r.activity_type ?? r.activityType ?? sportOf(w),
        workoutType: r.workout_type ?? r.workoutType ?? null,
        liftTemplate: r.lift_template ?? r.liftTemplate ?? null,
        intensity: r.intensity ?? null,
        minutes,
      };
    })
    .filter((s) => s.sport !== 'rest');
}

/** Sessions that take a slot in the day. A walk, yoga or mobility can sit apart from the training block. */
const BLOCK_SPORTS = new Set(['run', 'ride', 'strength', 'swim', 'hike', 'other']);

/** A lift in Lift (a gym or dumbbell session), not a home mini session. @param {Session} s */
export function isLift(s) {
  if (s.sport !== 'strength') return false;
  if (s.workoutType === 'strength-home') return false;
  return Boolean(s.liftTemplate) || /^strength-(heavy|dumbbell|upper)/.test(s.workoutType ?? '') || s.workoutType === 'strength';
}

/** The heavy barbell lift. @param {Session} s */
export function isHeavyLift(s) {
  return s.sport === 'strength' && (s.workoutType === 'strength-heavy' || /heavy barbell/i.test(s.liftTemplate ?? s.title));
}

/** A quality endurance session: intervals, threshold, tempo, VO2, a test or a race. @param {Session} s */
export function isQuality(s) {
  if (s.sport === 'strength' || s.sport === 'yoga' || s.sport === 'walk') return false;
  // A recovery or easy session whose note says "intervals" (strides) is not quality.
  if (/^(run|ride)-(easy|z2|long)$|^recovery$/.test(s.workoutType ?? '')) return false;
  return isHard({ workoutType: s.workoutType ?? '', title: s.title, intensity: s.intensity });
}

/** A physio session (plan-structure.md "Physio": "🩹 Physio A — Achilles & calf"). @param {{ title?: string }} s */
export function isPhysio(s) {
  return /\bphysio/i.test(String(s?.title ?? ''));
}

/** @param {Session} s */
function isLongRun(s) {
  return s.sport === 'run' && (s.workoutType === 'run-long' || s.minutes >= LONG_RUN_MIN);
}

/**
 * A calendar time as the wall clock in a zone.
 * @param {string} iso @param {string} tz
 * @returns {{ day: string, min: number } | null}
 */
function wall(iso, tz) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .formatToParts(new Date(t))
        .map((p) => [p.type, p.value]),
    );
    return { day: `${parts.year}-${parts.month}-${parts.day}`, min: Number(parts.hour) * 60 + Number(parts.minute) };
  } catch {
    return null;
  }
}

/**
 * The meetings of the week from the profile (profile.json calendarByWeek): timed events that are not Coach's own
 * workout events or invites he declined, as wall-clock times on their day.
 * @param {any} context @param {string} weekStart
 * @returns {Array<{ day: string, start: number, end: number }>}
 */
export function meetingsOf(context, weekStart) {
  const week = (context?.calendarByWeek ?? []).find((/** @type {any} */ w) => w?.weekStart === weekStart);
  /** @type {Array<{ day: string, start: number, end: number }>} */
  const out = [];
  for (const e of week?.events ?? []) {
    if (!e || e.allDay || e.coach || e.declined) continue;
    const tz = typeof e.tz === 'string' && e.tz ? e.tz : 'America/Los_Angeles';
    const a = wall(e.start, tz);
    const b = wall(e.end, tz);
    if (!a || !b) continue;
    const end = b.day === a.day ? b.min : 24 * 60;
    if (end > a.min) out.push({ day: a.day, start: a.min, end });
  }
  return out;
}

/** "Mon 27 Oct" for a message. @param {string} day */
function label(day) {
  const d = new Date(`${day}T12:00:00Z`);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/**
 * Checks a week's sessions against the rules. Every input but the sessions is optional: a rule that needs data the
 * caller doesn't have (the request, the profile) is skipped.
 * @param {Session[]} sessions
 * @param {{ weekStart: string, request?: any, context?: any, completed?: any[], today?: string | null, floor?: boolean }} opts
 *   `completed`: the plan's completed[] (check-ins: sessions already done this week); `today`: the check-in's day;
 *   `floor`: the plan calls itself a floor week
 * @returns {Issue[]}
 */
export function checkRules(sessions, { weekStart, request = null, context = null, completed = [], today = null, floor = false }) {
  /** @type {Issue[]} */
  const issues = [];
  const add = (/** @type {Issue['id']} */ id, /** @type {Issue['level']} */ level, /** @type {string | null} */ day, /** @type {string} */ message) =>
    issues.push({ id, level, day, message });
  const days = [...Array(7)].map((_, i) => addDays(weekStart, i));
  const byDay = new Map(days.map((d) => [d, sessions.filter((s) => s.day === d)]));
  const done = (completed ?? []).map((c) => ({ day: String(c?.day ?? ''), text: String(c?.session ?? '') }));
  const doneLift = done.filter((c) => /🏋|lift|strength|barbell|dumbbell|gym/i.test(c.text));
  const doneRuns = done.filter((c) => /🏃|\brun\b/i.test(c.text));
  // A floor week (the plan says so) or the block's lighter week 4: one lift and a 75-minute long run are enough.
  const floorWeek = floor || blockWeek(weekStart) === 4;

  for (const day of days) {
    const list = byDay.get(day) ?? [];
    // R1: one session or one block. Two timed sessions with more than 15 minutes between them are two sessions.
    const timed = list.filter((s) => BLOCK_SPORTS.has(s.sport) && s.start != null).sort((a, b) => Number(a.start) - Number(b.start));
    for (let i = 1; i < timed.length; i++) {
      const prev = timed[i - 1];
      const cur = timed[i];
      const prevEnd = prev.end ?? Number(prev.start) + prev.minutes;
      const gap = Number(cur.start) - prevEnd;
      if (gap > GAP_MIN) {
        add('R1', 'fail', day, `${label(day)}: ${cur.title} starts ${Math.round(gap / 6) / 10} h after ${prev.title} ends. Stack them into one block or move one.`);
      } else if (gap < 0) {
        add('R1', 'warn', day, `${label(day)}: ${cur.title} overlaps ${prev.title}.`);
      }
    }
    // R2: never a run after a lift.
    const lifts = list.filter((s) => s.sport === 'strength' && s.start != null);
    for (const run of list.filter((s) => s.sport === 'run' && s.start != null)) {
      const lift = lifts.find((l) => Number(l.start) <= Number(run.start));
      if (lift) add('R2', 'fail', day, `${label(day)}: ${run.title} comes after ${lift.title}. Run first, then lift.`);
    }
    // R3: never a heavy lift on the day of a workout.
    const heavy = list.find(isHeavyLift);
    const quality = list.find(isQuality);
    if (heavy && quality) add('R3', 'fail', day, `${label(day)}: ${heavy.title} is on the same day as ${quality.title}. Put the heavy lift on an aerobic day.`);
  }

  // R4: 2 lifts, 1 is the floor, never on back-to-back days. A check-in counts the lifts already done.
  const liftDays = [...new Set([...sessions.filter(isLift).map((s) => s.day), ...doneLift.map((c) => c.day)])].sort();
  const want = typeof request?.gym === 'number' ? request.gym : null;
  if (want != null) {
    if (liftDays.length < want) add('R4', 'warn', null, `${liftDays.length} lift${liftDays.length === 1 ? '' : 's'} planned; he asked for ${want}.`);
  } else if (liftDays.length === 0) {
    add('R4', 'fail', null, 'No lift this week. One is the floor.');
  } else if (liftDays.length === 1 && !floorWeek) {
    add('R4', 'warn', null, 'Only 1 lift this week; 2 is the target.');
  }
  for (let i = 1; i < liftDays.length; i++) {
    if (addDays(liftDays[i - 1], 1) === liftDays[i]) add('R4', 'fail', liftDays[i], `${label(liftDays[i - 1])} and ${label(liftDays[i])}: lifts on back-to-back days. Leave a day between them.`);
  }
  // Never miss twice: when the last lift was 6+ days ago, the first lift goes in the first 2 days of the week.
  const firstDays = new Set([weekStart, addDays(weekStart, 1)]);
  if (context?.consistency?.lifts?.liftFirst && liftDays.length && !liftDays.some((d) => firstDays.has(d)) && (!today || today <= addDays(weekStart, 1))) {
    add('R4', 'warn', liftDays[0], `Never miss twice: the last lift was ${context.consistency.lifts.daysSince ?? 'many'} days ago, so the first lift goes Monday or Tuesday, not ${label(liftDays[0])}.`);
  }

  // R5: no back-to-back hard days.
  for (let i = 1; i < days.length; i++) {
    const a = (byDay.get(days[i - 1]) ?? []).find(isQuality);
    const b = (byDay.get(days[i]) ?? []).find(isQuality);
    if (a && b) add('R5', 'fail', days[i], `${label(days[i - 1])} and ${label(days[i])}: two hard days in a row (${a.title}, ${b.title}).`);
  }

  // R6: a long run, 90+ min (75–90 is fine on a floor or lighter week). A check-in counts a run already done.
  const longest = Math.max(0, ...sessions.filter((s) => s.sport === 'run').map((s) => (s.workoutType === 'run-long' ? Math.max(s.minutes, LONG_RUN_MIN) : s.minutes)));
  const shortWeek = typeof request?.hours === 'number' && request.hours <= 4;
  if (!sessions.some(isLongRun) && !doneRuns.length) {
    if (longest >= FLOOR_LONG_RUN_MIN) {
      if (!floorWeek) add('R6', 'warn', null, `The longest run is ${longest} min; the long run is 90 min or more on a full week.`);
    } else {
      add('R6', shortWeek || floorWeek ? 'warn' : 'fail', null, longest ? `No long run: the longest run is ${longest} min.` : 'No long run this week.');
    }
  }

  // R7: days off stay empty; nothing on top of a meeting.
  for (const off of Array.isArray(request?.daysOff) ? request.daysOff : []) {
    for (const s of byDay.get(off) ?? []) {
      if (s.sport !== 'walk') add('R7', 'fail', off, `${label(off)} is a day off, but ${s.title} is on it.`);
    }
  }
  if (context) {
    const meetings = meetingsOf(context, weekStart);
    for (const s of sessions) {
      if (s.start == null || s.end == null || !BLOCK_SPORTS.has(s.sport)) continue;
      const clash = meetings.find((m) => m.day === s.day && m.start < Number(s.end) && Number(s.start) < m.end);
      if (clash) add('R7', 'warn', s.day, `${label(s.day)}: ${s.title} (${hhmm(Number(s.start))}) overlaps a calendar event at ${hhmm(clash.start)}.`);
    }
  }

  // R8: within the hours he has.
  if (typeof request?.hours === 'number') {
    const total = sessions.reduce((n, s) => n + s.minutes, 0);
    if (total > request.hours * 60 * 1.05) add('R8', 'fail', null, `${Math.round(total / 6) / 10} h planned; he has ${request.hours} h.`);
  }

  // R9: physio every week, 2 on a full week and 1 on a floor or lighter week, 48 h apart. A check-in counts one done.
  const physioDays = [...new Set([...sessions.filter(isPhysio).map((s) => s.day), ...done.filter((c) => /physio/i.test(c.text)).map((c) => c.day)])].sort();
  const physioWant = floorWeek || shortWeek ? 1 : 2;
  if (physioDays.length < physioWant) {
    add('R9', 'warn', null, physioDays.length
      ? `1 physio session; a full week has 2 (Physio A and B, plan-structure.md "Physio").`
      : 'No physio this week: plan Physio A (and B on a full week) on a rest or easy day.');
  }
  for (let i = 1; i < physioDays.length; i++) {
    if (addDays(physioDays[i - 1], 1) === physioDays[i]) add('R9', 'warn', physioDays[i], `${label(physioDays[i - 1])} and ${label(physioDays[i])}: physio on back-to-back days. Leave 48 h between them.`);
  }
  for (const s of sessions.filter(isPhysio)) {
    if (sessions.some((l) => l.day === s.day && isLift(l))) add('R9', 'warn', s.day, `${label(s.day)}: ${s.title} is on a lift day. Put it on a rest or easy day.`);
  }

  // R17: a check-in plans only today and the days after it (done sessions go in completed[]).
  if (request?.kind === 'checkin' && today) {
    for (const s of sessions) {
      if (s.day < today) add('R17', 'fail', s.day, `${label(s.day)} is in the past, but the check-in planned ${s.title} on it.`);
    }
  }
  return issues;
}

/**
 * The rule results stored with a proposal (plan_proposals.checks) and shown in the review.
 * @param {any} plan @param {{ weekStart: string, request?: any, context?: any, today?: string | null }} opts
 */
export function checkProposal(plan, opts) {
  const words = JSON.stringify([plan?.title, plan?.context, plan?.philosophy]);
  const issues = checkRules(sessionsFromPlan(plan), {
    ...opts,
    completed: Array.isArray(plan?.completed) ? plan.completed : [],
    floor: /floor week/i.test(words),
  });
  return {
    version: 1,
    issues,
    fails: issues.filter((i) => i.level === 'fail').length,
    warns: issues.filter((i) => i.level === 'warn').length,
  };
}

/** The check-in's day: the day the profile was made, in its home zone. @param {any} context */
export function todayOf(context) {
  const at = context?.generatedAt;
  if (!at) return null;
  return wall(at, context?.home?.tz ?? 'America/Los_Angeles')?.day ?? null;
}
