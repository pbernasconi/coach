'use server';

import { ownerForSignedInUser } from '@/lib/owner';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { sql } from '@/db';
import { pushWeek } from '@/lib/calendar-sync/push.mjs';
import { mondayOf } from '@/lib/plan/week.mjs';
import { FEELS, moveWorkout, setFeel, setSkipped, undoWeek, workoutDate, type Feel } from '@/lib/plan/queries';

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

export async function feelAction(weekStart: string, today: string, feel: Feel) {
  if (!FEELS.includes(feel)) throw new Error('Bad feel');
  const userId = await user();
  const changed = await setFeel(userId, date(weekStart), date(today), feel);
  revalidatePath('/plan');
  if (changed) pushCalendar(userId, [date(weekStart)]);
  return changed;
}

export async function undoAction(weekStart: string, today: string) {
  const userId = await user();
  const changed = await undoWeek(userId, date(weekStart), date(today));
  revalidatePath('/plan');
  if (changed) pushCalendar(userId, [date(weekStart)]);
  return changed;
}
