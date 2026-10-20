// The Function Health store (POST /api/vitals/function) on a real Postgres: the results upsert, the notes and
// catalog transactions, and the guard that a partial catalog deletes nothing. Runs after health.test.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '@/db';
import { recordFunctionRun, storeFunctionSync } from '@/lib/vitals/function-store.mjs';

const user = 'user_fn';
const biomarker = (key: string) => ({
  key, name: key, slug: key.toLowerCase(), resultNames: [key], categories: ['heart'], description: null, units: 'mg/dL',
  status: 'in_range', outOfRangeType: null, kind: 'numeric', rangeText: '0-10', rangeMin: 0, rangeMax: 10, rangeMinOp: '>=',
  rangeMaxOp: '<=', optimalRange: null, optimalLow: null, optimalHigh: null, currentDisplay: '5', currentOn: '2026-09-01',
});
const payload = (keys: string[]) => ({
  file: { source: 'function', results: [{ biomarker: 'Ferritin', collectedOn: '2026-09-01', value: 80, unit: 'ng/mL', status: 'in_range' }] },
  notes: [{ requisitionId: 'req1', position: 0, notedOn: '2026-09-02', category: 'general', body: 'ok', raw: {} }],
  catalog: { biomarkers: keys.map(biomarker), categories: [{ key: 'heart', name: 'Heart', description: null, position: 0, biomarkerKeys: keys }] },
  contents: {}, raw: {}, planned: [], plannedOk: true,
});

test('a Function sync stores everything, and a partial catalog deletes nothing', async () => {
  await sql`DELETE FROM users WHERE id = ${user}`;
  await sql`INSERT INTO users (id, email) VALUES (${user}, 'fn@example.com')`;
  const keys = Array.from({ length: 10 }, (_, i) => `B${i}`);

  const first = await storeFunctionSync(sql, user, payload(keys));
  assert.equal(first.results, 1);
  assert.equal(first.partial, false);
  const count = async () => (await sql`SELECT count(*)::int AS n FROM lab_biomarkers WHERE user_id = ${user}`)[0].n;
  assert.equal(await count(), 10);

  const partial = await storeFunctionSync(sql, user, payload(keys.slice(0, 3)));
  assert.equal(partial.partial, true);
  assert.equal(await count(), 10, 'a partial catalog removes no biomarker');

  const smaller = await storeFunctionSync(sql, user, payload(keys.slice(0, 9)));
  assert.equal(smaller.partial, false);
  assert.equal(await count(), 9, 'a full catalog removes the biomarkers that are gone');

  const run = await recordFunctionRun(sql, user, { error: 'login failed' });
  assert.equal(run.status, 'failed');
  const ok = await recordFunctionRun(sql, user, { counts: smaller });
  assert.equal(ok.status, 'ok');
  assert.equal(ok.error, null);

  for (const t of ['lab_results', 'lab_biomarkers', 'lab_categories', 'clinician_notes', 'lab_planned_draws']) {
    await sql.query(`DELETE FROM ${t} WHERE user_id = $1`, [user]);
  }
  await sql`DELETE FROM users WHERE id = ${user}`;
});
