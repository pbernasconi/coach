#!/usr/bin/env node
/**
 * Removes the Apple Notes import's bookkeeping from the stored Lift notes (src/lib/lift/clean-notes.mjs): each
 * exercise's `Note: “<original line>”` and each session's source, date evidence and "(excluded)" lines. What was
 * written about the workout stays. A changed row gets updatedAt = now and a new seq, as a push would, so the iPhone
 * pulls the cleaner note (last writer wins).
 *
 *   node --env-file=.env.local scripts/lift-clean-notes.mjs --host <db host>                         # dry run
 *   node --env-file=.env.local scripts/lift-clean-notes.mjs --host <db host> --yes --backup <file>   # write
 *
 * --backup gets every changed row's payload before the change (personal data: keep it out of the repo). One
 * transaction. Writes only lift_rows and lift_rows_seq.
 */

import { writeFileSync } from 'node:fs';
import pg from 'pg';
import { cleanExerciseNote, cleanSessionNote } from '../src/lib/lift/clean-notes.mjs';

const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const write = args.includes('--yes');
const backup = opt('--backup');
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set.');
if (opt('--host') !== new URL(url).hostname) {
  console.error(`Refusing: --host does not match the DATABASE_URL host ${new URL(url).hostname}.`);
  process.exit(1);
}
if (write && !backup) {
  console.error('Refusing: --yes needs --backup <file>.');
  process.exit(1);
}

const CLEAN = { session: cleanSessionNote, sessionExercise: cleanExerciseNote };

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const rows = (
    await client.query(
      "SELECT entity, id, payload FROM lift_rows WHERE entity IN ('session', 'sessionExercise') AND coalesce(payload->>'note', '') <> ''"
    )
  ).rows;
  const changes = rows
    .map((r) => ({ ...r, note: CLEAN[r.entity](r.payload.note) }))
    .filter((r) => r.note !== r.payload.note);
  const by = (entity) => changes.filter((c) => c.entity === entity).length;
  console.log(`${changes.length} notes to clean: ${by('session')} sessions, ${by('sessionExercise')} exercises.`);
  for (const c of changes.slice(0, 12)) console.log(`- ${c.entity}: ${JSON.stringify(c.payload.note).slice(0, 90)} → ${JSON.stringify(c.note)}`);
  if (!write) {
    console.log('Dry run: nothing written. Add --yes --backup <file> to write.');
  } else {
    writeFileSync(backup, JSON.stringify(changes.map(({ entity, id, payload }) => ({ entity, id, payload })), null, 1), { mode: 0o600 });
    const at = new Date();
    await client.query('BEGIN');
    for (const c of changes) {
      const payload = { ...c.payload, note: c.note, updatedAt: at.toISOString() };
      await client.query(
        "UPDATE lift_rows SET payload = $1, updated_at = $2, seq = nextval('lift_rows_seq') WHERE entity = $3 AND id = $4",
        [payload, at, c.entity, c.id]
      );
    }
    await client.query('COMMIT');
    console.log(`Wrote ${changes.length} rows. Backup: ${backup}`);
  }
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  await client.end();
}
