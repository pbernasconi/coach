#!/usr/bin/env node
/**
 * Build the unified athlete profile + recent context.
 * Aggregates: athlete profile, training log, fitness state (CTL/ATL/TSB),
 * sport-specific averages, calendar rhythm (preferred days/times),
 * upcoming calendar events, weather, and the Lift templates (from the database).
 *
 * Outputs both:
 *   - profile.md (human-readable, comprehensive)
 *   - profile.json (machine-readable, for the /plan command prompt)
 *
 * Usage:
 *   node --env-file=.env.local scripts/coach-profile.mjs [--week-of YYYY-MM-DD]
 *                                                        [--weeks N | --two-weeks]
 *                                                        [--no-sync]
 *
 * --weeks N spans the calendar + weather + travel horizon over N weeks (default 1).
 * --two-weeks is an alias for --weeks 2.
 */
import { connect } from '../src/db/neon.mjs';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildProfile, OWNER_ID } from '../src/lib/planner/profile.mjs';

const sql = connect();
const args = process.argv.slice(2);
const weekOfIdx = args.indexOf('--week-of');
const weekOfArg = weekOfIdx >= 0 ? args[weekOfIdx + 1] : null;
const SKIP_SYNC = args.includes('--no-sync');

// Horizon: how many weeks of calendar/weather/travel to pull.
const weeksIdx = args.indexOf('--weeks');
const WEEKS = args.includes('--two-weeks')
  ? 2
  : weeksIdx >= 0
    ? Math.max(1, Math.min(4, parseInt(args[weeksIdx + 1], 10) || 1))
    : 1;

// Fail loudly on unknown flags — a silently-ignored --two-weeks is how the
// pipeline used to hand back one week while the plan claimed two.
const KNOWN_FLAGS = new Set(['--week-of', '--weeks', '--two-weeks', '--no-sync']);
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (!a.startsWith('--')) continue;
  if (!KNOWN_FLAGS.has(a)) {
    console.error(`Unknown flag: ${a}\nKnown: ${[...KNOWN_FLAGS].join(' ')}`);
    process.exit(1);
  }
  if (a === '--week-of' || a === '--weeks') i++; // skip its value
}

// ===== 0. Refresh upstream data (Strava + Calendar) unless --no-sync =====
if (!SKIP_SYNC) {
  try {
    console.error('Syncing calendar…');
    execFileSync(process.execPath, [resolve(import.meta.dirname, 'calendar-sync.mjs')], { stdio: 'inherit', env: process.env });
  } catch (e) {
    console.error('calendar-sync failed (continuing):', e.message);
  }
  try {
    console.error('Incremental Strava sync…');
    execFileSync(process.execPath, [resolve(import.meta.dirname, 'strava-backfill.mjs')], { stdio: 'inherit', env: process.env });
  } catch (e) {
    console.error('strava-backfill failed (continuing):', e.message);
  }
}

// The profile itself is built in src/lib/planner/profile.mjs (the server planner uses the same function).
const { md, json } = await buildProfile(sql, { userId: OWNER_ID, weekOf: weekOfArg, weeks: WEEKS });
writeFileSync('profile.md', md);
writeFileSync('profile.json', JSON.stringify(json, null, 2));
console.log(`Wrote profile.md (${md.length} chars) and profile.json (${JSON.stringify(json).length} chars).`);
