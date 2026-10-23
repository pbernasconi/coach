'use server';

import { ownerForSignedInUser } from '@/lib/owner';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { sql } from '@/db';
import { pushWeek } from '@/lib/calendar-sync/push.mjs';
import { mondayOf } from '@/lib/plan/week.mjs';
import { moveWorkout, setDone, setSkipped, workoutDate } from '@/lib/plan/queries';
import { addFromLibrary, createWorkout, duplicateWorkout, loadRange, removeWorkout, restoreWorkout, updateWorkout, type CalendarRange, type WorkoutInput } from '@/lib/plan/month';
import { MAX_SPAN_WEEKS, spanWeeks } from '@/lib/plan/scroll.mjs';
import { cookieTimeZone } from '@/lib/plan/timezone';
import { todayIn } from '@/lib/plan/week.mjs';
import { weeksAfterRemove } from '@/lib/plan/remove.mjs';
import { cleanNewWorkout } from '@/lib/plan/create.mjs';
import { cleanFeedback } from '@/lib/plan/feedback.mjs';
import { loadFeedback, saveFeedback, type Feedback } from '@/lib/plan/feedback';
import { loadActivity, loadActivityContext, type ActivityContext, type ActivityView } from '@/lib/activity/queries';
import { loadLiftModel } from '@/lib/lift-dashboard/queries';
import { sessionDetail } from '@/lib/lift-dashboard/stats.mjs';
import { richSession, type RichSession } from '@/lib/lift/session';
import { applyLiftEdit, liftLibrary, startPlanLift } from '@/lib/lift/edit-store';
import type { LiftEdit } from '@/lib/lift/edit.mjs';
import { loadDay } from '@/lib/vitals/garmin-pages';
import { dayGlance, type DayGlance } from '@/lib/vitals/day-glance';

export type LiftDetail = NonNullable<ReturnType<typeof sessionDetail>>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function user() {
  const userId = await ownerForSignedInUser();
  if (!userId) throw new Error('Not signed in');
  return userId;
}

/** Brings Google Calendar in line with the changed weeks, after the response (a slow Google never blocks a drag). */
function pushCalendar(userId: string, weeks: string[]) {
  after(async () => {
    for (const week of new Set(weeks)) {
      try {
        await pushWeek(sql, userId, week);
      } catch (error) {
        console.error('Calendar push failed:', error);
      }
    }
  });
}

function date(value: string) {
  if (!DATE.test(value)) throw new Error('Bad date');
  return value;
}

export async function moveWorkoutAction(id: string, toDate: string) {
  const userId = await user();
  const fromDate = await workoutDate(userId, String(id));
  await moveWorkout(userId, String(id), date(toDate));
  revalidatePath('/plan');
  pushCalendar(userId, [mondayOf(date(toDate)), ...(fromDate ? [mondayOf(fromDate)] : [])]);
}

/** Skips a workout with why (or puts it back). Returns how many other workouts were eased for fatigue. */
export async function skipWorkoutAction(id: string, skipped: boolean, reason: string | null = null) {
  const userId = await user();
  const eased = await setSkipped(userId, String(id), Boolean(skipped), reason, todayIn(await cookieTimeZone()));
  revalidatePath('/plan');
  const onDate = await workoutDate(userId, String(id));
  if (onDate) pushCalendar(userId, [mondayOf(onDate)]);
  return eased;
}

/** Marks a workout done by hand (e.g. a home session with no activity), or back to planned. */
export async function markDoneAction(id: string, done: boolean) {
  const userId = await user();
  await setDone(userId, String(id), Boolean(done));
  revalidatePath('/plan');
  revalidatePath('/');
  const onDate = await workoutDate(userId, String(id));
  if (onDate) pushCalendar(userId, [mondayOf(onDate)]);
}

export async function addFromLibraryAction(itemId: string, onDate: string) {
  const userId = await user();
  const item = String(itemId);
  if (!/^(plan|lift):[\w-]{1,80}$/.test(item)) throw new Error('Bad library item');
  const id = await addFromLibrary(userId, item, date(onDate));
  revalidatePath('/plan');
  pushCalendar(userId, [mondayOf(onDate)]);
  return id;
}

/**
 * Deletes a planned workout, then removes its Google Calendar event (pushWeek deletes events with no workout).
 * Returns the deleted row, for Undo (restoreWorkoutAction).
 */
export async function removeWorkoutAction(id: string): Promise<Record<string, unknown>> {
  const userId = await user();
  const gone = await removeWorkout(userId, String(id));
  if (!gone) throw new Error('Workout not found');
  revalidatePath('/plan');
  pushCalendar(userId, weeksAfterRemove(gone.date));
  return gone.row;
}

/** Undo of a delete: puts the workout back with its id, so the calendar event and Lift link come back too. */
export async function restoreWorkoutAction(row: Record<string, unknown>): Promise<string> {
  const userId = await user();
  const onDate = await restoreWorkout(userId, row);
  if (!onDate) throw new Error('Could not restore the workout');
  revalidatePath('/plan');
  pushCalendar(userId, [mondayOf(onDate)]);
  return onDate;
}

/** Saves an edit of a planned workout from the modal. Returns the old and new day, or the problem with the input. */
export async function updateWorkoutAction(id: string, input: Record<string, unknown>): Promise<{ from: string; to: string } | { error: string }> {
  const userId = await user();
  const clean = cleanNewWorkout(input) as { value?: WorkoutInput; error?: string };
  if (!clean.value) return { error: clean.error ?? 'The workout is not valid.' };
  const r = await updateWorkout(userId, String(id), clean.value);
  if (!r) return { error: 'The workout is gone.' };
  revalidatePath('/plan');
  pushCalendar(userId, [mondayOf(r.from), mondayOf(r.to)]);
  return r;
}

/**
 * Weeks for the continuous calendar, as it scrolls: the Mondays `fromMonday` to `toMonday`, at most MAX_SPAN_WEEKS
 * weeks. One query set (loadRange), like the first render.
 */
export async function loadWeeksAction(fromMonday: string, toMonday: string): Promise<CalendarRange> {
  const userId = await user();
  const from = mondayOf(date(fromMonday));
  const to = mondayOf(date(toMonday));
  if (to < from || spanWeeks(from, to) > MAX_SPAN_WEEKS) throw new Error('Bad week range');
  return loadRange(userId, from, to, todayIn(await cookieTimeZone()));
}

/** One activity for the Plan modal: the same data as /activities/<id>, and Coach's view (null when it fails). */
export async function activityPreviewAction(id: string): Promise<{ v: ActivityView; context: ActivityContext | null } | null> {
  const userId = await user();
  const v = await loadActivity(userId, String(id).slice(0, 40));
  if (!v) return null;
  const context = await loadActivityContext(userId, v, todayIn(await cookieTimeZone())).catch((error) => {
    console.error("Coach's view failed:", error);
    return null;
  });
  return { v, context };
}

/** One Lift session for the Plan modal: the same data as /lift/sessions/<id>. */
export async function liftPreviewAction(id: string): Promise<{ detail: RichSession; unit: string } | null> {
  await user();
  const { model, unit } = await loadLiftModel();
  const detail = richSession(model, String(id).slice(0, 64), unit);
  return detail ? { detail, unit } : null;
}

/** Adds a new workout from the calendar ("+" on a day). Returns its id, or the problem with the input. */
export async function createWorkoutAction(input: Record<string, unknown>): Promise<{ id: string } | { error: string }> {
  const userId = await user();
  const clean = cleanNewWorkout(input) as { value?: WorkoutInput; error?: string };
  if (!clean.value) return { error: clean.error ?? 'The workout is not valid.' };
  const id = await createWorkout(userId, clean.value);
  revalidatePath('/plan');
  pushCalendar(userId, [mondayOf(clean.value.date)]);
  return { id };
}

/** Pastes a copied planned workout on another day. */
export async function duplicateWorkoutAction(id: string, toDate: string) {
  const userId = await user();
  const copy = await duplicateWorkout(userId, String(id), date(toDate));
  if (!copy) throw new Error('workout not found');
  revalidatePath('/plan');
  pushCalendar(userId, [mondayOf(toDate)]);
  return copy;
}

/** Edits a planned Lift session (targets, sets, exercises). The iPhone gets the edit on its next sync. */
export async function editLiftAction(sessionId: string, edits: LiftEdit[]): Promise<{ ok: true } | { error: string }> {
  const userId = await user();
  if (!/^[0-9a-f-]{36}$/i.test(String(sessionId)) || !Array.isArray(edits) || edits.length > 200) return { error: 'Bad edit.' };
  const timeZone = await cookieTimeZone();
  const r = await applyLiftEdit(userId, String(sessionId), edits, { today: todayIn(timeZone), timeZone });
  if ('error' in r) return r;
  revalidatePath('/plan');
  if (r.weeks.length) pushCalendar(userId, r.weeks);
  return { ok: true };
}

/**
 * "Log sets" on a strength workout written as text (a home session): makes its Lift session from the coach's
 * exercises and links it, so each set can be logged here or in Lift.
 */
export async function startPlanLiftAction(planId: string): Promise<{ sessionId: string } | { error: string }> {
  const userId = await user();
  const { unit } = await loadLiftModel();
  const r = await startPlanLift(userId, String(planId).slice(0, 64), unit === 'kg' ? 'kg' : 'lb');
  if ('error' in r) return r;
  revalidatePath('/plan');
  return r;
}

/** The Lift exercise library, for "Add exercise". */
export async function liftLibraryAction() {
  await user();
  return liftLibrary();
}

/** The Garmin summary of one day, for the heart's hover card on the calendar. */
export async function loadHealthGlance(date: string): Promise<DayGlance | null> {
  if (!DATE.test(date)) return null;
  return dayGlance(await loadDay(await user(), date));
}

/** How a workout felt, for the item modal: the item's own row, else one logged on its planned workout. */
export async function loadFeedbackAction(items: string[], planActivityId: string | null): Promise<Feedback | null> {
  const userId = await user();
  return loadFeedback(userId, items.map(String).slice(0, 3), planActivityId ? String(planActivityId) : null);
}

export async function saveFeedbackAction(input: Record<string, unknown>): Promise<Feedback | { error: string }> {
  const userId = await user();
  const f = cleanFeedback(input);
  if ('error' in f) return { error: String(f.error) };
  return saveFeedback(userId, f as Parameters<typeof saveFeedback>[1]);
}
