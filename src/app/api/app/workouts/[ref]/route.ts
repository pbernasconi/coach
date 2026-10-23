/**
 * One workout, planned and done as one (lift/APP-API.md, "Workout"). Authenticated by the LIFT_SYNC_TOKEN bearer
 * token, as the Lift sync routes.
 *
 *   GET /api/app/workouts/plan-<plan workout id>?tz=…
 *   GET /api/app/workouts/strava-<Strava activity id>?tz=…
 */

import { appRoute } from '@/lib/app-api/route';
import { parseWorkoutRef } from '@/lib/workout/unified.mjs';
import { loadUnifiedWorkout } from '@/lib/workout/unified';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ ref: string }> }) {
  const ref = parseWorkoutRef((await params).ref);
  return appRoute(
    request,
    'workout',
    ({ userId, today, timeZone }) => loadUnifiedWorkout(userId, ref!, today, timeZone),
    ref ? null : 'ref must be plan-<id> or strava-<id>'
  );
}
