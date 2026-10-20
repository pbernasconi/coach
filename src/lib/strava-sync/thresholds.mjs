// The athlete's thresholds for TSS, read from the database (tss.mjs resolveThresholds has the rules), and the TSS of
// one stored activity from its stored streams.

import { resolveThresholds, thresholdValues, tssFromInputs, tssInputs } from './tss.mjs';

const STREAMS_FOR_TSS = ['time', 'heartrate', 'watts', 'velocity_smooth', 'grade_smooth'];

/**
 * The thresholds with their sources: Settings (users.settings.thresholds), Garmin (the last 120 days), Strava
 * (FTP and HR zones) and the best run times of the last 365 days.
 * @param {import('@neondatabase/serverless').NeonQueryFunction<false, false>} sql
 * @param {string} userId
 */
export async function loadThresholds(sql, userId) {
  return resolveThresholds(await loadThresholdSources(sql, userId));
}

/** The inputs of resolveThresholds, from the database. With settings: null they give the automatic values. */
export async function loadThresholdSources(sql, userId) {
  const [[u], [p], garmin, [best]] = await Promise.all([
    sql`SELECT settings -> 'thresholds' AS t FROM users WHERE id = ${userId}`,
    sql`SELECT ftp, hr_zones FROM strava_athlete_profile WHERE user_id = ${userId} ORDER BY updated_at DESC LIMIT 1`,
    sql`
      SELECT DISTINCT ON (metric) metric, value FROM health_samples
      WHERE user_id = ${userId} AND metric IN ('resting_hr_7d_avg_bpm', 'lactate_threshold_hr_bpm', 'lactate_threshold_pace_s_per_km')
        AND date >= CURRENT_DATE - 120
      ORDER BY metric, date DESC`,
    sql`
      SELECT min(p.value) FILTER (WHERE p.span = 10000) AS best10k, min(p.value) FILTER (WHERE p.span = 5000) AS best5k
      FROM activity_peaks p
      JOIN strava_activities a ON a.user_id = p.user_id AND a.strava_activity_id = p.strava_activity_id
      WHERE p.user_id = ${userId} AND p.metric = 'run' AND a.start_date_local >= NOW() - INTERVAL '365 days'`,
  ]);
  const g = Object.fromEntries(garmin.map((r) => [r.metric, Number(r.value)]));
  return {
    settings: u?.t ?? null,
    stravaFtp: p?.ftp ?? null,
    stravaHrZones: p?.hr_zones?.zones ?? p?.hr_zones ?? null,
    restingHr: g.resting_hr_7d_avg_bpm ?? null,
    garminLthr: g.lactate_threshold_hr_bpm ?? null,
    garminLtPaceS: g.lactate_threshold_pace_s_per_km ?? null,
    best10kS: best?.best10k != null ? Number(best.best10k) : null,
    best5kS: best?.best5k != null ? Number(best.best5k) : null,
  };
}

/** The streams computeTss reads, for one stored activity (null when it has none). */
export async function storedTssStreams(sql, activityRowId) {
  const rows = await sql`
    SELECT stream_type, data FROM strava_activity_streams
    WHERE activity_id = ${activityRowId} AND stream_type = ANY(${STREAMS_FOR_TSS})`;
  if (!rows.length) return null;
  return Object.fromEntries(rows.map((r) => [r.stream_type, r.data]));
}

/**
 * Computes and stores the TSS of one stored activity from its row and stored streams (and their summary).
 * @param {{ ftp?: number | null, runLthr?: number | null, rideLthr?: number | null, restingHr?: number | null, runPaceS?: number | null }} th  thresholdValues(...)
 * @returns {Promise<{ tss: number, method: string, intensity: number | null } | null>}
 */
export async function storeActivityTss(sql, activityRowId, th) {
  const [a] = await sql`
    SELECT id, type, sport_type, moving_time, elapsed_time, weighted_average_watts, device_watts, average_heartrate
    FROM strava_activities WHERE id = ${activityRowId}`;
  if (!a) return null;
  const inputs = tssInputs(await storedTssStreams(sql, activityRowId));
  const r = tssFromInputs(a, th, inputs);
  await sql`
    UPDATE strava_activities SET tss = ${r.tss}, tss_method = ${r.method}, tss_inputs = ${inputs ? JSON.stringify(inputs) : null}, updated_at = NOW()
    WHERE id = ${activityRowId}`;
  return r;
}

/**
 * Recomputes the TSS of every activity of a user with the current thresholds, from the stored summaries
 * (tss_inputs). An activity with streams and no summary yet gets one first. One write for all changes.
 * @returns {Promise<{ thresholds: ReturnType<typeof resolveThresholds>, total: number, changed: number,
 *   bySport: Record<string, { n: number, before: number, after: number, methods: Record<string, number> }> }>}
 */
export async function recomputeAllTss(sql, userId, { dryRun = false } = {}) {
  const thresholds = await loadThresholds(sql, userId);
  const th = thresholdValues(thresholds);
  const rows = await sql`
    SELECT id, type, sport_type, moving_time, elapsed_time, weighted_average_watts, device_watts, average_heartrate, tss, tss_method, tss_inputs,
           (tss_inputs IS NULL AND EXISTS (SELECT 1 FROM strava_activity_streams s WHERE s.activity_id = a.id)) AS needs_inputs
    FROM strava_activities a WHERE user_id = ${userId}`;
  const bySport = {};
  const changed = [];
  for (const r of rows) {
    let inputs = r.tss_inputs ?? null;
    let newInputs = false;
    if (r.needs_inputs) {
      inputs = tssInputs(await storedTssStreams(sql, r.id));
      newInputs = inputs != null;
    }
    const { tss, method } = tssFromInputs(r, th, inputs);
    const s = (bySport[r.sport_type] ??= { n: 0, before: 0, after: 0, methods: {} });
    s.n++;
    s.before += Number(r.tss ?? 0);
    s.after += tss;
    s.methods[method] = (s.methods[method] ?? 0) + 1;
    if (newInputs || Number(r.tss) !== tss || r.tss_method !== method) changed.push({ id: r.id, tss, method, inputs: inputs ? JSON.stringify(inputs) : null });
  }
  if (!dryRun && changed.length) {
    await sql`
      UPDATE strava_activities a SET tss = x.tss, tss_method = x.method, tss_inputs = x.inputs::jsonb, updated_at = NOW()
      FROM unnest(${changed.map((c) => c.id)}::text[], ${changed.map((c) => c.tss)}::real[], ${changed.map((c) => c.method)}::text[],
                  ${changed.map((c) => c.inputs)}::text[]) AS x(id, tss, method, inputs)
      WHERE a.id = x.id`;
  }
  return { thresholds, total: rows.length, changed: changed.length, bySport };
}
