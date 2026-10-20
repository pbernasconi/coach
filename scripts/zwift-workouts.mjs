#!/usr/bin/env node
/**
 * Puts the plan's indoor rides into Zwift: one .zwo file per ride in Zwift's workouts folder
 * (~/Documents/Zwift/Workouts/<your Zwift id>/), named "Coach - <date> <title>.zwo". It updates a file when the
 * workout changed and deletes the file when the ride is moved out, skipped or removed. It never touches a file
 * without the "Coach - " prefix. Zwift reads new files when it starts (Workouts → Custom Workouts).
 *
 *   node --env-file=.env.local scripts/zwift-workouts.mjs [--days 14] [--dry-run] [--folder <path>]
 *
 * /plan and /check-in run it; scripts/zwift/install.sh runs it every 30 minutes on the Mac (launchd).
 * Logic: src/lib/workouts/sync.mjs (target 'zwift').
 */

import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { connect } from '../src/db/neon.mjs';
import { HOME_TZ } from '../src/lib/calendar-sync/push.mjs';
import { loadSyncRows, planSync, recordSync } from '../src/lib/workouts/sync.mjs';

const PREFIX = 'Coach - ';
const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const days = Number(opt('--days')) || 14;
const dryRun = args.includes('--dry-run');

/** The Zwift id folder: the one numeric folder in ~/Documents/Zwift/Workouts. */
function zwiftFolder() {
  if (opt('--folder')) return opt('--folder');
  const base = join(homedir(), 'Documents', 'Zwift', 'Workouts');
  if (!existsSync(base)) throw new Error(`${base} does not exist: is Zwift installed and signed in on this Mac?`);
  const ids = readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d+$/.test(d.name));
  if (ids.length !== 1) throw new Error(`Expected one Zwift id folder in ${base}, found ${ids.length}. Use --folder.`);
  return join(base, ids[0].name);
}

const folder = zwiftFolder();
const sql = connect();
const [user] = await sql`SELECT id FROM users ORDER BY created_at LIMIT 1`;
const today = new Intl.DateTimeFormat('en-CA', { timeZone: HOME_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const to = new Date(Date.parse(`${today}T00:00:00Z`) + (days - 1) * 86_400_000).toISOString().slice(0, 10);
const { rows, synced } = await loadSyncRows(sql, user.id, 'zwift', today, to);
// A ride whose day passed keeps its file until the window moves past it; then it is deleted like any other.
const ops = planSync('zwift', rows, synced);
const counts = { created: 0, updated: 0, deleted: 0, kept: 0, errors: 0 };
const remove = (file) => {
  const path = join(folder, file);
  if (file.startsWith(PREFIX) && existsSync(path)) unlinkSync(path);
};

for (const o of ops) {
  if (o.op === 'keep') {
    // Still check the file is there (Zwift or a person may have removed it).
    if (!existsSync(join(folder, o.prior.remote_id))) o.op = 'update';
    else {
      counts.kept++;
      continue;
    }
  }
  const label = o.payload?.file ?? o.prior?.remote_id ?? o.activityId;
  console.log(`  ${o.op} ${label}`);
  if (dryRun) {
    counts[{ create: 'created', update: 'updated', delete: 'deleted' }[o.op]]++;
    continue;
  }
  try {
    if (o.op === 'delete') {
      remove(o.prior.remote_id);
      await recordSync(sql, 'zwift', { op: 'delete', activityId: o.activityId, ok: true });
      counts.deleted++;
      continue;
    }
    if (o.op === 'update' && o.prior.remote_id !== o.payload.file) remove(o.prior.remote_id);
    writeFileSync(join(folder, o.payload.file), o.payload.xml);
    // Read it back: the file must hold exactly what was written.
    const ok = readFileSync(join(folder, o.payload.file), 'utf8') === o.payload.xml;
    await recordSync(sql, 'zwift', { op: o.op, activityId: o.activityId, ok, hash: o.hash, remoteId: o.payload.file, error: ok ? null : 'the file did not read back the same' });
    counts[o.op === 'create' ? 'created' : 'updated']++;
  } catch (e) {
    counts.errors++;
    console.error(`  ! ${label}: ${e.message}`);
  }
}

// Coach files that no sync row knows (a lost row, a copy): remove them, so Zwift shows only the plan.
if (!dryRun) {
  const known = new Set((await sql`SELECT remote_id FROM workout_syncs WHERE target = 'zwift'`).map((r) => r.remote_id));
  for (const f of readdirSync(folder)) {
    if (f.startsWith(PREFIX) && f.endsWith('.zwo') && !known.has(f)) {
      remove(f);
      console.log(`  removed stray ${f}`);
    }
  }
}

console.log(`Zwift ${dryRun ? '(dry run) ' : ''}${today} → ${to}: ${counts.created} new, ${counts.updated} updated, ${counts.deleted} deleted, ${counts.kept} unchanged.${counts.created + counts.updated + counts.deleted ? ' Restart Zwift to see the changes.' : ''}`);
if (counts.errors) process.exit(2);
