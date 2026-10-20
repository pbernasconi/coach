/**
 * Strava sync, shared by scripts/strava-backfill.mjs (CLI) and the server (webhook + daily cron).
 *
 * Incremental by default: it fetches activities since last_synced_at minus 24 h.
 * It stores tss, tss_method and zone_times per activity (tss.mjs), then rebuilds daily_training_load (CTL/ATL/TSB).
 * A new activity also gets its streams (1 call), so its TSS comes from the samples, not the averages.
 * Rate limits: 100 req / 15 min, 1000 / day. Throttled.
 */

import { createId } from '@paralleldrive/cuid2';
import { toDay } from '../db-time.mjs';
import { zoneTimes } from '../activity/streams.mjs';
import { tssFromInputs, tssInputs, thresholdValues } from './tss.mjs';
import { loadThresholds } from './thresholds.mjs';


// The same keys as the activity page's fetch (src/lib/activity/fetch.mjs STREAM_KEYS).
const STREAM_TYPES = ['time', 'distance', 'latlng', 'altitude', 'velocity_smooth', 'heartrate', 'cadence', 'watts', 'temp', 'moving', 'grade_smooth'];

/**
 * Start times for the timestamp (no zone) columns, as text. Strava sends start_date in UTC and start_date_local as
 * local wall time (both ending in Z). A Date would be written in the machine's time zone by the Neon driver, so a
 * sync on a laptop in US Pacific stored every start 7 h early. Text goes in as written.
 */
export function activityTimes(a) {
  const plain = (v) => (typeof v === 'string' ? v.replace(/Z$/, '') : null);
  return { startDate: plain(a.start_date), startLocal: plain(a.start_date_local) };
}

/** The single Strava connection and a valid access token. It refreshes and saves the token when it expires in 5 min. */
export async function connectionWithToken(sql, env = process.env, log = console.log) {
  const [conn] = await sql`SELECT id, athlete_id, refresh_token, access_token, expires_at, user_id, last_synced_at FROM strava_connections LIMIT 1`;
  if (!conn) throw new Error('No Strava connection in DB');

  let accessToken = conn.access_token;
  const now = Math.floor(Date.now() / 1000);
  if (conn.expires_at <= now + 300) {
    if (!env.STRAVA_CLIENT_ID || !env.STRAVA_CLIENT_SECRET) throw new Error('STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET are not set');
    log('Refreshing access token…');
    const res = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.STRAVA_CLIENT_ID,
        client_secret: env.STRAVA_CLIENT_SECRET,
        refresh_token: conn.refresh_token,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status} ${await res.text()}`);
    const tok = await res.json();
    accessToken = tok.access_token;
    await sql`
      UPDATE strava_connections
         SET access_token = ${tok.access_token},
             refresh_token = ${tok.refresh_token},
             expires_at = ${tok.expires_at},
             updated_at = NOW()
       WHERE id = ${conn.id}`;
    log(`Token refreshed; expires ${new Date(tok.expires_at * 1000).toISOString()}`);
  }
  return { conn, accessToken };
}

/**
 * @param {import('@neondatabase/serverless').NeonQueryFunction<false, false>} sql
 * streams: true fetches the streams of every listed activity; 'new' (the server's default) only of new ones.
 * @param {{ days?: number | null, detailed?: boolean, streams?: boolean | 'new', force?: boolean, waitOnRateLimit?: boolean,
 *          env?: Record<string, string | undefined>, log?: (...a: unknown[]) => void, warn?: (...a: unknown[]) => void }} [opts]
 */
export async function syncStrava(sql, opts = {}) {
  const days = opts.days ?? null; // null = incremental
  const streams = opts.streams === 'new' ? 'new' : Boolean(opts.streams);
  const detailed = Boolean(opts.detailed) || streams === true;
  const force = Boolean(opts.force);
  const env = opts.env ?? process.env;
  const log = opts.log ?? console.log;
  const warn = opts.warn ?? console.warn;
  // A server function cannot wait 15 minutes; it stops and the next webhook or cron run continues.
  const waitOnRateLimit = opts.waitOnRateLimit ?? true;

  // ===== 1. Load + refresh token =====
  const { conn, accessToken } = await connectionWithToken(sql, env, log);

  // ===== 2. Throttled fetch =====
  let apiCallsInWindow = 0;
  let windowStart = Date.now();
  async function stravaFetch(url) {
    // Rate limit: 100/15min. Pause if close.
    if (apiCallsInWindow >= 95) {
      if (!waitOnRateLimit) throw new Error('Strava rate limit cushion reached');
      const elapsed = Date.now() - windowStart;
      const waitMs = Math.max(0, 15 * 60 * 1000 - elapsed) + 5_000;
      log(`Rate limit cushion — sleeping ${Math.round(waitMs / 1000)}s`);
      await new Promise((r) => setTimeout(r, waitMs));
      apiCallsInWindow = 0;
      windowStart = Date.now();
    }
    apiCallsInWindow++;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.status === 429) {
      if (!waitOnRateLimit) throw new Error('Strava rate limit (429)');
      warn('Hit 429. Sleeping 16 min and retrying once.');
      await new Promise((r) => setTimeout(r, 16 * 60 * 1000));
      apiCallsInWindow = 0;
      windowStart = Date.now();
      return stravaFetch(url);
    }
    if (!res.ok) throw new Error(`${url} -> ${res.status} ${await res.text()}`);
    return res.json();
  }

  // ===== 3. Athlete profile + zones (2 calls) =====
  log('Fetching athlete profile + zones…');
  const athlete = await stravaFetch('https://www.strava.com/api/v3/athlete');
  let zones = null;
  try { zones = await stravaFetch('https://www.strava.com/api/v3/athlete/zones'); }
  catch (e) { warn('Zones unavailable:', e.message); }

  await sql`
    INSERT INTO strava_athlete_profile
      (athlete_id, user_id, sex, weight_kg, ftp, hr_zones, power_zones, pace_zones, threshold_hr, max_hr, created_at, updated_at)
    VALUES
      (${athlete.id}, ${conn.user_id}, ${athlete.sex ?? null}, ${athlete.weight ?? null}, ${athlete.ftp ?? null},
       ${zones?.heart_rate ? JSON.stringify(zones.heart_rate) : null},
       ${zones?.power ? JSON.stringify(zones.power) : null},
       ${zones?.pace ? JSON.stringify(zones.pace) : null},
       ${null}, ${null}, NOW(), NOW())
    ON CONFLICT (athlete_id) DO UPDATE SET
      sex = EXCLUDED.sex, weight_kg = EXCLUDED.weight_kg, ftp = EXCLUDED.ftp,
      hr_zones = EXCLUDED.hr_zones, power_zones = EXCLUDED.power_zones, pace_zones = EXCLUDED.pace_zones,
      updated_at = NOW()`;
  log(`Athlete: id=${athlete.id} weight=${athlete.weight}kg ftp=${athlete.ftp ?? 'unset'}`);
  if (zones?.heart_rate?.zones) log(`HR zones: ${zones.heart_rate.zones.map((z) => `${z.min}-${z.max === -1 ? '∞' : z.max}`).join(', ')}`);

  // Athlete context for TSS + zone-time compute
  const hrZones = zones?.heart_rate?.zones ?? [];
  // Read after the profile upsert above, so a new Strava FTP counts at once.
  const th = thresholdValues(await loadThresholds(sql, conn.user_id));

  // ===== 4. Compute sync window =====
  // Incremental by default — use last_synced_at minus a small overlap buffer.
  // --days N forces a window of N days. --force ignores last_synced_at.
  let after;
  let windowLabel;
  if (days != null) {
    after = Math.floor((Date.now() - days * 86_400_000) / 1000);
    windowLabel = `${days}d`;
  } else if (force) {
    after = Math.floor((Date.now() - 90 * 86_400_000) / 1000); // sensible default for forced
    windowLabel = '90d (forced)';
  } else {
    const lastSync = conn.last_synced_at ? new Date(conn.last_synced_at).getTime() : 0;
    if (lastSync > 0) {
      // 24h overlap buffer to catch any late-uploaded activities or edits
      after = Math.floor((lastSync - 24 * 3_600_000) / 1000);
      windowLabel = `incremental since ${new Date(after * 1000).toISOString().slice(0, 16)}`;
    } else {
      after = Math.floor((Date.now() - 90 * 86_400_000) / 1000);
      windowLabel = '90d (first run)';
    }
  }

  const activities = [];
  let page = 1;
  while (true) {
    const batch = await stravaFetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&page=${page}&per_page=100`);
    if (batch.length === 0) break;
    activities.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  log(`Sync window: ${windowLabel} → found ${activities.length} activities.`);

  // ===== 5. Upsert each =====
  let upsertCount = 0, detailedCount = 0, streamCount = 0;
  for (const a of activities) {
    const { startDate, startLocal } = activityTimes(a);

    // Upsert the activity row
    const [existing] = await sql`
      SELECT id FROM strava_activities
      WHERE user_id = ${conn.user_id} AND strava_activity_id = ${String(a.id)}
      LIMIT 1`;

    const fields = {
      name: a.name, type: a.type, sport_type: a.sport_type,
      distance: a.distance, moving_time: a.moving_time, elapsed_time: a.elapsed_time, total_elevation_gain: a.total_elevation_gain,
      start_date: startDate, start_date_local: startLocal, timezone: a.timezone,
      average_speed: a.average_speed, max_speed: a.max_speed,
      average_cadence: a.average_cadence ?? null,
      average_watts: a.average_watts ?? null,
      weighted_average_watts: a.weighted_average_watts ?? null,
      max_watts: a.max_watts ?? null,
      device_watts: a.device_watts ?? null,
      average_heartrate: a.average_heartrate ?? null,
      max_heartrate: a.max_heartrate ?? null,
      kilojoules: a.kilojoules ?? null,
      average_temp: a.average_temp ?? null,
      workout_type: a.workout_type ?? null,
      commute: a.commute ?? false,
      trainer: a.trainer ?? false,
      gear_id: a.gear_id ?? null,
      start_latlng: a.start_latlng ? JSON.stringify(a.start_latlng) : null,
      location_city: a.location_city ?? null,
      location_state: a.location_state ?? null,
      location_country: a.location_country ?? null,
      elev_high: a.elev_high ?? null,
      elev_low: a.elev_low ?? null,
      achievement_count: a.achievement_count ?? 0,
      pr_count: a.pr_count ?? 0,
      kudos_count: a.kudos_count ?? 0,
      comment_count: a.comment_count ?? 0,
    };

    let activityRowId;
    if (existing) {
      activityRowId = existing.id;
      await sql`
        UPDATE strava_activities SET
          name = ${fields.name}, type = ${fields.type}, sport_type = ${fields.sport_type},
          distance = ${fields.distance}, moving_time = ${fields.moving_time}, elapsed_time = ${fields.elapsed_time},
          total_elevation_gain = ${fields.total_elevation_gain},
          start_date = ${fields.start_date}, start_date_local = ${fields.start_date_local}, timezone = ${fields.timezone},
          average_speed = ${fields.average_speed}, max_speed = ${fields.max_speed},
          average_cadence = ${fields.average_cadence},
          average_watts = ${fields.average_watts}, weighted_average_watts = ${fields.weighted_average_watts},
          max_watts = ${fields.max_watts}, device_watts = ${fields.device_watts},
          average_heartrate = ${fields.average_heartrate}, max_heartrate = ${fields.max_heartrate},
          kilojoules = ${fields.kilojoules}, average_temp = ${fields.average_temp},
          workout_type = ${fields.workout_type}, commute = ${fields.commute}, trainer = ${fields.trainer},
          gear_id = ${fields.gear_id}, start_latlng = ${fields.start_latlng},
          location_city = ${fields.location_city}, location_state = ${fields.location_state}, location_country = ${fields.location_country},
          elev_high = ${fields.elev_high}, elev_low = ${fields.elev_low},
          achievement_count = ${fields.achievement_count}, pr_count = ${fields.pr_count},
          kudos_count = ${fields.kudos_count}, comment_count = ${fields.comment_count},
          updated_at = NOW()
        WHERE id = ${existing.id}`;
    } else {
      activityRowId = createId();
      await sql`
        INSERT INTO strava_activities (
          id, user_id, connection_id, strava_activity_id,
          name, type, sport_type,
          distance, moving_time, elapsed_time, total_elevation_gain,
          start_date, start_date_local, timezone,
          average_speed, max_speed,
          average_cadence, average_watts, weighted_average_watts, max_watts, device_watts,
          average_heartrate, max_heartrate, kilojoules, average_temp,
          workout_type, commute, trainer, gear_id,
          start_latlng, location_city, location_state, location_country,
          elev_high, elev_low, achievement_count, pr_count,
          kudos_count, comment_count
        ) VALUES (
          ${activityRowId}, ${conn.user_id}, ${conn.id}, ${String(a.id)},
          ${fields.name}, ${fields.type}, ${fields.sport_type},
          ${fields.distance}, ${fields.moving_time}, ${fields.elapsed_time}, ${fields.total_elevation_gain},
          ${fields.start_date}, ${fields.start_date_local}, ${fields.timezone},
          ${fields.average_speed}, ${fields.max_speed},
          ${fields.average_cadence}, ${fields.average_watts}, ${fields.weighted_average_watts}, ${fields.max_watts}, ${fields.device_watts},
          ${fields.average_heartrate}, ${fields.max_heartrate}, ${fields.kilojoules}, ${fields.average_temp},
          ${fields.workout_type}, ${fields.commute}, ${fields.trainer}, ${fields.gear_id},
          ${fields.start_latlng}, ${fields.location_city}, ${fields.location_state}, ${fields.location_country},
          ${fields.elev_high}, ${fields.elev_low}, ${fields.achievement_count}, ${fields.pr_count},
          ${fields.kudos_count}, ${fields.comment_count}
        )`;
    }
    upsertCount++;

    // Optional: detailed pull
    if (detailed) {
      try {
        const detail = await stravaFetch(`https://www.strava.com/api/v3/activities/${a.id}?include_all_efforts=false`);
        await sql`
          UPDATE strava_activities
          SET description = ${detail.description ?? null},
              suffer_score = ${detail.suffer_score ?? null},
              updated_at = NOW()
          WHERE id = ${activityRowId}`;

        // Laps
        if (detail.laps && detail.laps.length > 0) {
          await sql`DELETE FROM strava_activity_laps WHERE activity_id = ${activityRowId}`;
          for (let i = 0; i < detail.laps.length; i++) {
            const l = detail.laps[i];
            await sql`
              INSERT INTO strava_activity_laps (
                id, activity_id, lap_index, name, distance, moving_time, elapsed_time,
                total_elevation_gain, average_speed, max_speed, average_cadence, average_watts,
                average_heartrate, max_heartrate, start_index, end_index, lap_split
              ) VALUES (
                ${createId()}, ${activityRowId}, ${i + 1}, ${l.name ?? null},
                ${l.distance ?? null}, ${l.moving_time ?? null}, ${l.elapsed_time ?? null},
                ${l.total_elevation_gain ?? null}, ${l.average_speed ?? null}, ${l.max_speed ?? null},
                ${l.average_cadence ?? null}, ${l.average_watts ?? null},
                ${l.average_heartrate ?? null}, ${l.max_heartrate ?? null},
                ${l.start_index ?? null}, ${l.end_index ?? null}, ${l.split ?? null}
              )`;
          }
        }

        // Splits (metric)
        if (detail.splits_metric && detail.splits_metric.length > 0) {
          await sql`DELETE FROM strava_activity_splits WHERE activity_id = ${activityRowId}`;
          for (let i = 0; i < detail.splits_metric.length; i++) {
            const s = detail.splits_metric[i];
            await sql`
              INSERT INTO strava_activity_splits (
                id, activity_id, split_index, distance, moving_time, elapsed_time,
                average_speed, elevation_difference, pace_zone, average_heartrate
              ) VALUES (
                ${createId()}, ${activityRowId}, ${i + 1},
                ${s.distance ?? null}, ${s.moving_time ?? null}, ${s.elapsed_time ?? null},
                ${s.average_speed ?? null}, ${s.elevation_difference ?? null},
                ${s.pace_zone ?? null}, ${s.average_heartrate ?? null}
              )`;
          }
        }
        detailedCount++;
      } catch (e) {
        warn(`Detail fetch failed for ${a.id}:`, e.message);
      }
    }

    // Streams: every activity (streams: true), or only a new one with some duration (streams: 'new').
    const stored = {};
    let inputs = null;
    const wantStreams = streams === true || (streams === 'new' && !existing && (a.moving_time ?? 0) >= 300);
    if (wantStreams) {
      try {
        const streamsUrl = `https://www.strava.com/api/v3/activities/${a.id}/streams?keys=${STREAM_TYPES.join(',')}&key_by_type=true`;
        const streams = await stravaFetch(streamsUrl);
        await sql`DELETE FROM strava_activity_streams WHERE activity_id = ${activityRowId}`;
        for (const key of Object.keys(streams)) {
          const s = streams[key];
          if (!s?.data) continue;
          stored[key] = s.data;
          await sql`
            INSERT INTO strava_activity_streams (id, activity_id, stream_type, resolution, original_size, data)
            VALUES (${createId()}, ${activityRowId}, ${key}, ${s.resolution ?? null}, ${s.original_size ?? null}, ${JSON.stringify(s.data)})`;
        }
        await sql`
          INSERT INTO strava_activity_details (activity_id, streams_fetched_at) VALUES (${activityRowId}, NOW())
          ON CONFLICT (activity_id) DO UPDATE SET streams_fetched_at = NOW(), updated_at = NOW()`;
        streamCount++;
      } catch (e) {
        warn(`Streams fetch failed for ${a.id}:`, e.message);
      }
    } else {
      // Streams from an earlier pull (the activity page, the backfill) still count: their summary is stored.
      const [row] = await sql`SELECT tss_inputs FROM strava_activities WHERE id = ${activityRowId}`;
      inputs = row?.tss_inputs ?? null;
    }

    // ===== Compute TSS + zone_times and persist =====
    if (Object.keys(stored).length) inputs = tssInputs(stored);
    const { tss, method } = tssFromInputs(a, th, inputs);
    const zt = stored.heartrate ? zoneTimes(stored.heartrate, stored.time, hrZones) : null;
    await sql`
      UPDATE strava_activities
      SET tss = ${tss}, tss_method = ${method}, tss_inputs = ${inputs ? JSON.stringify(inputs) : null},
          zone_times = COALESCE(${zt ? JSON.stringify(zt) : null}::jsonb, zone_times), updated_at = NOW()
      WHERE id = ${activityRowId}`;

    if (upsertCount % 10 === 0) log(`  upserted ${upsertCount}/${activities.length}…`);
  }

  log(`\nDone. Activities upserted: ${upsertCount}, detailed: ${detailedCount}, streams: ${streamCount}.`);
  log(`Strava API calls used in current window: ${apiCallsInWindow}.`);

  await rebuildTrainingLoad(sql, conn.user_id, log);

  await sql`UPDATE strava_connections SET last_synced_at = NOW() WHERE id = ${conn.id}`;
  return { upserted: upsertCount, detailed: detailedCount, streams: streamCount, apiCalls: apiCallsInWindow };
}

const HOME_TIME_ZONE = 'America/Los_Angeles';

/**
 * Rebuilds daily_training_load (CTL/ATL/TSB) from the first activity to today, from strava_activities.tss. The whole
 * history: a TSS change on an old activity changes every day after it. One write for all days.
 */
export async function rebuildTrainingLoad(sql, userId, log = console.log) {
  const acts = await sql`
    SELECT start_date_local, tss
    FROM strava_activities
    WHERE user_id = ${userId} AND COALESCE(commute, false) = false AND tss IS NOT NULL
    ORDER BY start_date_local ASC`;
  const tssByDate = new Map();
  for (const row of acts) {
    const key = toDay(row.start_date_local); // the local day as written; new Date() would shift it by the machine's zone
    if (!key) continue;
    tssByDate.set(key, (tssByDate.get(key) ?? 0) + Number(row.tss));
  }
  if (tssByDate.size === 0) return;

  // The last day is today on the athlete's wall clock (home, or the newest activity's day when traveling ahead of
  // home), not today in UTC: at 18:00 in San Francisco UTC is already tomorrow, and that empty day lowered TSB.
  const homeToday = new Intl.DateTimeFormat('en-CA', { timeZone: HOME_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const rows = loadSeries(tssByDate, homeToday);
  const lastKey = rows.at(-1).date;

  // Drop days after the last one (an earlier run in UTC could have written tomorrow) and before the first.
  await sql`DELETE FROM daily_training_load WHERE user_id = ${userId} AND (date > ${lastKey} OR date < ${rows[0].date})`;
  await sql`
    INSERT INTO daily_training_load (id, user_id, date, tss, ctl, atl, tsb, computed_at)
    SELECT md5(${userId} || d::text), ${userId}, d, t, c, a, b, NOW()
    FROM unnest(${rows.map((r) => r.date)}::date[], ${rows.map((r) => r.tss)}::real[], ${rows.map((r) => r.ctl)}::real[],
                ${rows.map((r) => r.atl)}::real[], ${rows.map((r) => r.tsb)}::real[]) AS x(d, t, c, a, b)
    ON CONFLICT (user_id, date) DO UPDATE SET
      tss = EXCLUDED.tss, ctl = EXCLUDED.ctl, atl = EXCLUDED.atl, tsb = EXCLUDED.tsb, computed_at = NOW()`;
  const last = rows.at(-1);
  log(`Rebuilt daily_training_load: ${rows.length} day rows. Latest: ${last.date} CTL=${last.ctl} ATL=${last.atl} TSB=${last.tsb}`);
}

/**
 * CTL (42-day) and ATL (7-day) for each day from the first day with TSS to `today` (or the last TSS day, if later).
 * @param {Map<string, number>} tssByDate  YYYY-MM-DD → the day's TSS
 */
export function loadSeries(tssByDate, today) {
  const days = [...tssByDate.keys()].sort();
  const lastKey = [today, days.at(-1)].sort().at(-1);
  const end = new Date(`${lastKey}T00:00:00Z`);
  let ctl = 0;
  let atl = 0;
  const rows = [];
  for (let d = new Date(`${days[0]}T00:00:00Z`); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const k = d.toISOString().slice(0, 10);
    const t = tssByDate.get(k) ?? 0;
    ctl += (t - ctl) / 42;
    atl += (t - atl) / 7;
    const r1 = (x) => Math.round(x * 10) / 10;
    rows.push({ date: k, tss: r1(t), ctl: r1(ctl), atl: r1(atl), tsb: r1(ctl - atl) });
  }
  return rows;
}

/** Removes one activity that was deleted on Strava. Laps, splits and streams cascade. */
export async function deleteStravaActivity(sql, stravaActivityId, env = process.env) {
  // The webhook has no signature, so ask Strava first: delete only when the activity is gone (404).
  const { accessToken } = await connectionWithToken(sql, env, () => {});
  const res = await fetch(`https://www.strava.com/api/v3/activities/${Number(stravaActivityId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status !== 404) return false;
  const gone = await sql`DELETE FROM strava_activities WHERE strava_activity_id = ${String(stravaActivityId)} RETURNING user_id`;
  // CTL and ATL must lose the deleted activity's TSS now, not at the next sync.
  for (const userId of new Set(gone.map((r) => r.user_id))) await rebuildTrainingLoad(sql, userId, () => {});
  return true;
}
