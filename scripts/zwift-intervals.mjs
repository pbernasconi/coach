#!/usr/bin/env node
/**
 * Sends the plan's indoor rides to Zwift through intervals.icu, now (the cloud cron does it every 30 minutes:
 * /api/cron/workouts). /plan and /check-in run it after a change.
 *
 *   node --env-file=.env.local scripts/zwift-intervals.mjs [--days 14] [--dry-run]
 */

import { connect } from '../src/db/neon.mjs';
import { HOME_TZ } from '../src/lib/calendar-sync/push.mjs';
import { intervalsClient, syncIntervals } from '../src/lib/workouts/intervals.mjs';

const args = process.argv.slice(2);
const days = Number(args[args.indexOf('--days') + 1]) || 14;
const dryRun = args.includes('--dry-run');
const sql = connect();
const [user] = await sql`SELECT id FROM users ORDER BY created_at LIMIT 1`;
const today = new Intl.DateTimeFormat('en-CA', { timeZone: HOME_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const to = new Date(Date.parse(`${today}T00:00:00Z`) + (days - 1) * 86_400_000).toISOString().slice(0, 10);
const r = await syncIntervals(sql, user.id, intervalsClient(), { from: today, to, dryRun, log: (m) => console.log(' ', m) });
if (r.skipped) {
  console.error(`Not synced: ${r.skipped}`);
  process.exit(1);
}
for (const w of r.warnings) console.warn(`  ! ${w}`);
console.log(`intervals.icu → Zwift ${dryRun ? '(dry run) ' : ''}${today} → ${to}: ${r.created} new, ${r.updated} updated, ${r.deleted} deleted, ${r.kept} unchanged.`);
for (const e of r.errors) console.error(`  ! ${e}`);
if (r.errors.length) process.exit(2);
