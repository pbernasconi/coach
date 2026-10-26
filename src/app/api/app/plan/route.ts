/**
 * Adds a planned workout from the Lift iPhone app (lift/APP-API.md, "Add a workout"): the web's "+" on a day
 * (createWorkoutAction). Bearer LIFT_SYNC_TOKEN, as every /api/app route. The Coach tab's Apply needs it too
 * (lift/COACH-CHAT.md).
 *
 *   POST /api/app/plan?tz=…  { sport, date, startTime, title, duration, distanceKm, tss, effort, description, bank, level }
 *
 * Answers 201 with the workout, as GET /api/app/workouts/plan-<id>, and pushes the week to Google Calendar after the
 * answer.
 */

import { appWrite } from '@/lib/app-api/route';
import { addInput } from '@/lib/plan/app-edit.mjs';
import { afterPlanWrite } from '@/lib/plan/app-writes';
import { cleanNewWorkout } from '@/lib/plan/create.mjs';
import { createWorkout, type WorkoutInput } from '@/lib/plan/month';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return appWrite(request, 'plan add', async ({ userId, today, timeZone }, body) => {
    const input = addInput(body);
    if ('error' in input) return { status: 400, body: { error: input.error } };
    const clean = cleanNewWorkout(input.value) as { value?: WorkoutInput; error?: string };
    if (!clean.value) return { status: 400, body: { error: clean.error ?? 'the workout is not valid' } };
    const id = await createWorkout(userId, clean.value);
    const workout = await afterPlanWrite(userId, id, clean.value.date, today, timeZone);
    return workout ? { status: 201, body: workout } : { status: 404, body: { error: 'not found' } };
  });
}
