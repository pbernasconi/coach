// @ts-check
/**
 * GET /api/app/workouts/{ref} (lift/APP-API.md, "Workout"): one workout, whether it was planned, done, or both. The
 * plan workout and the Strava activity that completed it are one thing to the athlete, so the phone gets them as one
 * body: `plan` (what the coach planned) and `activity` (what was done), either one null, and one "How did it feel".
 * Pure; unified.ts loads the two halves with the same loaders as /api/app/plan/{id} and /api/app/activities/{id}.
 */

/** `plan-<plan activity id>` or `strava-<Strava activity id>`. */
export const WORKOUT_REF = /^(plan|strava)-([A-Za-z0-9-]{1,64})$/;

/**
 * @param {string} raw
 * @returns {{ kind: 'plan' | 'strava', id: string } | null}
 */
export function parseWorkoutRef(raw) {
  const m = WORKOUT_REF.exec(String(raw ?? ''));
  return m ? { kind: /** @type {'plan' | 'strava'} */ (m[1]), id: m[2] } : null;
}

/** The ref of a plan workout. @param {string} id */
export const planRef = (id) => `plan-${id}`;
/** The ref of a Strava activity. @param {string} id */
export const stravaRef = (id) => `strava-${id}`;

/**
 * The body from its two halves. The activity's feedback wins when there is one: it reads the rows saved under the
 * activity and under the plan workout.
 * @param {{ plan: Record<string, any> | null, activity: Record<string, any> | null }} input
 */
export function workoutResponse({ plan, activity }) {
  const { feedback: planFeedback = null, ...planBody } = plan ?? {};
  const { feedback: activityFeedback = null, ...activityBody } = activity ?? {};
  const activityId = activity ? String(activity.activityId ?? '') : plan?.done?.activityId ?? null;
  return {
    ref: plan ? planRef(String(plan.id)) : stravaRef(String(activityId)),
    state: activity ? 'done' : 'planned',
    title: plan?.title ?? activity?.header?.name ?? 'Workout',
    plan: plan ? planBody : null,
    activity: activity ? activityBody : null,
    feedback: activityFeedback ?? planFeedback,
  };
}
