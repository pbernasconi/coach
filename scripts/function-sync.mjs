#!/usr/bin/env node
/**
 * Function Health → Coach. Logs in to Function's member API with FUNCTION_EMAIL and FUNCTION_PASSWORD and reads
 * every draw of every biomarker (results-report), the clinician notes (notes), the catalog text of each biomarker
 * (biomarker-data/<sexDetailId>) and the next planned draw (pending-schedules). Then it sends all of it to Coach
 * (POST /api/vitals/function, Bearer CRON_SECRET), which stores it and records the run. The script has no
 * database access. Prints counts only, never values: they are health data.
 *
 *   FUNCTION_EMAIL=… FUNCTION_PASSWORD=… CRON_SECRET=… node scripts/function-sync.mjs [--dry-run]
 *
 * It uses no npm packages (only the pure modules in src/lib/vitals), so the workflow runs it without npm ci.
 * Run it after new results: Actions → Function Health sync → Run workflow, or `gh workflow run function.yml`.
 */
import { FUNCTION_API, FUNCTION_HEADERS, importFromResultsReport, notesFromResponse } from '../src/lib/vitals/function-api.mjs';
import { catalogFromReport, contentFromBiomarkerData, plannedDraws, sexFromRequisitions } from '../src/lib/vitals/function-catalog.mjs';

const dryRun = process.argv.includes('--dry-run');
const { FUNCTION_EMAIL: email, FUNCTION_PASSWORD: password, CRON_SECRET: secret } = process.env;
const coach = process.env.COACH_URL ?? 'https://coach.paolobernasconi.com';
if (!email || !password) {
  console.error('FUNCTION_EMAIL and FUNCTION_PASSWORD must be set.');
  process.exit(3);
}
if (!dryRun && !secret) {
  console.error('CRON_SECRET must be set (it authenticates the upload to Coach).');
  process.exit(3);
}

/** Sends the payload to Coach. A failed run sends { error }, so Settings shows it. */
async function send(payload) {
  const res = await fetch(`${coach}/api/vitals/function`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(90_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Coach: HTTP ${res.status} ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function fail(message, code) {
  console.error(message);
  if (!dryRun) await send({ error: message }).catch((e) => console.error(`Could not record the failure in Coach: ${e.message}`));
  process.exit(code);
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
  await fail(`Function login failed (${e instanceof Error ? e.message : 'error'}). Check FUNCTION_EMAIL and FUNCTION_PASSWORD.`, 2);
}
if (!session?.idToken) await fail('Function login returned no token.', 2);
const auth = { headers: { authorization: `Bearer ${session.idToken}` } };

let report;
try {
  report = await call('results-report', auth);
} catch (e) {
  await fail(`Function results-report failed (${e.message}).`, 1);
}
const file = importFromResultsReport(report);
const draws = [...new Set(file.results.map((r) => r.collectedOn))].sort();
console.log(`Function: ${new Set(file.results.map((r) => r.biomarker)).size} biomarkers, ${file.results.length} results, ${draws.length} draws (${draws.join(', ')}).`);
if (!file.results.length) await fail('No results in the Function report.', 1);

const notes = notesFromResponse(await call('notes', auth).catch(() => null));
const sex = sexFromRequisitions(await call('requisitions', auth).catch(() => null));
const catalog = catalogFromReport(report, sex);

// The reading text: one call per biomarker, 4 at a time. A failed call keeps the stored text (Coach COALESCEs).
const contents = {};
let failed = 0;
const queue = catalog.biomarkers.filter((b) => b.sexDetailId);
await Promise.all(
  Array.from({ length: 4 }, async () => {
    for (let b = queue.shift(); b; b = queue.shift()) {
      try {
        contents[b.key] = contentFromBiomarkerData(await call(`biomarker-data/${b.sexDetailId}`, auth));
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

// raw: Function's record without the draws (they are in lab_results) and without the long text (in content).
const raw = {};
for (const r of report?.data?.biomarkerResultsRecord ?? []) {
  if (!r?.biomarker?.id) continue;
  const { biomarkerResults: _r, ...rest } = r;
  void _r;
  raw[r.biomarker.id] = rest;
}

console.log(
  `Catalog: ${catalog.biomarkers.length} biomarkers in ${catalog.categories.length} categories, text for ${Object.keys(contents).length}` +
    `${failed ? ` (${failed} failed)` : ''}, ${planned.length} planned draw(s), ${notes.length} clinician notes.`
);
if (dryRun) process.exit(0);

const payload = { file, notes, catalog, contents, raw, planned, plannedOk };
const size = Buffer.byteLength(JSON.stringify(payload));
if (size > 4_000_000) await fail(`The Function data is ${Math.round(size / 1e6)} MB, over Vercel's 4.5 MB request limit.`, 1);
try {
  const r = await send(payload);
  console.log(`Coach stored ${r.results} results (${r.rejected} rejected), ${r.notes} notes, ${r.biomarkers} biomarkers.`);
  if (r.partial) console.warn('The catalog looked partial (far fewer biomarkers than before), so Coach deleted no biomarkers.');
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
