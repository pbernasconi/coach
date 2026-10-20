import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPayload } from './function-store.mjs';

const ok = { file: { results: [] }, notes: [], catalog: { biomarkers: [], categories: [] }, contents: {}, raw: {}, planned: [] };

test('a full payload and an error payload are valid', () => {
  assert.equal(checkPayload(ok), null);
  assert.equal(checkPayload({ error: 'login failed' }), null);
});

test('a payload with a missing part is refused before anything is written', () => {
  assert.match(checkPayload(null), /object/);
  assert.match(checkPayload({ ...ok, file: {} }), /file.results/);
  assert.match(checkPayload({ ...ok, catalog: { biomarkers: [] } }), /catalog/);
  assert.match(checkPayload({ ...ok, planned: null }), /planned/);
  assert.match(checkPayload({ error: 42 }), /error/);
});
