// The cloud path to Zwift: Coach sends each planned indoor ride to intervals.icu as a .zwo; intervals.icu, an
// official Zwift partner, uploads the coming week to Zwift every day, so the iPad shows it (Workouts → Custom →
// Intervals.icu; today's on the home screen). Coach stays the source: intervals.icu only passes the files on.
// API: https://intervals.icu/api/v1/docs, Basic auth "API_KEY" + the athlete's personal key.
// docs/research/zwift-sync.md §3b. Env: INTERVALS_API_KEY, INTERVALS_ATHLETE_ID.

import { loadSyncRows, planSync, recordSync } from './sync.mjs';

const BASE = 'https://intervals.icu/api/v1';

/** The client for the configured athlete, or null when the env is not set. */
export function intervalsClient(env = process.env, fetchFn = fetch) {
  const key = env.INTERVALS_API_KEY;
  const athlete = env.INTERVALS_ATHLETE_ID;
  if (!key || !athlete) return null;
  const auth = `Basic ${Buffer.from(`API_KEY:${key}`).toString('base64')}`;
  async function call(method, path, body) {
    const res = await fetchFn(`${BASE}/athlete/${encodeURIComponent(athlete)}${path}`, {
      method,
      headers: { authorization: auth, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 404 && method === 'DELETE') return null; // already gone
    const text = await res.text();
    if (!res.ok) throw new Error(`intervals.icu ${method} ${path.split('?')[0]}: ${res.status} ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  }
  return {
    athlete: () => call('GET', ''),
    upsert: (event) => call('POST', '/events?upsertOnUid=true', event),
    update: (id, event) => call('PUT', `/events/${encodeURIComponent(id)}`, event),
    remove: (id) => call('DELETE', `/events/${encodeURIComponent(id)}`),
    get: (id) => call('GET', `/events/${encodeURIComponent(id)}`),
  };
}

/** Problems with the intervals.icu → Zwift link, from the athlete record; empty when it looks right. */
export function connectionProblems(athlete) {
  const out = [];
  const connected = athlete?.zwift_user_id || athlete?.icu_connections?.zwift_connected || athlete?.zwift_connected;
  if (!connected) out.push('Zwift is not connected in intervals.icu (Settings → Zwift → Connect)');
  if (athlete && athlete.zwift_upload_workouts === false) out.push('intervals.icu does not upload workouts to Zwift (Settings → Zwift)');
  return out;
}

/**
 * Sends the indoor rides from `from` to `to` to intervals.icu: create or update by uid, delete the ones the plan
 * dropped, read each back for Zwift upload errors (push_errors), and store the state in workout_syncs.
 * @returns {Promise<{ skipped?: string, created: number, updated: number, deleted: number, kept: number, errors: string[], warnings: string[] }>}
 */
export async function syncIntervals(sql, userId, client, { from, to, dryRun = false, log = () => {} }) {
  const done = { created: 0, updated: 0, deleted: 0, kept: 0, errors: [], warnings: [] };
  if (!client) return { ...done, skipped: 'INTERVALS_API_KEY or INTERVALS_ATHLETE_ID is not set' };
  done.warnings = connectionProblems(await client.athlete().catch(() => null));
  const { rows, synced } = await loadSyncRows(sql, userId, 'intervals', from, to);
  for (const o of planSync('intervals', rows, synced)) {
    if (o.op === 'keep') {
      done.kept++;
      continue;
    }
    const label = o.payload?.event.name ?? o.prior?.remote_id ?? o.activityId;
    log(`${o.op} ${label}`);
    if (dryRun) continue;
    try {
      if (o.op === 'delete') {
        await client.remove(o.prior.remote_id);
        await recordSync(sql, 'intervals', { op: 'delete', activityId: o.activityId, ok: true });
        done.deleted++;
        continue;
      }
      const saved = await client.upsert(o.payload.event);
      const id = String(saved?.id ?? '');
      if (!id) throw new Error('intervals.icu returned no event id');
      if (o.prior?.remote_id && o.prior.remote_id !== id) await client.remove(o.prior.remote_id).catch(() => null);
      const back = await client.get(id).catch(() => saved);
      const pushErrors = (back?.push_errors ?? []).filter((e) => /zwift/i.test(String(e.service ?? ''))).map((e) => e.message);
      const error = pushErrors.length ? `Zwift upload: ${pushErrors.join('; ')}` : null;
      await recordSync(sql, 'intervals', { op: o.op, activityId: o.activityId, ok: !error, error, hash: o.hash, remoteId: id });
      if (error) done.errors.push(`${label}: ${error}`);
      done[o.op === 'create' ? 'created' : 'updated']++;
    } catch (e) {
      done.errors.push(`${label}: ${e.message}`);
      await recordSync(sql, 'intervals', { op: o.op, activityId: o.activityId, ok: false, error: e.message, hash: o.hash, remoteId: o.prior?.remote_id ?? null });
    }
  }
  return done;
}
