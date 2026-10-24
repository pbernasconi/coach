import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { sql } from '@/db';
import { pushWeek } from '@/lib/calendar-sync/push.mjs';
import { mondayOf } from '@/lib/plan/week.mjs';
import { loadUnifiedWorkout } from '@/lib/workout/unified';

/**
 * After a plan write from the phone: the web pages read it again, the calendar gets the week (and `alsoWeekOf`'s, as
 * the old day of a move) after the answer, and the phone gets the workout as GET /api/app/workouts/plan-<id> returns
 * it.
 */
export async function afterPlanWrite(userId: string, id: string, date: string, today: string, timeZone: string, alsoWeekOf: string[] = []) {
  pushPlanWeeks(userId, [date, ...alsoWeekOf]);
  return loadUnifiedWorkout(userId, { kind: 'plan', id }, today, timeZone);
}

/**
 * The web pages read the plan again, and Google Calendar gets the weeks of `dates` after the answer (pushWeek writes,
 * moves and deletes the events; a slow Google never holds the phone).
 */
export function pushPlanWeeks(userId: string, dates: string[]) {
  revalidatePath('/plan');
  revalidatePath('/');
  after(async () => {
    for (const week of new Set(dates.map((d) => mondayOf(d)))) {
      try {
        await pushWeek(sql, userId, week);
      } catch (error) {
        console.error('Calendar push failed:', error instanceof Error ? error.message : 'unknown error');
      }
    }
  });
}
