#!/usr/bin/env node
/**
 * Function Health → Coach lab_results. Logs in to Function's member API with FUNCTION_EMAIL and FUNCTION_PASSWORD,
 * reads every draw of every biomarker (results-report), writes the lab import file to a private temp file, imports
 * it with scripts/labs-import.mjs (same validation and upsert), and deletes the file. Prints counts only.
 *
 *   node --env-file=.env.local scripts/function-sync.mjs [--dry-run]
 *
 * Env: FUNCTION_EMAIL, FUNCTION_PASSWORD, DATABASE_URL. The GitHub workflow function.yml runs it weekly.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FUNCTION_API, FUNCTION_HEADERS, importFromResultsReport } from '../src/lib/vitals/function-api.mjs';

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
