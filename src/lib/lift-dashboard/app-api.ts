import { richSession } from '@/lib/lift/session';
import { load, safe } from '@/lib/safe';
import { DEFAULT_TARGETS, loadTargets } from '@/lib/status';
import { loadBody } from '@/lib/vitals/garmin-pages';
import { loadAppActivity } from '@/lib/activity/app-api';
import { appRoute } from '@/lib/app-api/route';
import { feedbackBlock } from '@/lib/plan/feedback.mjs';
import { loadFeedback } from '@/lib/plan/feedback';
import { loadRange } from '@/lib/plan/month';
import { mondayOf } from '@/lib/plan/week.mjs';
import { exerciseResponse, liftResponse, sessionResponse, weeklyResponse } from './app-api.mjs';
import { sessionPairing } from './session-result.mjs';
import { liftOverview } from './overview.mjs';
import { loadLiftModel } from './queries';
import { exerciseDetail, exerciseList, weeklyVolume } from './stats.mjs';

// GET /api/app/lift… (lift/APP-API.md, "Lift"): the loaders of the web's /lift pages, shaped by app-api.mjs. The
// routes use appRoute (src/lib/app-api/route.ts). The
// Lift rows come through the `lift` data cache (cleared by each sync push), as on the web.

/** GET /api/app/lift: the /lift overview. A failed Lift model gives `{ ok: false }` sections, not an error. */
export async function loadAppLift(userId: string, today: string, timeZone: string, now = new Date()) {
  const [targets, body] = await Promise.all([
    safe('targets', () => loadTargets(userId), DEFAULT_TARGETS),
    safe('body', () => loadBody(userId, today), null),
  ]);
  const loaded = await safe(
    'app lift',
    async () => {
      const { model, unit } = await loadLiftModel();
      const overview = liftOverview(model, unit, today, { strengthTarget: targets.strength, weightKg: body?.weight?.value ?? null });
      return { overview, exercises: exerciseList(model, unit) };
    },
    null
  );
  return liftResponse({ overview: loaded?.overview ?? null, exercises: loaded?.exercises ?? null, timeZone, today, now });
}

/** GET /api/app/lift/weekly: the /lift/weekly table. */
export async function loadAppLiftWeekly(now = new Date()) {
  const loaded = await safe(
    'app lift weekly',
    async () => {
      const { model, unit } = await loadLiftModel();
      return { weeks: weeklyVolume(model, unit), unit };
    },
    null
  );
  return weeklyResponse({ weeks: loaded?.weeks ?? null, unit: loaded?.unit ?? null, now });
}

/**
 * GET /api/app/lift/sessions/:id: one session (an id in any case, or 'latest'); null when there is none. With the watch
 * activity of the same lift (the plan calendar's pairing, sessionPairing) and the "How did it feel" block. Each fails
 * alone.
 */
export async function loadAppLiftSession(
  userId: string,
  id: string,
  today: string,
  timeZone: string,
  now = new Date()
) {
  const { model, unit } = await loadLiftModel();
  const session = richSession(model, id, unit);
  if (!session) return null;
  const pairing = await safe(
    'app lift session: pairing',
    async () => {
      const monday = mondayOf(session.day);
      return sessionPairing(session.id, session.day, await loadRange(userId, monday, monday, today));
    },
    null
  );
  const plannedId = pairing?.planned?.id ?? null;
  const [watch, row] = await Promise.all([
    !pairing
      ? (false as const)
      : pairing.activityId
        ? safe<object | null | false>(
            'app lift session: watch',
            async () => {
              const a = await loadAppActivity(userId, pairing.activityId!, today, timeZone, now);
              return a?.body ?? null;
            },
            false as const
          )
        : null,
    // The watch's own feel and RPE sit on its Strava activity (strava:<id>): read them too, as one workout.
    load('app lift session: feedback', () =>
      loadFeedback(userId, [`lift:${session.id}`, ...(pairing?.activityId ? [`strava:${pairing.activityId}`] : [])], plannedId)
    ),
  ]);
  const feedback = row.ok
    ? feedbackBlock({ item: `lift:${session.id}`, date: session.day, title: session.title || 'Lift session', planActivityId: plannedId, row: row.value })
    : null;
  return sessionResponse({ session, timeZone, now, watch, feedback });
}

/** GET /api/app/lift/exercises/:key: one exercise's history; null when it has no logged sets. */
export async function loadAppLiftExercise(key: string, now = new Date()) {
  const { model, unit } = await loadLiftModel();
  const detail = exerciseDetail(model, key, unit);
  return detail ? exerciseResponse({ detail, unit, now }) : null;
}

/** A session id: a UUID-like id (any case) or 'latest'. */
export const SESSION_ID = /^(latest|[0-9A-Za-z-]{1,64})$/;
/** An exercise key: 'id-<library id>' or 'name-<lower-case name>', as exerciseKey() in stats.mjs. */
export const EXERCISE_KEY = /^(id|name)-[\s\S]{1,200}$/;

/** The handler of GET /api/app/lift/sessions/:id through appRoute (the route and the health check). */
export function appLiftSessionResponse(request: Request, id: string) {
  const invalid = SESSION_ID.test(id) ? null : 'id must be a session id or latest';
  return appRoute(request, 'lift session', ({ userId, today, timeZone }) => loadAppLiftSession(userId, id, today, timeZone), invalid);
}
