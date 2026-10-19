#!/usr/bin/env node
/**
 * Strava backfill — incremental sync by default, full backfill with --days.
 * The logic lives in src/lib/strava-sync/sync.mjs; the server's webhook and daily cron use it too.
 *
 * Usage:
 *   node --env-file=.env.local scripts/strava-backfill.mjs            # incremental — fetches only activities since last_synced_at
 *   node --env-file=.env.local scripts/strava-backfill.mjs --days 90  # full window
 *   node --env-file=.env.local scripts/strava-backfill.mjs --detailed # also pull description/laps/splits/suffer_score
 *   node --env-file=.env.local scripts/strava-backfill.mjs --streams  # also pull HR/watts/etc streams
 *   node --env-file=.env.local scripts/strava-backfill.mjs --force    # force full re-pull ignoring last_synced_at
 */

import { neon } from '@neondatabase/serverless';
import { syncStrava } from '../src/lib/strava-sync/sync.mjs';

const args = process.argv.slice(2);
const daysIdx = args.indexOf('--days');

try {
  await syncStrava(neon(process.env.DATABASE_URL), {
    days: daysIdx >= 0 ? parseInt(args[daysIdx + 1], 10) : null,
    detailed: args.includes('--detailed'),
    streams: args.includes('--streams'),
    force: args.includes('--force'),
  });
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
