'use server';

import { ownerForSignedInUser } from '@/lib/owner';
import { revalidatePath } from 'next/cache';
import { FEELS, moveWorkout, setFeel, setSkipped, undoWeek, type Feel } from '@/lib/plan/queries';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function user() {
  const userId = await ownerForSignedInUser();
  if (!userId) throw new Error('Not signed in');
  return userId;
}

function date(value: string) {
  if (!DATE.test(value)) throw new Error('Bad date');
  return value;
}

export async function moveWorkoutAction(id: string, toDate: string) {
  await moveWorkout(await user(), String(id), date(toDate));
  revalidatePath('/plan');
}

export async function skipWorkoutAction(id: string, skipped: boolean) {
  await setSkipped(await user(), String(id), Boolean(skipped));
  revalidatePath('/plan');
}

export async function feelAction(weekStart: string, today: string, feel: Feel) {
  if (!FEELS.includes(feel)) throw new Error('Bad feel');
  const changed = await setFeel(await user(), date(weekStart), date(today), feel);
  revalidatePath('/plan');
  return changed;
}

export async function undoAction(weekStart: string, today: string) {
  const changed = await undoWeek(await user(), date(weekStart), date(today));
  revalidatePath('/plan');
  return changed;
}
