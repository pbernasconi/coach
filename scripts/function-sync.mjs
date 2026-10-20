#!/usr/bin/env node
/**
 * Function Health → Coach lab_results. Logs in to Function's member API with FUNCTION_EMAIL and FUNCTION_PASSWORD,
 * reads every draw of every biomarker (results-report) and the clinician notes (notes), writes the lab import file to a private temp file, imports
 * it with scripts/labs-import.mjs (same validation and upsert), and deletes the file. Then it stores Function's
 * catalog for /health/labs: each biomarker's status, range and reading text (biomarker-data/<sexDetailId>) in
 * lab_biomarkers, the categories in lab_categories, and the next planned draw (pending-schedules) in
 * lab_planned_draws. Prints counts only.
 *
 *   node --env-file=.env.local scripts/function-sync.mjs [--dry-run]
 *
 * Env: FUNCTION_EMAIL, FUNCTION_PASSWORD, DATABASE_URL. The GitHub workflow function.yml runs it weekly.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { FUNCTION_API, FUNCTION_HEADERS, importFromResultsReport, notesFromResponse } from '../src/lib/vitals/function-api.mjs';
import { catalogFromReport, contentFromBiomarkerData, plannedDraws, sexFromRequisitions } from '../src/lib/vitals/function-catalog.mjs';

const dryRun = process.argv.includes('--dry-run');
const { FUNCTION_EMAIL: email, FUNCTION_PASSWORD: password } = process.env;
if (!email || !password) {
  console.error('FUNCTION_EMAIL and FUNCTION_PASSWORD must be set.');
  process.exit(3);
}

async function call(path, init = {}) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${FUNCTION_API}/${path}`, { ...init, headers: { ...FUNCTION_HEADERS, ...init.headers } });
    if (res.ok) return res.json();
    if (attempt < 3 && (res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, attempt * 5000));
      continue;
    }
    throw new Error(`${path}: HTTP ${res.status}`);
  }
}

let session;
try {
  session = await call('login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
} catch (e) {
  console.error(`Function login failed (${e instanceof Error ? e.message : 'error'}). Check FUNCTION_EMAIL and FUNCTION_PASSWORD.`);
  process.exit(2);
}
if (!session?.idToken) {
  console.error('Function login returned no token.');
  process.exit(2);
}

const report = await call('results-report', { headers: { authorization: `Bearer ${session.idToken}` } });
const file = importFromResultsReport(report);
const draws = [...new Set(file.results.map((r) => r.collectedOn))].sort();
const biomarkers = new Set(file.results.map((r) => r.biomarker)).size;
console.log(`Function: ${biomarkers} biomarkers, ${file.results.length} results, ${draws.length} draws (${draws.join(', ')}).`);
if (!file.results.length) {
  console.error('No results in the report.');
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), 'function-'));
const path = join(dir, 'labs.json');
try {
  writeFileSync(path, JSON.stringify(file), { mode: 0o600 });
  execFileSync(process.execPath, [new URL('./labs-import.mjs', import.meta.url).pathname, '--file', path, ...(dryRun ? ['--dry-run'] : [])], { stdio: 'inherit' });
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// Clinician notes: a sync replaces the notes of each test order it reads (one transaction per order).
const notes = notesFromResponse(await call('notes', { headers: { authorization: `Bearer ${session.idToken}` } }));
const orders = [...new Set(notes.map((n) => n.requisitionId))];
console.log(`Clinician notes: ${notes.length} notes on ${orders.length} test orders.`);
if (!dryRun && notes.length) {
  const sql = neon(process.env.DATABASE_URL);
  const [owner] = await sql`SELECT id FROM users ORDER BY created_at LIMIT 1`;
  if (!owner) {
    console.error('No Coach user in the database.');
    process.exit(1);
  }
  for (const id of orders) {
    const rows = notes.filter((n) => n.requisitionId === id);
    await sql.transaction([
      sql`DELETE FROM clinician_notes WHERE user_id = ${owner.id} AND source = 'function' AND requisition_id = ${id}`,
      ...rows.map((n) => sql`
        INSERT INTO clinician_notes (user_id, source, requisition_id, position, noted_on, category, body, raw, imported_at)
        VALUES (${owner.id}, 'function', ${id}, ${n.position}, ${n.notedOn}, ${n.category}, ${n.body}, ${JSON.stringify(n.raw)}::jsonb, now())`),
    ]);
  }
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM clinician_notes WHERE user_id = ${owner.id}`;
  console.log(`clinician_notes now has ${n} rows.`);
}

// ---- The catalog for /health/labs ----
const auth = { headers: { authorization: `Bearer ${session.idToken}` } };
const sex = sexFromRequisitions(await call('requisitions', auth).catch(() => null));
const catalog = catalogFromReport(report, sex);
// The reading text: one call per biomarker, 4 at a time. A failed call keeps the stored text (COALESCE below).
const contents = new Map();
let failed = 0;
const queue = catalog.biomarkers.filter((b) => b.sexDetailId);
await Promise.all(
  Array.from({ length: 4 }, async () => {
    for (let b = queue.shift(); b; b = queue.shift()) {
      try {
        contents.set(b.key, contentFromBiomarkerData(await call(`biomarker-data/${b.sexDetailId}`, auth)));
      } catch {
        failed += 1;
      }
    }
  })
);
let planned = [];
let plannedOk = true;
try {
  planned = plannedDraws(await call('pending-schedules', auth));
} catch {
  plannedOk = false;
  console.error('pending-schedules failed; the planned draw is not updated.');
}
console.log(
  `Catalog: ${catalog.biomarkers.length} biomarkers in ${catalog.categories.length} categories, text for ${contents.size}` +
    `${failed ? ` (${failed} failed)` : ''}, ${planned.length} planned draw(s).`
);
if (!dryRun && catalog.biomarkers.length) {
  const sql = neon(process.env.DATABASE_URL);
  const [owner] = await sql`SELECT id FROM users ORDER BY created_at LIMIT 1`;
  if (!owner) {
    console.error('No Coach user in the database.');
    process.exit(1);
  }
  const keys = catalog.biomarkers.map((b) => b.key);
  const records = new Map((report?.data?.biomarkerResultsRecord ?? []).map((r) => [r?.biomarker?.id, r]));
  // raw: Function's record without the draws (they are in lab_results) and without the long text (in content).
  const rawOf = (key) => {
    const { biomarkerResults: _r, ...rest } = records.get(key) ?? {};
    void _r;
    return JSON.stringify(rest);
  };
  await sql.transaction([
    ...catalog.biomarkers.map((b) => {
      const content = contents.has(b.key) ? JSON.stringify(contents.get(b.key)) : null;
      return sql`
        INSERT INTO lab_biomarkers (user_id, source, key, name, slug, result_names, categories, description, units, status,
          out_of_range_type, kind, range_text, range_min, range_max, range_min_op, range_max_op, optimal_range, optimal_low,
          optimal_high, current_display, current_on, content, raw, updated_at)
        VALUES (${owner.id}, 'function', ${b.key}, ${b.name}, ${b.slug}, ${b.resultNames}, ${b.categories}, ${b.description},
          ${b.units}, ${b.status}, ${b.outOfRangeType}, ${b.kind}, ${b.rangeText}, ${b.rangeMin}, ${b.rangeMax}, ${b.rangeMinOp},
          ${b.rangeMaxOp}, ${b.optimalRange}, ${b.optimalLow}, ${b.optimalHigh}, ${b.currentDisplay}, ${b.currentOn},
          ${content}::jsonb, ${rawOf(b.key)}::jsonb, now())
        ON CONFLICT (user_id, source, key) DO UPDATE SET
          name = EXCLUDED.name, slug = EXCLUDED.slug, result_names = EXCLUDED.result_names, categories = EXCLUDED.categories,
          description = EXCLUDED.description, units = EXCLUDED.units, status = EXCLUDED.status,
          out_of_range_type = EXCLUDED.out_of_range_type, kind = EXCLUDED.kind, range_text = EXCLUDED.range_text,
          range_min = EXCLUDED.range_min, range_max = EXCLUDED.range_max, range_min_op = EXCLUDED.range_min_op,
          range_max_op = EXCLUDED.range_max_op, optimal_range = EXCLUDED.optimal_range, optimal_low = EXCLUDED.optimal_low,
          optimal_high = EXCLUDED.optimal_high, current_display = EXCLUDED.current_display, current_on = EXCLUDED.current_on,
          content = COALESCE(EXCLUDED.content, lab_biomarkers.content), raw = EXCLUDED.raw, updated_at = now()`;
    }),
    sql`DELETE FROM lab_biomarkers WHERE user_id = ${owner.id} AND source = 'function' AND NOT (key = ANY(${keys}::text[]))`,
    sql`DELETE FROM lab_categories WHERE user_id = ${owner.id} AND source = 'function'`,
    ...catalog.categories.map((c) => sql`
      INSERT INTO lab_categories (user_id, source, key, name, description, position, biomarker_keys, updated_at)
      VALUES (${owner.id}, 'function', ${c.key}, ${c.name}, ${c.description}, ${c.position}, ${c.biomarkerKeys}, now())`),
  ]);
  if (plannedOk) {
    await sql.transaction([
      sql`DELETE FROM lab_planned_draws WHERE user_id = ${owner.id} AND source = 'function'`,
      ...planned.map((d) => sql`
        INSERT INTO lab_planned_draws (user_id, source, key, type, recommended_on, window_start, window_end, visit_on, scheduled, updated_at)
        VALUES (${owner.id}, 'function', ${d.key}, ${d.type}, ${d.recommendedOn}, ${d.windowStart}, ${d.windowEnd}, ${d.visitOn}, ${d.scheduled}, now())`),
    ]);
  }
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM lab_biomarkers WHERE user_id = ${owner.id}`;
  console.log(`lab_biomarkers now has ${n} rows.`);
}
