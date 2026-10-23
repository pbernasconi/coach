import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { sql } from '@/db';
import { pushWeek } from '@/lib/calendar-sync/push.mjs';
import { mondayOf } from '@/lib/plan/week.mjs';
import { loadUnifiedWorkout } from '@/lib/workout/unified';

/**
 * After a plan write from the phone: the web pages read it again, the calendar gets the week (after the answer), and
 * the phone gets the workout as GET /api/app/workouts/plan-<id> returns it.
 */
export async function afterPlanWrite(userId: string, id: string, date: string, today: string, timeZone: string) {
  revalidatePath('/plan');
  revalidatePath('/');
  after(async () => {
    try {
      await pushWeek(sql, userId, mondayOf(date));
    } catch (error) {
      console.error('Calendar push failed:', error instanceof Error ? error.message : 'unknown error');
    }
  });
  return loadUnifiedWorkout(userId, { kind: 'plan', id }, today, timeZone);
}
