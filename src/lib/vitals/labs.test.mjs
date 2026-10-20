import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStatus, mapStatus, normalizeBiomarker, normalizeImport, normalizeResult, parseRange, parseValue } from './labs.mjs';

test('biomarker names: aliases fold to one name; unknown names keep their spelling', () => {
  assert.equal(normalizeBiomarker('LDL-C'), 'LDL Cholesterol');
  assert.equal(normalizeBiomarker('  LDL   Cholesterol '), 'LDL Cholesterol');
  assert.equal(normalizeBiomarker('LDL Chol Calc (NIH)'), 'LDL Cholesterol');
  assert.equal(normalizeBiomarker('HbA1c'), 'Hemoglobin A1c');
  assert.equal(normalizeBiomarker('Vitamin D, 25-Hydroxy'), 'Vitamin D (25-OH)');
  assert.equal(normalizeBiomarker('C-Reactive Protein, Cardiac'), 'hs-CRP');
  assert.equal(normalizeBiomarker('Lp(a)'), 'Lipoprotein(a)');
  assert.equal(normalizeBiomarker('Apolipoprotein B (ApoB)'), 'Apolipoprotein B');
  assert.equal(normalizeBiomarker('Omega‑3 Index'), 'Omega-3 Index');
  assert.equal(normalizeBiomarker(''), null);
  assert.equal(normalizeBiomarker(42), null);
});

test('values: numbers, numeric text, comparators and plain text', () => {
  assert.deepEqual(parseValue(98), { value: 98, valueText: null, comparator: null });
  assert.deepEqual(parseValue(' 4.7 '), { value: 4.7, valueText: null, comparator: null });
  assert.deepEqual(parseValue('1,234'), { value: 1234, valueText: null, comparator: null });
  assert.deepEqual(parseValue('<5'), { value: 5, valueText: '<5', comparator: '<' });
  assert.deepEqual(parseValue('>= 60'), { value: 60, valueText: '>=60', comparator: '>=' });
  assert.deepEqual(parseValue('≤0.5'), { value: 0.5, valueText: '≤0.5', comparator: '<=' });
  assert.deepEqual(parseValue('Negative'), { value: null, valueText: 'Negative', comparator: null });
  assert.deepEqual(parseValue(''), { value: null, valueText: null, comparator: null });
  assert.deepEqual(parseValue(Number.NaN), { value: null, valueText: null, comparator: null });
});

test('ranges: between, one-sided, objects, and text that is not a range', () => {
  assert.deepEqual(parseRange('3.5-5.0'), { low: 3.5, high: 5 });
  assert.deepEqual(parseRange('3.5 – 5.0'), { low: 3.5, high: 5 });
  assert.deepEqual(parseRange('0-99'), { low: 0, high: 99 });
  assert.deepEqual(parseRange('-1.0 - 2'), { low: -1, high: 2 });
  assert.deepEqual(parseRange('10 to 20'), { low: 10, high: 20 });
  assert.deepEqual(parseRange('<5'), { low: null, high: 5 });
  assert.deepEqual(parseRange('<=5'), { low: null, high: 5 });
  assert.deepEqual(parseRange('>=60'), { low: 60, high: null });
  assert.deepEqual(parseRange('> 60'), { low: 60, high: null });
  assert.deepEqual(parseRange({ low: 1, high: '2.5' }), { low: 1, high: 2.5 });
  assert.deepEqual(parseRange({ low: null, high: null }), null);
  assert.equal(parseRange('Negative'), null);
  assert.equal(parseRange('5'), null);
  assert.equal(parseRange(undefined), null);
});

test('status: the source status wins, else optimal, then reference range', () => {
  const ref = { low: 0, high: 99 };
  const optimal = { low: 0, high: 70 };
  assert.equal(computeStatus({ value: 60, ref, optimal }), 'optimal');
  assert.equal(computeStatus({ value: 85, ref, optimal }), 'in_range');
  assert.equal(computeStatus({ value: 120, ref, optimal }), 'out_of_range');
  assert.equal(computeStatus({ value: 99, ref }), 'in_range');
  assert.equal(computeStatus({ value: null, ref }), 'unknown');
  assert.equal(computeStatus({ value: 5 }), 'unknown');
  assert.equal(computeStatus({ value: 120, ref, sourceStatus: 'Normal' }), 'in_range');
  assert.equal(computeStatus({ value: 5, comparator: '<', ref: { low: null, high: 5 } }), 'in_range');
  assert.equal(computeStatus({ value: 60, comparator: '>', ref: { low: null, high: 60 } }), 'out_of_range');
  assert.equal(computeStatus({ value: 60, comparator: '<', ref: { low: 60, high: null } }), 'out_of_range');
  assert.equal(mapStatus('Out of Range'), 'out_of_range');
  assert.equal(mapStatus('HIGH'), 'out_of_range');
  assert.equal(mapStatus('In Range'), 'in_range');
  assert.equal(mapStatus('whatever'), null);
});

test('normalizeResult builds a row or gives a reason', () => {
  const r = normalizeResult({ biomarker: 'LDL-C', collectedOn: '2026-03-04T08:00:00Z', value: '128', unit: 'mg/dL', referenceRange: '0-99', optimalRange: '<70', category: 'Heart', sourceId: 7 });
  assert.equal(r.ok, true);
  assert.equal(r.row.biomarker, 'LDL Cholesterol');
  assert.equal(r.row.collectedOn, '2026-03-04');
  assert.equal(r.row.value, 128);
  assert.equal(r.row.refHigh, 99);
  assert.equal(r.row.optimalHigh, 70);
  assert.equal(r.row.optimalLow, null);
  assert.equal(r.row.status, 'out_of_range');
  assert.equal(r.row.sourceId, '7');
  assert.equal(normalizeResult({ collectedOn: '2026-03-04', value: 1 }).reason, 'biomarker missing');
  assert.equal(normalizeResult({ biomarker: 'TSH', collectedOn: 'March', value: 1 }).reason, 'collectedOn must be YYYY-MM-DD');
  assert.equal(normalizeResult({ biomarker: 'TSH', collectedOn: '2026-03-04' }).reason, 'value missing');
});

test('normalizeImport: duplicates collapse to the last; a bad file is one rejection', () => {
  const { rows, rejected } = normalizeImport({
    results: [
      { biomarker: 'HbA1c', collectedOn: '2026-03-04', value: 5.4 },
      { biomarker: 'Hemoglobin A1c', collectedOn: '2026-03-04', value: 5.5 },
      { biomarker: 'HbA1c', collectedOn: '2025-09-01', value: 5.6 },
      { nope: true },
    ],
  });
  assert.equal(rows.length, 2);
  assert.equal(rows.find((r) => r.collectedOn === '2026-03-04').value, 5.5);
  assert.deepEqual(rejected, [{ index: 3, reason: 'biomarker missing' }]);
  assert.equal(normalizeImport([]).rejected.length, 1);
});
