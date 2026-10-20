#!/usr/bin/env node
/**
 * Puts a plan week on Google Calendar from the database (purple; one event per workout, tagged with its id,
 * so a re-run updates, creates and deletes only what changed). The logic is src/lib/calendar-sync/push.mjs,
 * which the web week page also calls after each move, skip or "how I feel" change.
 *
 *   node --env-file=.env.local scripts/add-workouts-to-calendar.mjs --week 2026-10-19 [--dry-run]
 *
 * Uses Coach's calendar connection (calendar_connections) and GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.
 */

import { connect } from '../src/db/neon.mjs';
import { pushWeek } from '../src/lib/calendar-sync/push.mjs';

const args = process.argv.slice(2);
const week = args[args.indexOf('--week') + 1];
if (!args.includes('--week') || !/^\d{4}-\d{2}-\d{2}$/.test(week ?? '')) {
  console.error('Usage: add-workouts-to-calendar.mjs --week YYYY-MM-DD (the Monday) [--dry-run]');
  process.exit(1);
}
const sql = connect();
const [user] = await sql`SELECT id FROM users ORDER BY created_at LIMIT 1`;
const result = await pushWeek(sql, user.id, week, { dryRun: args.includes('--dry-run'), log: (m) => console.log(' ', m) });
console.log(result.skipped ? `Not pushed: ${result.skipped}` : `Calendar ${args.includes('--dry-run') ? '(dry run) ' : ''}for ${week}: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted.`);
