#!/usr/bin/env node
/**
 * Recompute TSS for every stored Strava activity with the current rules (src/lib/strava-sync/tss.mjs) and the
 * current thresholds (Settings, Garmin, Strava), then rebuild daily_training_load once.
 *
 * --fetch-streams first fetches the streams of activities that have none (1 Strava call each, newest first), so
 * their TSS comes from the samples. Strava allows 100 calls per 15 minutes and 1,000 a day: the script uses at most
 * 80 per window and waits out the rest, so the regular sync keeps room. Stop it at any point; a new run continues.
 *
 *   node --env-file=.env.local scripts/recompute-tss.mjs --dry-run                 # what would change, by sport
 *   node --env-file=.env.local scripts/recompute-tss.mjs
 *   node --env-file=.env.local scripts/recompute-tss.mjs --fetch-streams [--limit 300]
 */
import { neon } from '@neondatabase/serverless';
import { recomputeAllTss } from '../src/lib/strava-sync/thresholds.mjs';
import { connectionWithToken, rebuildTrainingLoad } from '../src/lib/strava-sync/sync.mjs';
import { STREAM_KEYS, storeStreams } from '../src/lib/activity/fetch.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const fetchStreams = args.includes('--fetch-streams');
const limit = Number(args[args.indexOf('--limit') + 1]) || Infinity;
const sql = neon(process.env.DATABASE_URL);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (fetchStreams && !dryRun) await backfillStreams();

const users = await sql`SELECT DISTINCT user_id FROM strava_activities`;
for (const { user_id: userId } of users) {
  const r = await recomputeAllTss(sql, userId, { dryRun });
  console.log('Thresholds:', Object.fromEntries(Object.entries(r.thresholds).map(([k, v]) => [k, `${v.value ?? '–'} (${v.source ?? 'none'})`])));
  console.table(Object.fromEntries(Object.entries(r.bySport).map(([k, v]) => [k, {
    n: v.n, 'TSS before': Math.round(v.before), 'TSS after': Math.round(v.after),
    change: `${Math.round(((v.after - v.before) / (v.before || 1)) * 100)} %`, methods: JSON.stringify(v.methods),
  }])));
  console.log(`${r.changed} of ${r.total} activities change${dryRun ? ' (dry run: nothing written)' : ''}.`);
  if (!dryRun && r.changed) await rebuildTrainingLoad(sql, userId);
}

/** Fetches the streams of activities without any, newest first, within the rate limit. */
async function backfillStreams() {
  const todo = await sql`
    SELECT a.id, a.user_id, a.strava_activity_id
    FROM strava_activities a
    LEFT JOIN strava_activity_details d ON d.activity_id = a.id
    WHERE COALESCE(a.moving_time, 0) >= 300
      AND (a.average_heartrate IS NOT NULL OR a.device_watts = true OR a.sport_type ~ 'Run$')
      AND d.streams_fetched_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM strava_activity_streams s WHERE s.activity_id = a.id)
    ORDER BY a.start_date DESC`;
  const list = todo.slice(0, limit);
  console.log(`Streams to fetch: ${todo.length}${list.length < todo.length ? ` (this run: ${list.length})` : ''}.`);
  const zonesByUser = new Map();
  let windowStart = Date.now();
  let inWindow = 0;
  let done = 0;
  for (const a of list) {
    if (inWindow >= 80) {
      const wait = Math.max(0, 15 * 60_000 - (Date.now() - windowStart)) + 5_000;
      console.log(`  ${done}/${list.length}: waiting ${Math.round(wait / 60_000)} min for the next Strava window…`);
      await sleep(wait);
      windowStart = Date.now();
      inWindow = 0;
    }
    const { accessToken } = await connectionWithToken(sql, process.env, () => {});
    inWindow++;
    const res = await fetch(
      `https://www.strava.com/api/v3/activities/${encodeURIComponent(a.strava_activity_id)}/streams?keys=${STREAM_KEYS.join(',')}&key_by_type=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (res.status === 429) {
      console.log('  Strava says the limit is reached (429). Run again later; the script continues where it stopped.');
      break;
    }
    if (!res.ok && res.status !== 404) {
      console.warn(`  ${a.strava_activity_id}: ${res.status}`);
      continue;
    }
    if (!zonesByUser.has(a.user_id)) {
      const [p] = await sql`SELECT hr_zones FROM strava_athlete_profile WHERE user_id = ${a.user_id} LIMIT 1`;
      zonesByUser.set(a.user_id, p?.hr_zones?.zones ?? []);
    }
    await storeStreams(sql, a, res.status === 404 ? {} : await res.json(), zonesByUser.get(a.user_id), { rebuild: false });
    done++;
    if (done % 20 === 0) console.log(`  ${done}/${list.length} fetched`);
  }
  console.log(`Fetched streams for ${done} activities.`);
}
