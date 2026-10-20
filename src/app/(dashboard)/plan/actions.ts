'use server';

import { ownerForSignedInUser } from '@/lib/owner';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { sql } from '@/db';
import { pushWeek } from '@/lib/calendar-sync/push.mjs';
import { mondayOf } from '@/lib/plan/week.mjs';
import { moveWorkout, setSkipped, workoutDate } from '@/lib/plan/queries';
import { addFromLibrary, loadRange, removeWorkout, type CalendarRange } from '@/lib/plan/month';
import { MAX_SPAN_WEEKS, spanWeeks } from '@/lib/plan/scroll.mjs';
import { cookieTimeZone } from '@/lib/plan/timezone';
import { todayIn } from '@/lib/plan/week.mjs';
import { weeksAfterRemove } from '@/lib/plan/remove.mjs';
import { loadActivity, loadActivityContext, type ActivityContext, type ActivityView } from '@/lib/activity/queries';
import { loadLiftModel } from '@/lib/lift-dashboard/queries';
import { sessionDetail } from '@/lib/lift-dashboard/stats.mjs';

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

export async function skipWorkoutAction(id: string, skipped: boolean) {
  const userId = await user();
  await setSkipped(userId, String(id), Boolean(skipped));
  revalidatePath('/plan');
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

/** Deletes a planned workout, then removes its Google Calendar event (pushWeek deletes events with no workout). */
export async function removeWorkoutAction(id: string) {
  const userId = await user();
  const onDate = await removeWorkout(userId, String(id));
  if (!onDate) throw new Error('Workout not found');
  revalidatePath('/plan');
  pushCalendar(userId, weeksAfterRemove(onDate));
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
export async function liftPreviewAction(id: string): Promise<{ detail: LiftDetail; unit: string } | null> {
  await user();
  const { model, unit } = await loadLiftModel();
  const detail = sessionDetail(model, String(id).slice(0, 64), unit) as LiftDetail | null;
  return detail ? { detail, unit } : null;
}
