#!/usr/bin/env node
/**
 * Recompute TSS for every stored Strava activity with the current rules (src/lib/strava-sync/sync.mjs
 * computeTss), then rebuild daily_training_load. No Strava calls: it uses the stored activity fields.
 *
 *   node --env-file=.env.local scripts/recompute-tss.mjs --dry-run   # counts only
 *   node --env-file=.env.local scripts/recompute-tss.mjs
 */
import { neon } from '@neondatabase/serverless';
import { computeTss, rebuildTrainingLoad } from '../src/lib/strava-sync/sync.mjs';

const dryRun = process.argv.includes('--dry-run');
const sql = neon(process.env.DATABASE_URL);

const users = await sql`SELECT DISTINCT user_id FROM strava_activities`;
for (const { user_id: userId } of users) {
  const [prof] = await sql`SELECT ftp, hr_zones FROM strava_athlete_profile WHERE user_id = ${userId} ORDER BY updated_at DESC LIMIT 1`;
  const zones = prof?.hr_zones?.zones ?? prof?.hr_zones ?? [];
  const athlete = { ftp: prof?.ftp ?? null, thresholdHr: zones[2]?.max ?? 168 };
  const rows = await sql`
    SELECT id, type, sport_type, moving_time, elapsed_time, weighted_average_watts, device_watts, average_heartrate, tss, tss_method
    FROM strava_activities WHERE user_id = ${userId}`;
  const changed = [];
  for (const r of rows) {
    const { tss, method } = computeTss(r, athlete);
    if (Number(r.tss) !== tss || r.tss_method !== method) changed.push({ id: r.id, tss, method, was: Number(r.tss), wasMethod: r.tss_method, sport: r.sport_type });
  }
  const bySport = {};
  for (const c of changed) bySport[c.sport] = (bySport[c.sport] ?? 0) + 1;
  const before = changed.reduce((n, c) => n + c.was, 0);
  const after = changed.reduce((n, c) => n + c.tss, 0);
  console.log(`user ${userId.slice(0, 8)}…: ${rows.length} activities, ${changed.length} change`, bySport, `TSS of those: ${Math.round(before)} → ${Math.round(after)}`);
  if (dryRun || !changed.length) continue;
  for (const c of changed) await sql`UPDATE strava_activities SET tss = ${c.tss}, tss_method = ${c.method}, updated_at = NOW() WHERE id = ${c.id}`;
  await rebuildTrainingLoad(sql, userId);
}
