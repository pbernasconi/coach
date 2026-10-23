import { load } from '@/lib/safe';
import { loadAppActivity } from '@/lib/activity/app-api';
import { loadAppWorkout } from '@/lib/plan/app-workout';
import { workoutResponse } from './unified.mjs';

/**
 * GET /api/app/workouts/{ref}: the plan workout and the Strava activity that completed it, as one body. Either half
 * opens it and the other half is found from it: a plan workout's match, or the activity's planned workout. A failed
 * second half leaves it null; the first one is the 404.
 */
export async function loadUnifiedWorkout(
  userId: string,
  ref: { kind: 'plan' | 'strava'; id: string },
  today: string,
  timeZone: string
) {
  if (ref.kind === 'plan') {
    const plan = await loadAppWorkout(userId, ref.id, today);
    if (!plan) return null;
    const activityId = (plan as { done?: { activityId?: string | null } | null }).done?.activityId ?? null;
    const activity = activityId
      ? await load('workout: activity', () => loadAppActivity(userId, activityId, today, timeZone))
      : null;
    return workoutResponse({ plan, activity: activity?.ok ? (activity.value?.body ?? null) : null });
  }
  const loaded = await loadAppActivity(userId, ref.id, today, timeZone);
  if (!loaded) return null;
  const body = loaded.body as { coach?: { ok?: boolean; planned?: { id?: string | null } | null } };
  const plannedId = body.coach?.planned?.id ?? null;
  const plan = plannedId ? await load('workout: plan', () => loadAppWorkout(userId, plannedId, today)) : null;
  return workoutResponse({ plan: plan?.ok ? plan.value : null, activity: loaded.body });
}
