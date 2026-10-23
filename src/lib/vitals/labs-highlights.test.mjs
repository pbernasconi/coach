import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyIndex, mergeAliases, mergeByCatalog, pickHighlights, trend } from './labs-highlights.mjs';

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

test('merge by catalog: two result names of one marker become one, with the catalog status', () => {
  const r = (collectedOn, status = 'in_range') => ({ collectedOn, value: 4.5, valueText: null, status });
  const b = (biomarker, history) => ({ biomarker, category: 'Nutrients', latest: history.at(-1), history });
  const merged = mergeByCatalog(
    [
      b('Omega-3 Total', [r('2025-08-01')]),
      b('Omega-3 Total / OmegaCheck', [r('2026-01-10')]),
      b('Sodium', [r('2026-01-10', 'out_of_range')]),
      b('Iron', [r('2026-01-10')]),
    ],
    [
      { resultNames: ['Omega-3 Total', 'Omega-3 Total / OmegaCheck'], status: 'out_of_range' },
      { resultNames: ['Sodium'], status: 'in_range' },
    ]
  );
  assert.equal(merged.length, 3);
  assert.equal(merged[0].biomarker, 'Omega-3 Total / OmegaCheck');
  assert.deepEqual(merged[0].history.map((h) => h.collectedOn), ['2025-08-01', '2026-01-10']);
  assert.equal(merged[0].latest.status, 'out_of_range');
  assert.equal(merged[0].history.at(-1), merged[0].latest);
  assert.equal(merged[1].latest.status, 'in_range'); // Function's status wins over the draw's flag
  assert.equal(merged[2].biomarker, 'Iron'); // not in the catalog: unchanged
});

test('merge by catalog: a row under the catalog name joins the draws under its result name', () => {
  const r = (collectedOn) => ({ collectedOn, value: 4.5, valueText: null, status: 'unknown' });
  const b = (biomarker, history) => ({ biomarker, category: 'Nutrients', latest: history.at(-1), history });
  const merged = mergeByCatalog(
    [b('Omega-3 Total', [r('2025-08-01')]), b('Omega-3 Total / OmegaCheck', [r('2026-01-14')])],
    [{ resultNames: ['Omega-3 Total / OmegaCheck'], name: 'Omega-3 Total', status: 'out_of_range' }]
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].latest.status, 'out_of_range');
  assert.equal(keyIndex(merged[0].biomarker), keyIndex('Omega-3 Total'));
});

test('merge aliases: one Omega-3 row, the one with a range', () => {
  const r = (collectedOn, status) => ({ collectedOn, value: 4.5, valueText: null, status });
  const b = (biomarker, refLow, history) => ({ biomarker, category: 'Nutrients', refLow, refHigh: null, latest: history.at(-1), history });
  const merged = mergeAliases([
    b('Omega-3 Total', null, [r('2025-08-01', 'unknown')]),
    b('Iron', 60, [r('2025-08-01', 'in_range')]),
    b('Omega-3 Total / OmegaCheck', 5.4, [r('2025-08-01', 'out_of_range')]),
  ]);
  assert.deepEqual(merged.map((m) => m.biomarker), ['Omega-3 Total / OmegaCheck', 'Iron']);
  assert.equal(merged[0].latest.status, 'out_of_range');
  assert.equal(merged[0].history.length, 1);
});
