/**
 * One activity, stored in full the moment Strava announces it (the webhook, src/app/api/webhooks/strava). Strava
 * pings Coach a few seconds after the watch's upload reaches it; this stores everything the activity page and the
 * Lift app show, so no page ever waits on Strava:
 *
 *   the activity row, the detailed activity (laps, splits with GAP, best efforts, segments, gear, calories),
 *   the streams with the zone times, the TSS from the samples, the weather and place, the training load,
 *   and the peak performances.
 *
 * Strava calls: 2 (detail and streams, at the same time), or 1 for an edit of an activity that has its streams.
 * Weather: Open-Meteo and Nominatim, started as soon as the detail gives the start position.
 */

import { syncActivityPeaks } from '../performance/peaks-sync.mjs';
import { STREAM_KEYS, storeDetail, storeStreams, storeWeather, wantsWeather } from '../activity/fetch.mjs';
import { rebuildTrainingLoad } from './load.mjs';
import { loadThresholds, storeActivityTss } from './thresholds.mjs';
import { thresholdValues } from './tss.mjs';
import { connectionWithToken } from './token.mjs';
import { upsertActivity } from './sync.mjs';

/**
 * @param {import('@neondatabase/serverless').NeonQueryFunction<false, false>} sql
 * @param {string | number} stravaActivityId
 * @param {{ env?: Record<string, string | undefined>, fetchImpl?: typeof fetch, log?: (...a: unknown[]) => void,
 *           streams?: 'always' | 'missing' }} [opts]
 *   streams: 'missing' (an edit) fetches the streams only when none are stored; 'always' (a new activity) always.
 * @returns {Promise<{ rowId: string | null, created: boolean, parts: string[], ms: number, skipped: string | null }>}
 */
export async function ingestActivity(sql, stravaActivityId, opts = {}) {
  const started = Date.now();
  const env = opts.env ?? process.env;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const log = opts.log ?? console.log;
  const id = String(Number(stravaActivityId));
  if (!/^\d+$/.test(id)) throw new Error(`bad Strava activity id ${stravaActivityId}`);
  const parts = [];

  const { conn, accessToken } = await connectionWithToken(sql, env, () => {});
  const [prior] = await sql`
    SELECT a.id, d.weather_fetched_at,
           d.streams_fetched_at IS NOT NULL
             OR EXISTS (SELECT 1 FROM strava_activity_streams s WHERE s.activity_id = a.id AND s.stream_type = 'time') AS has_streams
      FROM strava_activities a LEFT JOIN strava_activity_details d ON d.activity_id = a.id
     WHERE a.user_id = ${conn.user_id} AND a.strava_activity_id = ${id}
     LIMIT 1`;
  const wantStreams = opts.streams !== 'missing' || !prior?.has_streams;

  const get = async (url) => {
    const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(20_000) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Strava ${res.status} ${(await res.text()).slice(0, 160)}`);
    return res.json();
  };
  const base = `https://www.strava.com/api/v3/activities/${id}`;
  const [detail, streams] = await Promise.all([
    get(`${base}?include_all_efforts=true`),
    wantStreams ? get(`${base}/streams?keys=${STREAM_KEYS.join(',')}&key_by_type=true`).catch((e) => ({ error: e })) : null,
  ]);
  // 404: deleted or made private before this ran; the delete event handles the row.
  if (!detail) return { rowId: prior?.id ?? null, created: false, parts, ms: Date.now() - started, skipped: 'not found' };

  const { id: rowId, created } = await upsertActivity(sql, conn, detail);
  const row = { id: rowId, user_id: conn.user_id };
  await storeDetail(sql, row, detail);
  parts.push('detail');

  // The weather needs only the start, so it loads while the streams are written.
  const weather = wantsWeather(detail) && !prior?.weather_fetched_at
    ? storeWeather(sql, rowId, detail.start_latlng, fetchImpl).then(
        () => parts.push('weather'),
        (e) => log(`Weather for ${id} failed:`, e instanceof Error ? e.message : e),
      )
    : null;

  if (streams && 'error' in streams) {
    log(`Streams for ${id} failed:`, streams.error instanceof Error ? streams.error.message : streams.error);
  } else if (wantStreams) {
    const [p] = await sql`SELECT hr_zones FROM strava_athlete_profile WHERE user_id = ${conn.user_id} LIMIT 1`;
    await storeStreams(sql, row, streams ?? {}, p?.hr_zones?.zones ?? [], { rebuild: false, tss: false });
    parts.push('streams');
  }

  await storeActivityTss(sql, rowId, thresholdValues(await loadThresholds(sql, conn.user_id)));
  await weather;
  await rebuildTrainingLoad(sql, conn.user_id, () => {});
  // Peaks from the streams just stored: no Strava call.
  await syncActivityPeaks(sql, { stravaActivityIds: [id], storedOnly: true, log: () => {}, warn: () => {} }).catch((e) =>
    log(`Peaks for ${id} failed:`, e instanceof Error ? e.message : e),
  );
  return { rowId, created, parts, ms: Date.now() - started, skipped: null };
}
