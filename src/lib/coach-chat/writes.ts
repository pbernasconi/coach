/**
 * The Coach tab's plan writes (lift/COACH-CHAT.md): a proposal's changes through the plan's own writes (the Week
 * tab's and the Edit sheet's), and their Undo. No Next.js here, so the integration test runs it on a real Postgres;
 * server.ts pushes the calendar after.
 */

import { sql } from '@/db';
import { addInput, editForm, editInput } from '@/lib/plan/app-edit.mjs';
import { loadPlanWorkout } from '@/lib/plan/app-workout';
import { cleanNewWorkout, withImpliedSteps } from '@/lib/plan/create.mjs';
import { createWorkout, loadRange, removeWorkout, restoreWorkout, updateWorkout, type WorkoutInput } from '@/lib/plan/month';
import { planSource, withPlanSource } from '@/lib/plan/change-source.mjs';
import { setDone, setSkipped } from '@/lib/plan/queries';
import { loadFeedback, saveFeedback } from '@/lib/plan/feedback';
import { addDays, matchActivityId, mondayOf, NO_ACTIVITY } from '@/lib/plan/week.mjs';
import { addNote, dropNote, type Change, type PlanActivity, type PlanRow } from './changes.mjs';
import { applyTemplateChange, undoTemplateChange } from './lift-tools';
import { applyEventChange, applyGoalChange, startWeekDraft, undoGoalStep, type GoalUndo } from './goal-tools';
import { goalTitle, weekLabel } from './goal-tools.mjs';
import { applyReminder, undoReminder } from './reminders';

/**
 * The workouts Coach sees: last week, this week and the next two, as the web calendar has them (loadRange), and the
 * activities recorded in them (a wrong match from last week can still be put right).
 */
export async function planView(userId: string, today: string): Promise<{ rows: PlanRow[]; activities: PlanActivity[] }> {
  const monday = mondayOf(today);
  return planViewBetween(userId, today, addDays(monday, -7), addDays(monday, 20));
}

/** The workouts Coach sees (planView's rows). */
export async function planRows(userId: string, today: string): Promise<PlanRow[]> {
  return (await planView(userId, today)).rows;
}

/** The workouts from `from` to `to` (whole weeks are read, then cut to the days), for get_plan. */
export async function planRowsBetween(userId: string, today: string, from: string, to: string): Promise<PlanRow[]> {
  return (await planViewBetween(userId, today, from, to)).rows;
}

async function planViewBetween(userId: string, today: string, from: string, to: string): Promise<{ rows: PlanRow[]; activities: PlanActivity[] }> {
  const [range, lifts] = await Promise.all([
    loadRange(userId, mondayOf(from), mondayOf(to), today),
    sql`
      SELECT a.id, a.lift_template FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
      WHERE p.user_id = ${userId} AND a.lift_template IS NOT NULL
        AND a.scheduled_date >= ${from} AND a.scheduled_date <= ${to}` as unknown as Promise<{ id: string; lift_template: string }[]>,
  ]);
  const template = new Map(lifts.map((r) => [String(r.id), r.lift_template]));
  const rows: PlanRow[] = range.workouts.filter((w) => w.date >= from && w.date <= to).map((w) => ({
    id: String(w.id), date: w.date, startTime: w.startTime, title: w.title, sport: w.sport, workoutType: w.workoutType,
    intensity: w.intensity, duration: w.duration, description: w.description, status: w.status, skipReason: w.skipReason,
    state: w.state, liftTemplate: template.get(String(w.id)) ?? null,
    activityId: w.state === 'done' ? matchActivityId(w.match) : null,
    ...(w.match?.pinned ? { pinned: true } : {}),
  }));
  const owner = new Map(range.workouts.flatMap((w) => {
    const id = matchActivityId(w.match);
    return id ? [[id, String(w.id)] as const] : [];
  }));
  const activities: PlanActivity[] = range.activities.filter((a) => a.date >= from && a.date <= to).map((a) => ({
    id: String(a.id), date: a.date, sport: a.sport, name: a.name, min: a.min || null, km: a.km || null, workoutId: owner.get(String(a.id)) ?? null,
  }));
  return { rows, activities };
}

/** A workout's hand-set recording (matched_activity_id) and status, for a link's Undo. */
type MatchState = { id: string; matched: string | null; status: string; skipReason: string | null };

async function matchStates(userId: string, where: { ids?: string[]; activity?: string }): Promise<MatchState[]> {
  const rows = (await sql`
    SELECT a.id, a.matched_activity_id, a.status, a.skip_reason
    FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
    WHERE p.user_id = ${userId}
      AND (a.id = ANY(${where.ids ?? []}::text[]) OR (${where.activity ?? null}::text IS NOT NULL AND a.matched_activity_id = ${where.activity ?? null}))`) as Record<string, unknown>[];
  return rows.map((r) => ({ id: String(r.id), matched: (r.matched_activity_id as string) ?? null, status: String(r.status), skipReason: (r.skip_reason as string) ?? null }));
}

async function putMatch(id: string, m: Partial<Omit<MatchState, 'id'>>) {
  const [r] = (await sql`
    UPDATE training_plan_activities SET
      matched_activity_id = CASE WHEN ${'matched' in m} THEN ${m.matched ?? null}::text ELSE matched_activity_id END,
      status = COALESCE(${m.status ?? null}::text, status),
      skip_reason = CASE WHEN ${m.status != null} THEN ${m.skipReason ?? null}::text ELSE skip_reason END,
      change_source = ${planSource()}, updated_at = NOW()
    WHERE id = ${id} RETURNING id`) as Record<string, unknown>[];
  if (!r) throw new Error('workout not found');
}

/**
 * Which recording counts for a workout (a link, unlink or done change). Returns the Undo: every touched workout's
 * hand-set recording and status as they were.
 */
async function applyMatch(userId: string, c: Extract<Change, { op: 'link' | 'unlink' | 'done' }>): Promise<MatchState[]> {
  if (c.op === 'done') {
    const before = await matchStates(userId, { ids: [c.id] });
    if (!before.length) throw new Error('workout not found');
    await setDone(userId, c.id, true);
    return before;
  }
  if (c.op === 'unlink') {
    const before = await matchStates(userId, { ids: [c.id] });
    if (!before.length) throw new Error('workout not found');
    await putMatch(c.id, { matched: NO_ACTIVITY });
    return before;
  }
  // A link: the workout takes the activity (a skipped one comes back), and any other workout pinned to it lets go.
  const before = await matchStates(userId, { ids: [c.id], activity: c.activity });
  const me = before.find((b) => b.id === c.id);
  if (!me) throw new Error('workout not found');
  for (const o of before) if (o.id !== c.id) await putMatch(o.id, { matched: null });
  await putMatch(c.id, me.status === 'skipped' ? { matched: c.activity, status: 'planned', skipReason: null } : { matched: c.activity });
  return before;
}

/** One step that puts a change back. `title` names the workout to Paolo when the step can't run. */
export type Undo = (
  | { op: 'edit'; id: string; body: Record<string, unknown> }
  | { op: 'skip'; id: string; reason: string | null }
  | { op: 'unskip'; id: string }
  | { op: 'remove'; id: string }
  | { op: 'restore'; row: Record<string, unknown> }
  | { op: 'forget'; text: string }
  | { op: 'template'; slotId: string; before: Record<string, unknown> | null }
  | GoalUndo
  | { op: 'unremind'; id: string }
  | { op: 'match'; before: MatchState[] }
  | { op: 'feel'; item: string; date: string; was: { feel: number | null; rpe: number | null; comment: string | null } }
) & { title?: string };

/**
 * The Edit sheet's write (PUT /api/app/plan/{id}): the workout's form, with `patch` on top, through the same checks.
 * Returns the days it touched and the form fields to put back on Undo.
 */
async function editWorkout(userId: string, id: string, patch: Record<string, unknown>, today: string) {
  const w = await loadPlanWorkout(userId, id, today);
  if (!w) throw new Error('workout not found');
  if (w.state === 'done') throw new Error('a done workout stays as it is');
  const form = editForm(w as never);
  const input = editInput({ ...form, ...patch }, w as never);
  if ('error' in input) throw new Error(input.error);
  const clean = cleanNewWorkout(input.value as never) as { value?: WorkoutInput; error?: string };
  if (!clean.value) throw new Error(clean.error ?? 'the workout is not valid');
  // The columns the Edit sheet's form can't hold exactly (no effort reads as Easy; bank steps, TSS), for Undo.
  const [raw] = (await sql`
    SELECT intensity, tss, workout_type, steps, distance FROM training_plan_activities WHERE id = ${id}`) as Record<string, unknown>[];
  const moved = await updateWorkout(userId, id, clean.value);
  if (!moved) throw new Error('workout not found');
  const back = {
    date: form.date, startTime: form.startTime, title: form.title, duration: form.duration, effort: form.effort, description: form.description,
    raw: raw ?? null,
  };
  return { dates: [moved.from, moved.to], back };
}

/** Undo of an edit: the form fields through the Edit sheet's write, then the raw columns exactly as they were. */
async function putBack(userId: string, id: string, body: Record<string, unknown>, today: string) {
  const { raw, ...form } = body as Record<string, unknown> & { raw?: Record<string, unknown> | null };
  const e = await editWorkout(userId, id, form, today);
  if (raw) {
    await sql`
      UPDATE training_plan_activities SET
        intensity = ${raw.intensity ?? null}, tss = ${raw.tss ?? null}, workout_type = ${raw.workout_type ?? null},
        steps = ${raw.steps == null ? null : JSON.stringify(raw.steps)}::jsonb, distance = ${raw.distance ?? null},
        change_source = ${planSource()}, updated_at = NOW()
      WHERE id = ${id}`;
  }
  return e.dates;
}

/** Settings → Coaching preferences (users.settings.coachingNotes), changed in place: the planner reads it next time. */
async function editNotes(userId: string, edit: (notes: string) => string) {
  const [u] = (await sql`SELECT settings ->> 'coachingNotes' AS notes FROM users WHERE id = ${userId}`) as { notes: string | null }[];
  if (!u) throw new Error('user not found');
  const notes = edit(String(u.notes ?? ''));
  await sql`
    UPDATE users SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{coachingNotes}', to_jsonb(${notes}::text)), updated_at = NOW()
    WHERE id = ${userId}`;
}

async function applyOne(userId: string, c: Change, rows: PlanRow[], today: string): Promise<{ undo: Undo; dates: string[] }> {
  const done = await applyStep(userId, c, rows, today);
  const title =
    c.op === 'add' ? c.title
      : c.op === 'remember' ? 'Coaching preference'
        : c.op === 'template' ? `${c.exercise} in ${c.template}`
          : c.op === 'event' ? (c.event ?? c.was)?.name
            : c.op === 'goal' ? goalTitle(c)
              : c.op === 'plan_week' ? weekLabel(String(c.request.weekStart))
                : c.op === 'reminder' ? `Reminder: ${c.text}`
                : rows.find((r) => r.id === c.id)?.title;
  return { ...done, undo: { ...done.undo, title } };
}

async function applyStep(userId: string, c: Change, rows: PlanRow[], today: string): Promise<{ undo: Undo; dates: string[] }> {
  if (c.op === 'remember') {
    await editNotes(userId, (n) => addNote(n, c.text));
    return { undo: { op: 'forget', text: c.text }, dates: [] };
  }
  if (c.op === 'template') {
    const done = await applyTemplateChange(c);
    return { undo: { op: 'template', slotId: done.slotId, before: done.before }, dates: [] };
  }
  if (c.op === 'event') return { undo: await applyEventChange(userId, c), dates: [] };
  if (c.op === 'goal') return { undo: await applyGoalChange(userId, c), dates: [] };
  if (c.op === 'plan_week') return { undo: await startWeekDraft(userId, c, today), dates: [] };
  if (c.op === 'reminder') return { undo: await applyReminder(userId, c), dates: [] };
  if (c.op === 'add') {
    const input = addInput({ sport: c.sport, date: c.date, startTime: c.startTime, title: c.title, duration: c.duration, effort: c.effort, description: c.description });
    if ('error' in input) throw new Error(input.error);
    const clean = cleanNewWorkout(input.value as never) as { value?: WorkoutInput; error?: string };
    if (!clean.value) throw new Error(clean.error ?? 'the workout is not valid');
    // A run or ride is always a structured workout (Zwift, Garmin, the TSS): the bank workout its title implies.
    const value = withImpliedSteps({ ...clean.value, workoutType: c.workoutType ?? clean.value.workoutType });
    const id = await createWorkout(userId, value);
    // A gym lift names its Lift template, as the planner's do: Lift then plans its exercises and sets (lift-plan.mjs).
    if (c.liftTemplate) await sql`UPDATE training_plan_activities SET lift_template = ${c.liftTemplate}, change_source = ${planSource()} WHERE id = ${id}`;
    return { undo: { op: 'remove', id }, dates: [c.date] };
  }
  const row = rows.find((r) => r.id === c.id);
  if (!row) throw new Error('workout not found');
  if (c.op === 'feel') {
    // Saved on the item that already holds his feel for this workout (the phone and the web do the same), with the
    // fields Coach didn't name kept.
    const old = await loadFeedback(userId, [c.item], c.id);
    const item = old?.item ?? c.item;
    await saveFeedback(userId, {
      item, date: c.date, feel: c.feel ?? old?.feel ?? null, rpe: c.rpe ?? old?.rpe ?? null, comment: c.comment ?? old?.comment ?? null,
      title: row.title, planActivityId: c.id,
    });
    return { undo: { op: 'feel', item, date: c.date, was: { feel: old?.feel ?? null, rpe: old?.rpe ?? null, comment: old?.comment ?? null } }, dates: [] };
  }
  if (c.op === 'link' || c.op === 'unlink' || c.op === 'done') {
    const before = await applyMatch(userId, c);
    return { undo: { op: 'match', before }, dates: [row.date] };
  }
  switch (c.op) {
    case 'move': {
      const e = await editWorkout(userId, c.id, { date: c.date, startTime: c.startTime }, today);
      return { undo: { op: 'edit', id: c.id, body: e.back }, dates: e.dates };
    }
    case 'update': {
      const patch: Record<string, unknown> = {};
      for (const k of ['title', 'duration', 'effort', 'description', 'startTime'] as const) if (k in c) patch[k] = c[k];
      const e = await editWorkout(userId, c.id, patch, today);
      return { undo: { op: 'edit', id: c.id, body: e.back }, dates: e.dates };
    }
    case 'skip':
      // No `today`: a chat skip changes only what the card shows (setSkipped would also ease the next sessions). The
      // card eases them itself: checkProposalInput sends a tired skip back until it does (fatigueIssues).
      await setSkipped(userId, c.id, true, c.reason);
      return { undo: { op: 'unskip', id: c.id }, dates: [row.date] };
    case 'unskip':
      await setSkipped(userId, c.id, false);
      return { undo: { op: 'skip', id: c.id, reason: row.skipReason ?? null }, dates: [row.date] };
    case 'remove': {
      const gone = await removeWorkout(userId, c.id);
      if (!gone) throw new Error('workout not found');
      return { undo: { op: 'restore', row: gone.row }, dates: [gone.date] };
    }
  }
}

async function undoOne(userId: string, u: Undo, today: string): Promise<string[]> {
  switch (u.op) {
    case 'edit': return putBack(userId, u.id, u.body, today);
    case 'skip': await setSkipped(userId, u.id, true, u.reason); return [];
    case 'unskip': await setSkipped(userId, u.id, false); return [];
    case 'remove': { const gone = await removeWorkout(userId, u.id); return gone ? [gone.date] : []; }
    case 'restore': { const day = await restoreWorkout(userId, u.row); return day ? [day] : []; }
    case 'forget': await editNotes(userId, (n) => dropNote(n, u.text)); return [];
    case 'template': await undoTemplateChange(u.slotId, u.before); return [];
    case 'event': case 'goal': case 'plan_week': await undoGoalStep(userId, u); return [];
    case 'unremind': await undoReminder(userId, u.id); return [];
    case 'feel': {
      await saveFeedback(userId, { item: u.item, date: u.date, ...u.was, title: u.title ?? null, planActivityId: null });
      return [];
    }
    case 'match': {
      for (const b of u.before) await putMatch(b.id, { matched: b.matched, status: b.status, skipReason: b.skipReason });
      return [];
    }
  }
}

/**
 * A write failed: the ones before it were put back. `dates` are the days touched, for the calendar push; `stuck` the
 * workouts whose put-back failed too, so the card can name them instead of saying nothing changed.
 */
export class ApplyError extends Error {
  constructor(message: string, readonly dates: string[], readonly stuck: string[] = []) {
    super(message);
  }
}

/** What Apply did: the Undo steps, the days touched, and the new workout's id for each add (null for other changes). */
export type Applied = { undo: Undo[]; dates: string[]; added: (string | null)[] };

/** Runs the changes in order. A write that fails puts back the ones before it and throws ApplyError. */
export function applyAll(userId: string, ops: Change[], rows: PlanRow[], today: string): Promise<Applied> {
  return withPlanSource('chat', () => applyInOrder(userId, ops, rows, today));
}

async function applyInOrder(userId: string, ops: Change[], rows: PlanRow[], today: string): Promise<Applied> {
  const undo: Undo[] = [];
  const dates: string[] = [];
  const added: (string | null)[] = [];
  try {
    for (const c of ops) {
      const done = await applyOne(userId, c, rows, today);
      undo.push(done.undo);
      dates.push(...done.dates);
      added.push(c.op === 'add' && done.undo.op === 'remove' ? done.undo.id : null);
    }
  } catch (error) {
    const back = await undoSteps(userId, undo, today);
    throw new ApplyError(error instanceof Error ? error.message : 'a change failed', [...dates, ...back.dates], back.failed);
  }
  return { undo, dates, added };
}

/** Runs Undo steps, last first; a step that fails doesn't stop the rest. Returns the days touched and the failed titles. */
async function undoSteps(userId: string, undo: Undo[], today: string): Promise<{ dates: string[]; failed: string[] }> {
  const dates: string[] = [];
  const failed: string[] = [];
  for (const u of [...undo].reverse()) {
    try {
      dates.push(...(await undoOne(userId, u, today)));
    } catch (error) {
      console.error('Coach undo step failed:', u.op, error instanceof Error ? error.message : error);
      failed.push(u.title ?? 'A workout');
    }
  }
  return { dates, failed };
}

/** Puts back what applyAll changed, last change first. Returns the days touched and the workouts it couldn't put back. */
export function undoAll(userId: string, undo: Undo[], today: string): Promise<{ dates: string[]; failed: string[] }> {
  return withPlanSource('chat', () => undoSteps(userId, undo, today));
}
