/**
 * Strava sync, shared by scripts/strava-backfill.mjs (CLI) and the server (webhook + daily cron).
 *
 * Incremental by default: it fetches activities since last_synced_at minus 24 h.
 * It stores tss, tss_method and zone_times per activity (tss.mjs), then rebuilds daily_training_load (CTL/ATL/TSB).
 * A new activity also gets its streams (1 call), so its TSS comes from the samples, not the averages.
 * Rate limits: 100 req / 15 min, 1000 / day. Throttled.
 */

import { createId } from '@paralleldrive/cuid2';
import { STREAM_KEYS, storeDetail, storeStreams } from '../activity/fetch.mjs';
import { connectionWithToken } from './token.mjs';
import { rebuildTrainingLoad } from './load.mjs';

export { connectionWithToken } from './token.mjs';
export { loadSeries, rebuildTrainingLoad } from './load.mjs';
import { tssFromInputs, tssInputs, thresholdValues } from './tss.mjs';
import { loadThresholds } from './thresholds.mjs';



/**
 * Start times for the timestamp (no zone) columns, as text. Strava sends start_date in UTC and start_date_local as
 * local wall time (both ending in Z). A Date would be written in the machine's time zone by the Neon driver, so a
 * sync on a laptop in US Pacific stored every start 7 h early. Text goes in as written.
 */
export function activityTimes(a) {
  const plain = (v) => (typeof v === 'string' ? v.replace(/Z$/, '') : null);
  return { startDate: plain(a.start_date), startLocal: plain(a.start_date_local) };
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
  /** The rows this sync inserted (new activities), for the "workout completed" notice. */
  const created = [];
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
      created.push({ id: activityRowId, stravaId: String(a.id) });
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

    // Detail: description, laps, splits (with grade-adjusted pace), best efforts, gear (the activity page's writer).
    const row = { id: activityRowId, user_id: conn.user_id };
    if (detailed) {
      try {
        await storeDetail(sql, row, await stravaFetch(`https://www.strava.com/api/v3/activities/${a.id}?include_all_efforts=true`));
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
        const body = await stravaFetch(`https://www.strava.com/api/v3/activities/${a.id}/streams?keys=${STREAM_KEYS.join(',')}&key_by_type=true`);
        await storeStreams(sql, row, body, hrZones, { rebuild: false });
        for (const [key, s] of Object.entries(body ?? {})) if (Array.isArray(s?.data)) stored[key] = s.data;
        streamCount++;
      } catch (e) {
        warn(`Streams fetch failed for ${a.id}:`, e.message);
      }
    } else {
      // Streams from an earlier pull (the activity page, the backfill) still count: their summary is stored.
      const [prev] = await sql`SELECT tss_inputs FROM strava_activities WHERE id = ${activityRowId}`;
      inputs = prev?.tss_inputs ?? null;
    }

    // ===== TSS (storeStreams wrote the zone times) =====
    if (Object.keys(stored).length) inputs = tssInputs(stored);
    const { tss, method } = tssFromInputs(a, th, inputs);
    await sql`
      UPDATE strava_activities
      SET tss = ${tss}, tss_method = ${method}, tss_inputs = ${inputs ? JSON.stringify(inputs) : null}, updated_at = NOW()
      WHERE id = ${activityRowId}`;

    if (upsertCount % 10 === 0) log(`  upserted ${upsertCount}/${activities.length}…`);
  }

  log(`\nDone. Activities upserted: ${upsertCount}, detailed: ${detailedCount}, streams: ${streamCount}.`);
  log(`Strava API calls used in current window: ${apiCallsInWindow}.`);

  await rebuildTrainingLoad(sql, conn.user_id, log);

  await sql`UPDATE strava_connections SET last_synced_at = NOW() WHERE id = ${conn.id}`;
  return { upserted: upsertCount, detailed: detailedCount, streams: streamCount, apiCalls: apiCallsInWindow, created };
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
