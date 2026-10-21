import { richSession } from '@/lib/lift/session';
import { safe } from '@/lib/safe';
import { DEFAULT_TARGETS, loadTargets } from '@/lib/status';
import { loadBody } from '@/lib/vitals/garmin-pages';
import { exerciseResponse, liftResponse, sessionResponse, weeklyResponse } from './app-api.mjs';
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

/** GET /api/app/lift/sessions/:id: one session (an id in any case, or 'latest'); null when there is none. */
export async function loadAppLiftSession(id: string, timeZone: string, now = new Date()) {
  const { model, unit } = await loadLiftModel();
  const session = richSession(model, id, unit);
  return session ? sessionResponse({ session, timeZone, now }) : null;
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
