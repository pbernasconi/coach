import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyIndex, pickHighlights, trend } from './labs-highlights.mjs';

const bm = (biomarker, status = 'in_range', extra = {}) => ({ biomarker, latest: { status }, ...extra });

test('key markers match canonical names and Function spellings', () => {
  assert.equal(keyIndex('Apolipoprotein B'), 0);
  assert.equal(keyIndex('Apolipoprotein B (ApoB)'), 0);
  assert.equal(keyIndex('Lp(a)'), 1);
  assert.equal(keyIndex('HbA1c'), 4);
  assert.equal(keyIndex('C-Reactive Protein, Cardiac'), 6);
  assert.equal(keyIndex('Sodium'), -1);
  assert.equal(keyIndex(''), -1);
});

test('highlights: out of range first, then key markers in order; the rest left out', () => {
  const rows = pickHighlights([
    bm('Sodium'),
    bm('Hemoglobin A1c'),
    bm('Ferritin', 'out_of_range'),
    bm('Apolipoprotein B'),
    bm('LDL Cholesterol', 'out_of_range'),
    bm('Hemoglobin A1c'),
  ]);
  assert.deepEqual(rows.map((r) => r.b.biomarker), ['LDL Cholesterol', 'Ferritin', 'Apolipoprotein B', 'Hemoglobin A1c']);
  assert.deepEqual(rows.map((r) => r.key), [true, false, true, true]);
});

const hist = (...v) => v.map((value, i) => ({ collectedOn: `2026-0${i + 1}-01`, value }));
const ranges = { refLow: null, refHigh: 100, optimalLow: null, optimalHigh: 80 };

test('trend: change since the previous numeric draw, judged against the optimal range', () => {
  assert.equal(trend({ ...ranges, history: hist(90) }), null);
  assert.deepEqual(trend({ ...ranges, history: hist(120, null, 95) }), { delta: -25, previous: 120, previousOn: '2026-01-01', better: true });
  assert.equal(trend({ ...ranges, history: hist(85, 95) }).better, false);
  // Both inside the optimal range: no verdict.
  assert.equal(trend({ ...ranges, history: hist(60, 70) }).better, null);
  // No optimal range: the reference range decides.
  assert.equal(trend({ refLow: 10, refHigh: 20, optimalLow: null, optimalHigh: null, history: hist(5, 8) }).better, true);
  assert.equal(trend({ refLow: null, refHigh: null, optimalLow: null, optimalHigh: null, history: hist(5, 8) }).better, null);
});
