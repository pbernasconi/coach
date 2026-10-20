// The Garmin job's side of the workout sync (COACH-API.md): GET gives the ops for the next two weeks, POST takes
// what the job did. CRON_SECRET bearer, like /api/vitals/garmin. Pure handlers over a small repository; node --test.

import { isAuthorized } from '../lift-sync/auth.mjs';
import { planSync } from './sync.mjs';

export const GARMIN_DAYS = 14;

/** The stored remote id of a Garmin workout: { workoutId, scheduleId, date }. Old or bad values read as {}. */
export function parseRemote(text) {
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

/** GET: the ops for the job. `repo.load()` gives { rows, synced } for the window. */
export async function handleGarminWorkoutsGet(req, repo) {
  if (!isAuthorized(req.authorization, req.tokens.cron)) return { status: 401, body: { error: 'unauthorized' } };
  const { rows, synced, from, to } = await repo.load();
  const ops = planSync('garmin', rows, synced)
    .filter((o) => o.op !== 'keep')
    .map((o) => ({
      op: o.op,
      activityId: o.activityId,
      hash: o.hash ?? null,
      date: o.payload?.date ?? null,
      workout: o.payload?.workout ?? null,
      remote: o.prior ? parseRemote(o.prior.remote_id) : null,
    }));
  return { status: 200, body: { from, to, ops } };
}

/** POST { results: [{ activityId, op, ok, error?, hash?, remote?: { workoutId, scheduleId, date } }] }. */
export async function handleGarminWorkoutsPost(req, repo) {
  if (!isAuthorized(req.authorization, req.tokens.cron)) return { status: 401, body: { error: 'unauthorized' } };
  let body;
  try {
    body = JSON.parse(req.rawBody);
  } catch {
    return { status: 400, body: { error: 'invalid JSON' } };
  }
  const results = Array.isArray(body?.results) ? body.results : null;
  if (!results || results.length > 200) return { status: 400, body: { error: 'results must be a list of at most 200' } };
  let stored = 0;
  for (const r of results) {
    if (typeof r?.activityId !== 'string' || !['create', 'update', 'delete'].includes(r.op)) continue;
    const remote = r.remote && typeof r.remote === 'object' ? r.remote : null;
    await repo.record({
      activityId: r.activityId,
      op: r.op,
      ok: r.ok === true,
      error: typeof r.error === 'string' ? r.error : null,
      hash: typeof r.hash === 'string' ? r.hash : '',
      remoteId: remote?.workoutId ? JSON.stringify({ workoutId: remote.workoutId, scheduleId: remote.scheduleId ?? null, date: remote.date ?? null }) : null,
    });
    stored++;
  }
  return { status: 200, body: { stored } };
}
