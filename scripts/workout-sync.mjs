#!/usr/bin/env node
/**
 * Sends the plan's structured workouts (training_plan_activities.steps) to intervals.icu, which passes runs on to
 * the Garmin watch and indoor rides on to Zwift. /plan and /check-in run it after plan-import.mjs; the web runs the
 * same sync after a move or a skip. Safe to re-run: only what changed is sent (workout_syncs).
 *
 *   node --env-file=.env.local scripts/workout-sync.mjs [--days 14] [--dry-run]
 *
 * Needs INTERVALS_API_KEY and INTERVALS_ATHLETE_ID. Logic: src/lib/workouts/sync.mjs.
 */

import { connect } from '../src/db/neon.mjs';
import { HOME_TZ } from '../src/lib/calendar-sync/push.mjs';
import { intervalsClient } from '../src/lib/workouts/intervals-api.mjs';
import { syncWorkouts } from '../src/lib/workouts/sync.mjs';

const args = process.argv.slice(2);
const days = Number(args[args.indexOf('--days') + 1]) || 14;
const dryRun = args.includes('--dry-run');
const sql = connect();
const [user] = await sql`SELECT id FROM users ORDER BY created_at LIMIT 1`;
const today = new Intl.DateTimeFormat('en-CA', { timeZone: HOME_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const to = new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const r = await syncWorkouts(sql, user.id, intervalsClient(), { from: today, to, dryRun, log: (m) => console.log(' ', m) });
if (r.skipped) {
  console.error(`Not synced: ${r.skipped}`);
  process.exit(1);
}
console.log(`intervals.icu ${dryRun ? '(dry run) ' : ''}${today} → ${to}: ${r.created} created, ${r.updated} updated, ${r.deleted} deleted, ${r.kept} unchanged.`);
for (const e of r.errors) console.error(`  ! ${e}`);
if (r.errors.length) process.exit(2);
