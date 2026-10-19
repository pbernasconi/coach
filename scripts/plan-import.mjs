#!/usr/bin/env node
/**
 * Copies plans/<weekStart>.json into the database, so the web week page and the start page show it.
 * /plan and /check-in run it after they write the JSON. Safe to re-run: changes made on the web are kept.
 *
 *   node --env-file=.env.local scripts/plan-import.mjs --plan plans/2026-10-19.json
 *   node --env-file=.env.local scripts/plan-import.mjs --all
 *   node --env-file=.env.local scripts/plan-import.mjs --show plans/2026-10-19.json   # what changed on the web
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { importPlan } from '../src/lib/plan/import.mjs';

const args = process.argv.slice(2);
const planIdx = args.indexOf('--plan');
const showIdx = args.indexOf('--show');
const files = args.includes('--all')
  ? readdirSync('plans').filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map((f) => join('plans', f))
  : planIdx >= 0
    ? [args[planIdx + 1]]
    : [];
if (showIdx >= 0) {
  const weekStart = String(args[showIdx + 1] ?? '').match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (!weekStart) {
    console.error('Usage: plan-import.mjs --show plans/YYYY-MM-DD.json');
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);
  const [plan] = await sql`SELECT id, feel_log FROM training_plans WHERE week_start_date = ${weekStart} LIMIT 1`;
  if (!plan) {
    console.log(`No plan for ${weekStart} in the database.`);
    process.exit(0);
  }
  const rows = await sql`
    SELECT source_key, scheduled_date, start_time, title, intensity, duration, status, adapted_from, edited_at
    FROM training_plan_activities WHERE plan_id = ${plan.id} ORDER BY scheduled_date, sort_order`;
  console.log(`Feel log: ${JSON.stringify(plan.feel_log)}`);
  for (const r of rows) {
    const day = new Date(r.scheduled_date).toISOString().slice(0, 10);
    const web = r.edited_at ? ` [changed on the web${r.adapted_from ? `; before: ${JSON.stringify(r.adapted_from)}` : ''}]` : '';
    console.log(`${day} ${r.start_time ?? '--:--'} ${r.status === 'skipped' ? 'SKIPPED ' : ''}${r.title} (${r.intensity ?? '-'}, ${r.duration ?? '?'} min) ${r.source_key ?? 'added on the web'}${web}`);
  }
  process.exit(0);
}
if (!files.length || files.some((f) => !f)) {
  console.error('Usage: plan-import.mjs --plan plans/YYYY-MM-DD.json | --all');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const [user] = await sql`SELECT id FROM users ORDER BY created_at LIMIT 1`;
if (!user) {
  console.error('No user in the database');
  process.exit(1);
}

for (const file of files) {
  const plan = JSON.parse(readFileSync(file, 'utf8'));
  const md = file.replace(/\.json$/, '.md');
  const r = await importPlan(sql, user.id, plan, existsSync(md) ? readFileSync(md, 'utf8') : undefined);
  console.log(`${file}: ${r.inserted} new, ${r.updated} updated, ${r.kept} kept (changed on the web), ${r.deleted} removed`);
}
