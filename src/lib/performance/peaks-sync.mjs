/**
 * Peak performances for synced Strava activities: reads the time, distance and watts streams, extracts the
 * bests (peaks.mjs) and stores them in activity_peaks. activity_peak_scans records each activity it has
 * seen, so a run can stop at any point and the next run continues.
 *
 * Used after each Strava sync (webhook and cron, a few activities per call) and by scripts/peaks-backfill.mjs
 * (everything, waiting out the 15-minute windows).
 *
 * Rate limits: Strava allows 100 reads per 15 min and 1000 per day. Each activity costs at most one call;
 * activities with streams already in strava_activity_streams cost none. The streams endpoint sends no usage
 * headers, so the usage is counted here, from a GET /athlete probe (probeUsage, 1 call) or from 0. A 429
 * means the window is full. A cushion stays free for the regular sync.
 */

import { connectionWithToken } from '../strava-sync/sync.mjs';
import { PEAKS_VERSION, countRequest, extractPeaks, msToNextWindow, rateDecision, rateUsage, rollUsage } from './peaks.mjs';

const RIDE_WITH_POWER = `(a.sport_type ~ 'Ride$' AND a.sport_type NOT IN ('EBikeRide', 'EMountainBikeRide') AND a.device_watts = true AND COALESCE(a.moving_time, 0) >= 5)`;
const RUN = `(a.sport_type ~ 'Run$' AND COALESCE(a.distance, 0) >= 1000)`;

async function connection(sql, env, log, allowTokenRefresh) {
  if (allowTokenRefresh) return connectionWithToken(sql, env, log);
  // Strava rotates refresh tokens: a refresh from a copy of the database would end the production token.
  const [conn] = await sql`SELECT id, user_id, access_token, expires_at FROM strava_connections LIMIT 1`;
  if (!conn) throw new Error('No Strava connection in DB');
  if (conn.expires_at <= Math.floor(Date.now() / 1000) + 60) throw new Error('Strava access token expired, and token refresh is off');
  return { conn, accessToken: conn.access_token };
}

/** Activities that still need a scan (none yet, or one from an older PEAKS_VERSION). */
async function pending(sql, userId, limit, ids, storedOnly) {
  const rows = await sql.query(
    `SELECT a.id, a.strava_activity_id, a.sport_type, a.device_watts
       FROM strava_activities a
       LEFT JOIN activity_peak_scans s ON s.user_id = a.user_id AND s.strava_activity_id = a.strava_activity_id
      WHERE a.user_id = $1
        AND (${RIDE_WITH_POWER} OR ${RUN})
        AND ($2::text[] IS NULL OR a.strava_activity_id = ANY($2::text[]))
        AND ($2::text[] IS NOT NULL OR s.strava_activity_id IS NULL OR s.version < $3)
        AND (NOT $5::boolean OR EXISTS (
          SELECT 1 FROM strava_activity_streams st WHERE st.activity_id = a.id AND st.stream_type = 'time'))
      ORDER BY a.start_date DESC
      LIMIT $4`,
    [userId, ids ?? null, PEAKS_VERSION, limit, Boolean(storedOnly)],
  );
  return rows;
}

/** How many activities still need a scan. */
export async function pendingPeakScans(sql, userId) {
  const [r] = await sql.query(
    `SELECT COUNT(*)::int AS n
       FROM strava_activities a
       LEFT JOIN activity_peak_scans s ON s.user_id = a.user_id AND s.strava_activity_id = a.strava_activity_id
      WHERE a.user_id = $1 AND (${RIDE_WITH_POWER} OR ${RUN}) AND (s.strava_activity_id IS NULL OR s.version < $2)`,
    [userId, PEAKS_VERSION],
  );
  return r.n;
}

async function save(sql, userId, stravaId, status, peaks) {
  const queries = [
    sql`DELETE FROM activity_peaks WHERE user_id = ${userId} AND strava_activity_id = ${stravaId}`,
    ...peaks.map((p) => sql`
      INSERT INTO activity_peaks (user_id, strava_activity_id, metric, span, value, computed_at)
      VALUES (${userId}, ${stravaId}, ${p.metric}, ${p.span}, ${p.value}, NOW())`),
    sql`
      INSERT INTO activity_peak_scans (user_id, strava_activity_id, version, status, scanned_at)
      VALUES (${userId}, ${stravaId}, ${PEAKS_VERSION}, ${status}, NOW())
      ON CONFLICT (user_id, strava_activity_id) DO UPDATE SET
        version = EXCLUDED.version, status = EXCLUDED.status, scanned_at = NOW()`,
  ];
  if (typeof sql.transaction === 'function') await sql.transaction(queries);
  else for (const q of queries) await q;
}

/**
 * Scans up to `limit` activities, newest first, and stores their peaks.
 *
 * @param {import('@neondatabase/serverless').NeonQueryFunction<false, false>} sql
 * @param {{ limit?: number, waitOnRateLimit?: boolean, allowTokenRefresh?: boolean, storedOnly?: boolean,
 *           probeUsage?: boolean, usage?: ReturnType<typeof rateUsage>, stravaActivityIds?: string[], env?: Record<string, string | undefined>,
 *           log?: (...a: unknown[]) => void, warn?: (...a: unknown[]) => void, sleep?: (ms: number) => Promise<void> }} [opts]
 *   waitOnRateLimit: sleep until the next 15-minute window (scripts); else stop (server).
 *   allowTokenRefresh: false for a copy of the production database.
 *   probeUsage: read the current usage from GET /athlete first, and again after each wait (1 call each).
 *   usage: the usage a previous call returned, to carry the count over.
 *   storedOnly: use streams already in the database and make no Strava calls.
 *   stravaActivityIds: scan these activities again, whatever their scan state.
 * @returns {Promise<{ scanned: number, withPeaks: number, fetched: number, fromStored: number, errors: number,
 *                     stopped: null | 'rate_limit' | 'daily_limit', usage: ReturnType<typeof rateUsage> }>}
 */
export async function syncActivityPeaks(sql, opts = {}) {
  const limit = opts.limit ?? 20;
  const env = opts.env ?? process.env;
  const log = opts.log ?? console.log;
  const warn = opts.warn ?? console.warn;
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const waitOnRateLimit = Boolean(opts.waitOnRateLimit);
  const storedOnly = Boolean(opts.storedOnly);

  const result = { scanned: 0, withPeaks: 0, fetched: 0, fromStored: 0, errors: 0, stopped: null, usage: opts.usage ?? null };
  const [user] = await sql`SELECT user_id FROM strava_connections LIMIT 1`;
  if (!user) return result;
  const userId = user.user_id;
  const todo = await pending(sql, userId, limit, opts.stravaActivityIds, storedOnly);
  if (todo.length === 0) return result;

  let accessToken = null;
  let probe = Boolean(opts.probeUsage);
  async function get(url) {
    if (!accessToken) accessToken = (await connection(sql, env, log, opts.allowTokenRefresh ?? true)).accessToken;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    result.fetched++;
    const seen = rateUsage(res.headers);
    result.usage = seen ? { ...seen, at: Date.now() } : countRequest(result.usage);
    return res;
  }
  /** The streams from Strava, null when Strava has none (404), or a stop reason. */
  async function fetchStreams(stravaId) {
    for (let attempt = 0; attempt < 2; attempt++) {
      result.usage = rollUsage(result.usage);
      const decision = rateDecision(result.usage);
      if (decision === 'stop') return { stop: 'daily_limit' };
      if (decision === 'wait') {
        if (!waitOnRateLimit) return { stop: 'rate_limit' };
        const ms = msToNextWindow();
        log(`Strava 15-minute limit near (${result.usage.short}/${result.usage.shortLimit}); waiting ${Math.round(ms / 1000)} s`);
        await sleep(ms);
        result.usage = result.usage && { ...result.usage, short: 0, at: Date.now() };
        probe = Boolean(opts.probeUsage);
      }
      if (probe) {
        probe = false;
        const r = await get('https://www.strava.com/api/v3/athlete');
        if (r.status === 429) result.usage = { ...result.usage, short: Infinity };
        if (r.status === 429 || rateDecision(result.usage) !== 'go') continue;
      }
      const res = await get(
        `https://www.strava.com/api/v3/activities/${encodeURIComponent(stravaId)}/streams?keys=time,distance,watts&key_by_type=true&series_type=time`,
      );
      if (res.status === 429) {
        // The window is full: wait (scripts) or stop (server).
        result.usage = { ...result.usage, short: Infinity };
        continue;
      }
      if (res.status === 404) return { streams: null };
      if (!res.ok) throw new Error(`Strava streams ${stravaId}: ${res.status} ${(await res.text()).slice(0, 200)}`);
      const body = await res.json();
      return { streams: { time: body.time?.data, distance: body.distance?.data, watts: body.watts?.data } };
    }
    return { stop: 'rate_limit' };
  }

  for (const a of todo) {
    const stravaId = String(a.strava_activity_id);
    const stored = await sql`
      SELECT stream_type, data FROM strava_activity_streams
      WHERE activity_id = ${a.id} AND stream_type IN ('time', 'distance', 'watts')`;
    let streams = Object.fromEntries(stored.map((r) => [r.stream_type, r.data]));
    const needed = /Run$/.test(a.sport_type) ? 'distance' : 'watts';
    let status = 'ok';
    if (streams.time && streams[needed]) {
      result.fromStored++;
    } else if (storedOnly) {
      continue;
    } else {
      let got;
      try {
        got = await fetchStreams(stravaId);
      } catch (e) {
        result.errors++;
        warn(e.message);
        if (/ 401 /.test(e.message)) break;
        continue;
      }
      if (got.stop) {
        result.stopped = got.stop;
        break;
      }
      streams = got.streams ?? {};
      if (!got.streams) status = 'gone';
    }
    const peaks = extractPeaks(streams, { sportType: a.sport_type, deviceWatts: a.device_watts });
    if (status === 'ok' && peaks.length === 0) status = 'no_streams';
    await save(sql, userId, stravaId, status, peaks);
    result.scanned++;
    if (peaks.length) result.withPeaks++;
  }
  return result;
}
