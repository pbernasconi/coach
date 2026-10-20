/**
 * On-demand fetch for the activity page: the detailed activity, the streams and the weather of one activity, stored
 * once so the next view reads only the database. The page calls it (through POST /api/activities/[id]/fetch) when
 * a part is missing.
 *
 * Strava rotates refresh tokens: a refresh from a copy of the production database ends production's token. So a
 * token refresh runs only where `allowTokenRefresh` is true (production, see `refreshAllowed`). Elsewhere the
 * stored access token is used while it is valid, and the fetch is skipped after it expires.
 *
 * Strava calls: at most 2 per activity (detail + streams). Weather: Open-Meteo (no key), when Strava has none.
 */

import { createId } from '@paralleldrive/cuid2';
import { connectionWithToken, rebuildTrainingLoad } from '../strava-sync/sync.mjs';
import { toDate, toIso } from '../db-time.mjs';
import { pickHour, placeName } from './weather.mjs';
import { zoneTimes } from './streams.mjs';
import { thresholdValues } from '../strava-sync/tss.mjs';
import { loadThresholds, storeActivityTss } from '../strava-sync/thresholds.mjs';

export const STREAM_KEYS = ['time', 'distance', 'latlng', 'altitude', 'velocity_smooth', 'heartrate', 'cadence', 'watts', 'temp', 'moving', 'grade_smooth'];

// A failed fetch is tried again after this long, so a broken activity does not call Strava on every view.
const RETRY_MS = 60 * 60_000;

/** Token refresh is safe only on the database that owns the token: production. */
export function refreshAllowed(env = process.env) {
  return env.VERCEL_ENV === 'production' || env.STRAVA_ALLOW_REFRESH === '1';
}

async function accessToken(sql, env, allowTokenRefresh) {
  if (allowTokenRefresh) return (await connectionWithToken(sql, env, () => {})).accessToken;
  const [conn] = await sql`SELECT access_token, expires_at FROM strava_connections LIMIT 1`;
  if (!conn) throw new Error('No Strava connection');
  if (Number(conn.expires_at) <= Math.floor(Date.now() / 1000) + 60) return null;
  return conn.access_token;
}

/**
 * What the page still lacks for one activity row. `weather` needs a start position.
 * @returns {Promise<{ detail: boolean, streams: boolean, weather: boolean, retryLater: boolean }>}
 */
export async function missingParts(sql, activityRowId) {
  const [r] = await sql`
    SELECT a.start_latlng, a.trainer, a.sport_type, d.detail_fetched_at, d.streams_fetched_at, d.weather_fetched_at, d.fetch_error, d.updated_at,
           EXISTS (SELECT 1 FROM strava_activity_streams s WHERE s.activity_id = a.id AND s.stream_type = 'time') AS has_streams
      FROM strava_activities a LEFT JOIN strava_activity_details d ON d.activity_id = a.id
     WHERE a.id = ${activityRowId}`;
  if (!r) return { detail: false, streams: false, weather: false, retryLater: false };
  const latlng = Array.isArray(r.start_latlng) && r.start_latlng.length === 2;
  const virtual = Boolean(r.trainer) || /^Virtual/.test(String(r.sport_type ?? ''));
  const failedAt = r.fetch_error ? (toDate(r.updated_at)?.getTime() ?? 0) : 0;
  return {
    detail: !r.detail_fetched_at,
    streams: !r.streams_fetched_at && !r.has_streams,
    weather: latlng && !virtual && !r.weather_fetched_at,
    retryLater: Boolean(failedAt && Date.now() - failedAt < RETRY_MS),
  };
}

async function ensureRow(sql, activityRowId) {
  await sql`INSERT INTO strava_activity_details (activity_id) VALUES (${activityRowId}) ON CONFLICT (activity_id) DO NOTHING`;
}

/** Stores the detailed activity: details row, gear, laps, splits (with GAP), and the start times as Strava sent them. */
export async function storeDetail(sql, row, d) {
  await ensureRow(sql, row.id);
  const best = (d.best_efforts ?? []).map((e) => ({
    name: e.name, distance: e.distance, elapsedTime: e.elapsed_time, movingTime: e.moving_time,
    startIndex: e.start_index ?? null, endIndex: e.end_index ?? null, prRank: e.pr_rank ?? null,
  }));
  const segments = (d.segment_efforts ?? []).filter((e) => !e.hidden).map((e) => ({
    id: String(e.segment?.id ?? e.id), name: e.name ?? e.segment?.name, distance: e.distance ?? e.segment?.distance,
    elapsedTime: e.elapsed_time, movingTime: e.moving_time, averageGrade: e.segment?.average_grade ?? null,
    climbCategory: e.segment?.climb_category ?? null, startIndex: e.start_index ?? null, endIndex: e.end_index ?? null,
    prRank: e.pr_rank ?? null, komRank: e.kom_rank ?? null, hr: e.average_heartrate ?? null, watts: e.average_watts ?? null,
  }));
  await sql`
    UPDATE strava_activity_details SET
      polyline = ${d.map?.polyline ?? null}, summary_polyline = ${d.map?.summary_polyline ?? null},
      calories = ${d.calories ?? null}, device_name = ${d.device_name ?? null}, perceived_exertion = ${d.perceived_exertion ?? null},
      best_efforts = ${JSON.stringify(best)}, segment_efforts = ${JSON.stringify(segments)},
      detail_fetched_at = NOW(), fetch_error = NULL, updated_at = NOW()
    WHERE activity_id = ${row.id}`;
  // Times as Strava's text: a Date parameter is written in the server's zone, which shifted rows written on a laptop.
  const startUtc = typeof d.start_date === 'string' ? d.start_date.replace(/Z$/, '') : null;
  const startLocal = typeof d.start_date_local === 'string' ? d.start_date_local.replace(/Z$/, '') : null;
  await sql`
    UPDATE strava_activities SET
      description = ${d.description ?? null}, suffer_score = ${d.suffer_score ?? null},
      start_date = COALESCE(${startUtc}::timestamp, start_date), start_date_local = COALESCE(${startLocal}::timestamp, start_date_local),
      updated_at = NOW()
    WHERE id = ${row.id}`;
  if (d.gear?.id) {
    await sql`
      INSERT INTO strava_gear (id, user_id, name, distance, retired, fetched_at)
      VALUES (${String(d.gear.id)}, ${row.user_id}, ${d.gear.name ?? null}, ${d.gear.distance ?? null}, ${d.gear.retired ?? null}, NOW())
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, distance = EXCLUDED.distance, retired = EXCLUDED.retired, fetched_at = NOW()`;
  }
  if (d.laps?.length) {
    await sql`DELETE FROM strava_activity_laps WHERE activity_id = ${row.id}`;
    for (let i = 0; i < d.laps.length; i++) {
      const l = d.laps[i];
      await sql`
        INSERT INTO strava_activity_laps (id, activity_id, lap_index, name, distance, moving_time, elapsed_time, total_elevation_gain,
          average_speed, max_speed, average_cadence, average_watts, average_heartrate, max_heartrate, start_index, end_index, lap_split)
        VALUES (${createId()}, ${row.id}, ${i + 1}, ${l.name ?? null}, ${l.distance ?? null}, ${l.moving_time ?? null}, ${l.elapsed_time ?? null},
          ${l.total_elevation_gain ?? null}, ${l.average_speed ?? null}, ${l.max_speed ?? null}, ${l.average_cadence ?? null},
          ${l.average_watts ?? null}, ${l.average_heartrate ?? null}, ${l.max_heartrate ?? null}, ${l.start_index ?? null},
          ${l.end_index ?? null}, ${l.split ?? null})`;
    }
  }
  if (d.splits_metric?.length) {
    await sql`DELETE FROM strava_activity_splits WHERE activity_id = ${row.id}`;
    for (let i = 0; i < d.splits_metric.length; i++) {
      const s = d.splits_metric[i];
      await sql`
        INSERT INTO strava_activity_splits (id, activity_id, split_index, distance, moving_time, elapsed_time, average_speed,
          elevation_difference, pace_zone, average_heartrate, average_grade_adjusted_speed)
        VALUES (${createId()}, ${row.id}, ${i + 1}, ${s.distance ?? null}, ${s.moving_time ?? null}, ${s.elapsed_time ?? null},
          ${s.average_speed ?? null}, ${s.elevation_difference ?? null}, ${s.pace_zone ?? null}, ${s.average_heartrate ?? null},
          ${s.average_grade_adjusted_speed ?? null})`;
    }
  }
}

/** Stores the streams (key_by_type response), the HR zone times they give, and the TSS from the samples. */
export async function storeStreams(sql, row, body, hrZones, { rebuild = true } = {}) {
  await ensureRow(sql, row.id);
  const keys = Object.keys(body ?? {}).filter((k) => Array.isArray(body[k]?.data));
  if (keys.length) {
    await sql`DELETE FROM strava_activity_streams WHERE activity_id = ${row.id}`;
    for (const k of keys) {
      const s = body[k];
      await sql`
        INSERT INTO strava_activity_streams (id, activity_id, stream_type, resolution, original_size, data)
        VALUES (${createId()}, ${row.id}, ${k}, ${s.resolution ?? null}, ${s.original_size ?? null}, ${JSON.stringify(s.data)})`;
    }
    const zt = hrZones?.length && body.heartrate?.data ? zoneTimes(body.heartrate.data, body.time?.data, hrZones) : null;
    if (zt) await sql`UPDATE strava_activities SET zone_times = ${JSON.stringify(zt)} WHERE id = ${row.id}`;
    // The samples give a better TSS than the averages; CTL and ATL follow it.
    const userId = row.user_id ?? (await sql`SELECT user_id FROM strava_activities WHERE id = ${row.id}`)[0]?.user_id;
    if (userId && rebuild) {
      await storeActivityTss(sql, row.id, thresholdValues(await loadThresholds(sql, userId)));
      await rebuildTrainingLoad(sql, userId, () => {});
    }
  }
  await sql`UPDATE strava_activity_details SET streams_fetched_at = NOW(), updated_at = NOW() WHERE activity_id = ${row.id}`;
}

/**
 * The weather at the activity's start from Open-Meteo: the archive (ERA5) for older days, the forecast API (which
 * keeps the recent past) for the last days the archive does not have yet.
 */
export async function fetchWeather(lat, lon, startIso, fetchImpl = fetch) {
  const day = startIso.slice(0, 10);
  const hourly = 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,precipitation';
  const recent = Date.now() - Date.parse(startIso) < 6 * 86_400_000;
  const bases = recent
    ? ['https://api.open-meteo.com/v1/forecast', 'https://archive-api.open-meteo.com/v1/archive']
    : ['https://archive-api.open-meteo.com/v1/archive', 'https://api.open-meteo.com/v1/forecast'];
  for (const base of bases) {
    const u = new URL(base);
    u.searchParams.set('latitude', Number(lat).toFixed(3));
    u.searchParams.set('longitude', Number(lon).toFixed(3));
    u.searchParams.set('start_date', day);
    u.searchParams.set('end_date', day);
    u.searchParams.set('hourly', hourly);
    u.searchParams.set('timezone', 'GMT');
    u.searchParams.set('wind_speed_unit', 'kmh');
    const r = await fetchImpl(u, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) continue;
    const w = pickHour(await r.json(), startIso);
    if (w) return { ...w, source: base.includes('archive') ? 'open-meteo-archive' : 'open-meteo' };
  }
  return null;
}

/** The place name of a start point from OpenStreetMap's Nominatim (1 request; its policy asks for a user agent). */
export async function fetchPlace(lat, lon, fetchImpl = fetch) {
  const u = new URL('https://nominatim.openstreetmap.org/reverse');
  u.searchParams.set('format', 'jsonv2');
  u.searchParams.set('lat', Number(lat).toFixed(4));
  u.searchParams.set('lon', Number(lon).toFixed(4));
  u.searchParams.set('zoom', '10');
  u.searchParams.set('accept-language', 'en');
  const r = await fetchImpl(u, { headers: { 'User-Agent': 'Coach/1.0 (personal training app)' }, signal: AbortSignal.timeout(5000) });
  return r.ok ? placeName(await r.json()) : null;
}

/**
 * Fetches and stores whatever the activity still lacks. Never throws for a Strava or weather failure: the error is
 * stored in fetch_error and returned.
 * @param {import('@neondatabase/serverless').NeonQueryFunction<false, false>} sql
 * @param {string} activityRowId  strava_activities.id
 * @param {{ allowTokenRefresh?: boolean, force?: boolean, env?: Record<string, string | undefined>, fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<{ fetched: string[], skipped: string | null, error: string | null }>}
 */
export async function fetchActivityParts(sql, activityRowId, opts = {}) {
  const env = opts.env ?? process.env;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const allowTokenRefresh = opts.allowTokenRefresh ?? refreshAllowed(env);
  const out = { fetched: [], skipped: null, error: null };
  const [row] = await sql`SELECT id, user_id, strava_activity_id, start_date, start_latlng FROM strava_activities WHERE id = ${activityRowId}`;
  if (!row) return { ...out, skipped: 'not found' };
  const need = await missingParts(sql, activityRowId);
  if (opts.force) Object.assign(need, { detail: true, streams: true, retryLater: false });
  if (need.retryLater) return { ...out, skipped: 'retry later' };

  try {
    if (need.detail || need.streams) {
      const token = await accessToken(sql, env, allowTokenRefresh);
      if (!token) {
        out.skipped = 'token expired, refresh off';
      } else {
        const get = async (url) => {
          const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
          if (res.status === 404) return null;
          if (!res.ok) throw new Error(`Strava ${res.status} ${(await res.text()).slice(0, 160)}`);
          return res.json();
        };
        const id = encodeURIComponent(String(row.strava_activity_id));
        if (need.detail) {
          const d = await get(`https://www.strava.com/api/v3/activities/${id}?include_all_efforts=true`);
          if (d) await storeDetail(sql, row, d);
          else await sql`INSERT INTO strava_activity_details (activity_id, detail_fetched_at) VALUES (${row.id}, NOW())
                         ON CONFLICT (activity_id) DO UPDATE SET detail_fetched_at = NOW(), updated_at = NOW()`;
          out.fetched.push('detail');
        }
        if (need.streams) {
          const body = await get(`https://www.strava.com/api/v3/activities/${id}/streams?keys=${STREAM_KEYS.join(',')}&key_by_type=true`);
          const [p] = await sql`SELECT hr_zones FROM strava_athlete_profile WHERE user_id = ${row.user_id} LIMIT 1`;
          await storeStreams(sql, row, body ?? {}, p?.hr_zones?.zones ?? []);
          out.fetched.push('streams');
        }
      }
    }
    if (need.weather) {
      // Read the start again: storeDetail corrects it.
      // As text in SQL: drivers turn a timestamp without zone into a Date in the server's zone.
      const [a] = await sql`SELECT to_char(start_date, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS start_iso FROM strava_activities WHERE id = ${row.id}`;
      const start = toIso(a?.start_iso);
      if (!start) throw new Error('activity has no start time');
      const [lat, lon] = row.start_latlng;
      const [w, place] = await Promise.all([fetchWeather(lat, lon, start, fetchImpl), fetchPlace(lat, lon, fetchImpl).catch(() => null)]);
      await ensureRow(sql, row.id);
      await sql`UPDATE strava_activity_details SET weather = ${w ? JSON.stringify(w) : null}, place = COALESCE(${place}, place),
                weather_fetched_at = NOW(), updated_at = NOW()
                WHERE activity_id = ${row.id}`;
      out.fetched.push('weather');
    }
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
    await ensureRow(sql, row.id);
    await sql`UPDATE strava_activity_details SET fetch_error = ${out.error.slice(0, 300)}, updated_at = NOW() WHERE activity_id = ${row.id}`;
  }
  return out;
}
