/**
 * The Coach tab's plan writes (lift/COACH-CHAT.md): a proposal's changes through the plan's own writes (the Week
 * tab's and the Edit sheet's), and their Undo. No Next.js here, so the integration test runs it on a real Postgres;
 * server.ts pushes the calendar after.
 */

import { sql } from '@/db';
import { addInput, editForm, editInput } from '@/lib/plan/app-edit.mjs';
import { loadPlanWorkout } from '@/lib/plan/app-workout';
import { cleanNewWorkout } from '@/lib/plan/create.mjs';
import { createWorkout, loadRange, removeWorkout, restoreWorkout, updateWorkout, type WorkoutInput } from '@/lib/plan/month';
import { setSkipped } from '@/lib/plan/queries';
import { addDays, mondayOf } from '@/lib/plan/week.mjs';
import { addNote, dropNote, type Change, type PlanRow } from './changes.mjs';

/** The workouts Coach sees: this week and the next two, as the web calendar has them (loadRange). */
export async function planRows(userId: string, today: string): Promise<PlanRow[]> {
  const monday = mondayOf(today);
  const [range, lifts] = await Promise.all([
    loadRange(userId, monday, addDays(monday, 14), today),
    sql`
      SELECT a.id, a.lift_template FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
      WHERE p.user_id = ${userId} AND a.lift_template IS NOT NULL
        AND a.scheduled_date >= ${monday} AND a.scheduled_date <= ${addDays(monday, 20)}` as unknown as Promise<{ id: string; lift_template: string }[]>,
  ]);
  const template = new Map(lifts.map((r) => [String(r.id), r.lift_template]));
  return range.workouts.map((w) => ({
    id: String(w.id), date: w.date, startTime: w.startTime, title: w.title, sport: w.sport, workoutType: w.workoutType,
    intensity: w.intensity, duration: w.duration, description: w.description, status: w.status, skipReason: w.skipReason,
    state: w.state, liftTemplate: template.get(String(w.id)) ?? null,
  }));
}

export type Undo =
  | { op: 'edit'; id: string; body: Record<string, unknown> }
  | { op: 'skip'; id: string; reason: string | null }
  | { op: 'unskip'; id: string }
  | { op: 'remove'; id: string }
  | { op: 'restore'; row: Record<string, unknown> }
  | { op: 'forget'; text: string };

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
  const moved = await updateWorkout(userId, id, clean.value);
  if (!moved) throw new Error('workout not found');
  const back = { date: form.date, startTime: form.startTime, title: form.title, duration: form.duration, effort: form.effort, description: form.description };
  return { dates: [moved.from, moved.to], back };
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
  if (c.op === 'remember') {
    await editNotes(userId, (n) => addNote(n, c.text));
    return { undo: { op: 'forget', text: c.text }, dates: [] };
  }
  if (c.op === 'add') {
    const input = addInput({ sport: c.sport, date: c.date, startTime: c.startTime, title: c.title, duration: c.duration, effort: c.effort, description: c.description });
    if ('error' in input) throw new Error(input.error);
    const clean = cleanNewWorkout(input.value as never) as { value?: WorkoutInput; error?: string };
    if (!clean.value) throw new Error(clean.error ?? 'the workout is not valid');
    const id = await createWorkout(userId, { ...clean.value, workoutType: c.workoutType ?? clean.value.workoutType });
    // A gym lift names its Lift template, as the planner's do: Lift then plans its exercises and sets (lift-plan.mjs).
    if (c.liftTemplate) await sql`UPDATE training_plan_activities SET lift_template = ${c.liftTemplate} WHERE id = ${id}`;
    return { undo: { op: 'remove', id }, dates: [c.date] };
  }
  const row = rows.find((r) => r.id === c.id);
  if (!row) throw new Error('workout not found');
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
    case 'edit': return (await editWorkout(userId, u.id, u.body, today)).dates;
    case 'skip': await setSkipped(userId, u.id, true, u.reason); return [];
    case 'unskip': await setSkipped(userId, u.id, false); return [];
    case 'remove': { const gone = await removeWorkout(userId, u.id); return gone ? [gone.date] : []; }
    case 'restore': { const day = await restoreWorkout(userId, u.row); return day ? [day] : []; }
    case 'forget': await editNotes(userId, (n) => dropNote(n, u.text)); return [];
  }
}

/** A write failed: the ones before it were put back. `dates` are the days touched, for the calendar push. */
export class ApplyError extends Error {
  constructor(message: string, readonly dates: string[]) {
    super(message);
  }
}

/** Runs the changes in order. A write that fails puts back the ones before it and throws ApplyError. */
export async function applyAll(userId: string, ops: Change[], rows: PlanRow[], today: string): Promise<{ undo: Undo[]; dates: string[] }> {
  const undo: Undo[] = [];
  const dates: string[] = [];
  try {
    for (const c of ops) {
      const done = await applyOne(userId, c, rows, today);
      undo.push(done.undo);
      dates.push(...done.dates);
    }
  } catch (error) {
    for (const u of [...undo].reverse()) dates.push(...(await undoOne(userId, u, today).catch(() => [])));
    throw new ApplyError(error instanceof Error ? error.message : 'a change failed', dates);
  }
  return { undo, dates };
}

/** Puts back what applyAll changed, last change first. Returns the days touched. */
export async function undoAll(userId: string, undo: Undo[], today: string): Promise<string[]> {
  const dates: string[] = [];
  for (const u of [...undo].reverse()) dates.push(...(await undoOne(userId, u, today)));
  return dates;
}
