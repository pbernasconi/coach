#!/usr/bin/env node
/**
 * Puts the plan's strength workouts into Lift as planned sessions, so every set has a target and every rep and weight
 * is logged in Lift. plan-apply.yml runs it after Paolo accepts a plan. Safe to re-run.
 *
 *   node --env-file=.env.local scripts/lift-plan.mjs [--days 21] [--dry-run]
 *
 * For each plan workout from today on with a `lift_template`:
 * - no Lift session yet: Lift plans one from the template (targets from the template and the logged history);
 * - a session that was not started: it moves to the workout's day and its sets are planned again, so the targets use
 *   everything logged since (run it after a lift, and the next one goes up when it was earned);
 * - a session with a logged set, or started: never changed.
 * A skipped workout, a workout without a template, and a session this script made that no workout links any more lose
 * their Lift session (only when nothing was logged in it). The descriptions get the planned sets, then the calendar is
 * pushed for the weeks that changed.
 *
 * Needs LIFT_SYNC_TOKEN, and swift (lift/tools/LiftSeed runs Lift's own planner, LiftKit).
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connect } from '../src/db/neon.mjs';
import { HOME_TZ, pushWeek } from '../src/lib/calendar-sync/push.mjs';
import { intensityText, mergeDescription, planEntries } from '../src/lib/plan/lift-plan.mjs';

const SERVER = process.env.LIFT_SYNC_BASE_URL ?? 'https://coach.paolobernasconi.com';
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const days = Number(args[args.indexOf('--days') + 1]) || 21;
if (!process.env.LIFT_SYNC_TOKEN) {
  console.error('LIFT_SYNC_TOKEN is not set (run with --env-file=.env.local)');
  process.exit(1);
}

const sql = connect();
const [user] = await sql`SELECT id, settings FROM users ORDER BY created_at LIMIT 1`;
const today = new Intl.DateTimeFormat('en-CA', { timeZone: HOME_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const last = new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

const rows = await sql`
  SELECT a.id, to_char(a.scheduled_date, 'YYYY-MM-DD') AS day, a.status, a.lift_template, a.lift_session_id,
    a.description, to_char(p.week_start_date, 'YYYY-MM-DD') AS week
  FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
  WHERE p.user_id = ${user.id} AND a.scheduled_date >= ${today} AND a.scheduled_date < ${last}::date + 1
    AND (a.lift_template IS NOT NULL OR a.lift_session_id IS NOT NULL)
  ORDER BY a.scheduled_date, a.sort_order`;
const past = await sql`
  SELECT a.lift_session_id FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
  WHERE p.user_id = ${user.id} AND a.scheduled_date < ${today} AND a.lift_session_id IS NOT NULL`;
const ledger = Array.isArray(user.settings?.liftPlanned) ? user.settings.liftPlanned : [];
const entries = planEntries(
  rows.map((r) => ({ id: r.id, day: r.day, status: r.status, liftTemplate: r.lift_template, liftSessionId: r.lift_session_id })),
  ledger,
  new Set(past.map((r) => r.lift_session_id)),
);
if (entries.length === 0) {
  console.log(`No strength workouts with a Lift template from ${today} to ${last}.`);
  process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), 'lift-plan-'));
writeFileSync(join(dir, 'plan.json'), JSON.stringify(entries, null, 2));
const tool = ['run', '-q', '--package-path', 'lift/tools/LiftSeed', 'LiftSeed', '--db', join(dir, 'lift.sqlite'),
  '--server', SERVER, '--plan', join(dir, 'plan.json'), '--out', join(dir, 'out.json')];
if (!dryRun) tool.push('--push');
execFileSync('swift', tool, { stdio: ['ignore', 'inherit', 'inherit'], env: process.env });
const results = JSON.parse(readFileSync(join(dir, 'out.json'), 'utf8'));

if (dryRun) {
  console.log('Dry run: nothing written.');
  process.exit(0);
}

const byId = new Map(rows.map((r) => [r.id, r]));
const weeks = new Set();
const made = new Set(ledger);
for (const res of results) {
  const id = res.key.startsWith('ledger:') ? res.key.slice(7) : null;
  if (id) {
    if (res.status === 'removed') made.delete(id);
    continue;
  }
  const row = byId.get(res.key);
  if (!row) continue;
  if (res.status === 'removed') {
    await sql`UPDATE training_plan_activities SET lift_session_id = NULL, updated_at = NOW() WHERE id = ${row.id}`;
    if (row.lift_session_id) made.delete(row.lift_session_id);
    weeks.add(row.week);
    continue;
  }
  if (!res.sessionId) continue;
  if (res.status === 'created') made.add(res.sessionId);
  const description = mergeDescription(row.description, res);
  await sql`
    UPDATE training_plan_activities SET lift_session_id = ${res.sessionId}, description = ${description},
      intensity = ${intensityText(res)}, updated_at = NOW()
    WHERE id = ${row.id}`;
  if (description !== row.description) weeks.add(row.week);
}
await sql`UPDATE users SET settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{liftPlanned}', ${JSON.stringify([...made])}::jsonb) WHERE id = ${user.id}`;

// Without the Google app keys (the Plan apply job), Coach pushes these weeks instead (POST /api/plan/proposals, push).
if (!process.env.GOOGLE_CLIENT_ID) {
  console.log(`weeks=${[...weeks].sort().join(',')}`);
  weeks.clear();
}
for (const week of [...weeks].sort()) {
  const r = await pushWeek(sql, user.id, week, { log: () => {} });
  console.log(r.skipped ? `Calendar ${week}: not pushed (${r.skipped})` : `Calendar ${week}: ${r.created} created, ${r.updated} updated, ${r.deleted} deleted.`);
}
console.log(results.map((r) => `${r.day ?? '-'} ${r.title ?? r.key}: ${r.status}`).join('\n'));
