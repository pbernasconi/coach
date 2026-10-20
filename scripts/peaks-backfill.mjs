#!/usr/bin/env node
/**
 * Peak performances backfill: scans every run and power-meter ride for its bests (activity_peaks).
 * The logic lives in src/lib/performance/peaks-sync.mjs; the Strava webhook and cron call it for new activities.
 *
 * Resumable: activity_peak_scans records each activity done, so stop it at any time and run it again.
 * It waits out Strava's 15-minute window and stops near the daily limit (run it again the next day).
 *
 * Usage:
 *   node --env-file=.env.local scripts/peaks-backfill.mjs               # everything still to do
 *   node --env-file=.env.local scripts/peaks-backfill.mjs --max 100     # at most 100 activities this run
 *   node --env-file=.env.local scripts/peaks-backfill.mjs --stored-only # only streams already in the DB, no Strava calls
 *   node --env-file=.env.local scripts/peaks-backfill.mjs --no-refresh  # never refresh the Strava token (a DB copy)
 *   node --env-file=.env.local scripts/peaks-backfill.mjs --ids 123,456 # scan these activities again
 */

import { neon } from '@neondatabase/serverless';
import { pendingPeakScans, syncActivityPeaks } from '../src/lib/performance/peaks-sync.mjs';

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const max = arg('--max') ? parseInt(arg('--max'), 10) : Infinity;
const ids = arg('--ids')?.split(',').map((s) => s.trim()).filter(Boolean);
const storedOnly = args.includes('--stored-only');
const allowTokenRefresh = !args.includes('--no-refresh');

const sql = neon(process.env.DATABASE_URL);
const [conn] = await sql`SELECT user_id FROM strava_connections LIMIT 1`;
if (!conn) {
  console.error('No Strava connection in DB');
  process.exit(1);
}

let total = { scanned: 0, withPeaks: 0, fetched: 0, fromStored: 0, errors: 0 };
let stopped = null;
try {
  if (ids) {
    const r = await syncActivityPeaks(sql, { stravaActivityIds: ids, limit: ids.length, waitOnRateLimit: true, probeUsage: true, allowTokenRefresh, storedOnly });
    total = r;
    stopped = r.stopped;
  } else {
    console.log(`${await pendingPeakScans(sql, conn.user_id)} activities to scan.`);
    let usage = null;
    while (total.scanned < max) {
      const r = await syncActivityPeaks(sql, {
        limit: Math.min(25, max - total.scanned), waitOnRateLimit: true, probeUsage: !usage, usage, allowTokenRefresh, storedOnly,
      });
      usage = r.usage;
      for (const k of Object.keys(total)) total[k] += r[k];
      const u = r.usage ? ` · Strava ${r.usage.short}/${r.usage.shortLimit} (15 min), ${r.usage.daily}/${r.usage.dailyLimit} (day)` : '';
      console.log(`  scanned ${total.scanned} (${total.withPeaks} with peaks, ${total.fetched} Strava calls, ${total.fromStored} from stored streams)${u}`);
      if (r.stopped) {
        stopped = r.stopped;
        break;
      }
      if (r.scanned === 0) break; // nothing left (or only errors / --stored-only skips)
    }
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const left = await pendingPeakScans(sql, conn.user_id);
console.log(`Done: ${total.scanned} scanned, ${total.withPeaks} with peaks, ${total.errors} errors. ${left} left.`);
if (stopped === 'daily_limit') console.log('Stopped near the Strava daily limit. Run it again tomorrow; it continues where it stopped.');
