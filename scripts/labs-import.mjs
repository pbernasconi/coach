#!/usr/bin/env node
/**
 * Upserts lab results from a JSON file into lab_results (the file format is at the top of src/lib/vitals/labs.mjs).
 * /labs writes that file from the Function Health connector or a Function PDF, runs this, then deletes the file.
 * Safe to re-run: rows are unique on (user, source, biomarker, collected_on), and a re-import replaces them.
 * Prints counts and reasons only, never values: they are health data.
 *
 *   node --env-file=.env.local scripts/labs-import.mjs --file /tmp/labs.json [--dry-run]
 */

import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { normalizeImport } from '../src/lib/vitals/labs.mjs';

const args = process.argv.slice(2);
const fileIdx = args.indexOf('--file');
const file = fileIdx >= 0 ? args[fileIdx + 1] : null;
const dryRun = args.includes('--dry-run');
if (!file) {
  console.error('Usage: labs-import.mjs --file <results.json> [--dry-run]');
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(readFileSync(file, 'utf8'));
} catch (e) {
  console.error(`Cannot read ${file} as JSON: ${e instanceof Error ? e.message.split('\n')[0] : 'unknown error'}`);
  process.exit(1);
}

const { rows, rejected } = normalizeImport(parsed);
for (const r of rejected) console.error(`Rejected result ${r.index}: ${r.reason}`);
const draws = [...new Set(rows.map((r) => r.collectedOn))].sort();
const byStatus = rows.reduce((m, r) => ({ ...m, [r.status]: (m[r.status] ?? 0) + 1 }), {});
console.log(`${rows.length} results from ${draws.length} draws (${draws.join(', ') || 'none'}); ${rejected.length} rejected.`);
console.log(`Status: ${Object.entries(byStatus).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`);
if (dryRun || !rows.length) process.exit(rejected.length && !rows.length ? 1 : 0);

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set (run with --env-file=.env.local).');
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);
const [owner] = await sql`SELECT id FROM users ORDER BY created_at LIMIT 1`;
if (!owner) {
  console.error('No Coach user in the database.');
  process.exit(1);
}

for (let i = 0; i < rows.length; i += 500) {
  const chunk = rows.slice(i, i + 500);
  const c = (k) => chunk.map((r) => r[k]);
  await sql`
    INSERT INTO lab_results (user_id, collected_on, biomarker, category, value, value_text, unit, ref_low, ref_high,
                             optimal_low, optimal_high, status, source, source_id, raw, imported_at)
    SELECT ${owner.id}, t.collected_on, t.biomarker, t.category, t.value, t.value_text, t.unit, t.ref_low, t.ref_high,
           t.optimal_low, t.optimal_high, t.status, t.source, t.source_id, t.raw::jsonb, now()
    FROM unnest(${c('collectedOn')}::date[], ${c('biomarker')}::text[], ${c('category')}::text[], ${c('value')}::numeric[],
                ${c('valueText')}::text[], ${c('unit')}::text[], ${c('refLow')}::numeric[], ${c('refHigh')}::numeric[],
                ${c('optimalLow')}::numeric[], ${c('optimalHigh')}::numeric[], ${c('status')}::text[], ${c('source')}::text[],
                ${c('sourceId')}::text[], ${chunk.map((r) => JSON.stringify(r.raw))}::text[])
      AS t(collected_on, biomarker, category, value, value_text, unit, ref_low, ref_high, optimal_low, optimal_high,
           status, source, source_id, raw)
    ON CONFLICT (user_id, source, biomarker, collected_on) DO UPDATE SET
      category = EXCLUDED.category, value = EXCLUDED.value, value_text = EXCLUDED.value_text, unit = EXCLUDED.unit,
      ref_low = EXCLUDED.ref_low, ref_high = EXCLUDED.ref_high, optimal_low = EXCLUDED.optimal_low,
      optimal_high = EXCLUDED.optimal_high, status = EXCLUDED.status, source_id = EXCLUDED.source_id,
      raw = EXCLUDED.raw, imported_at = now()`;
}
const [{ n }] = await sql`SELECT count(*)::int AS n FROM lab_results WHERE user_id = ${owner.id}`;
console.log(`Imported ${rows.length} results. lab_results now has ${n} rows.`);
