import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importFromResultsReport, notesFromResponse } from './function-api.mjs';
import { normalizeImport } from './labs.mjs';

// Synthetic values in the shape of results-report (no real results).
const report = {
  data: {
    biomarkerResultsRecord: [
      {
        optimalRangeMin: '', optimalRangeMax: '100', units: 'mg/dL', categories: ['Heart'],
        biomarker: { name: 'LDL Cholesterol', categories: [{ categoryName: 'Heart' }] },
        biomarkerResults: [
          { id: 'a1', biomarkerName: 'LDL Cholesterol', dateOfService: '2030-01-15T00:00:00.000Z', testResult: '120', measurementUnits: 'mg/dL', testResultOutOfRange: true, questReferenceRange: '<100', visible: true },
          { id: 'a2', biomarkerName: 'LDL Cholesterol', dateOfService: '2029-07-01', testResult: '90', measurementUnits: 'mg/dL', testResultOutOfRange: false, questReferenceRange: '<100', visible: true },
          { id: 'a3', biomarkerName: 'LDL Cholesterol', dateOfService: '2029-01-01', testResult: '95', visible: false },
        ],
      },
      { biomarker: { name: 'HIV' }, categories: ['Immunity'], biomarkerResults: [{ id: 'b1', biomarkerName: '', dateOfService: '2030-01-15', testResult: 'NON-REACTIVE' }] },
      { biomarker: { name: 'Broken' }, biomarkerResults: [{ id: 'c1', dateOfService: 'n/a', testResult: '1' }] },
    ],
  },
};

test('every visible draw becomes one result, with the ranges and the source flag', () => {
  const file = importFromResultsReport(report);
  assert.equal(file.results.length, 3);
  const [newest] = file.results;
  assert.deepEqual(newest, {
    biomarker: 'LDL Cholesterol', collectedOn: '2030-01-15', category: 'Heart', value: '120', unit: 'mg/dL',
    referenceRange: '<100', optimalRange: { low: null, high: 100 }, status: 'out of range', sourceId: 'a1',
  });
  assert.equal(file.results[2].biomarker, 'HIV');
});

test('the result passes the lab import validation', () => {
  const { rows, rejected } = normalizeImport(importFromResultsReport(report));
  assert.equal(rejected.length, 0);
  assert.equal(rows.length, 3);
  assert.equal(rows.find((r) => r.sourceId === 'a1').status, 'out_of_range');
});

test('a bad body gives no results', () => {
  assert.deepEqual(importFromResultsReport(null), { source: 'function', results: [] });
});

test('clinician notes: one row per note, in order, with the date and category', () => {
  const rows = notesFromResponse([
    { requisition_id: 'r1', date: '2030-01-20T10:00:00.000000Z', visits: [], notes: [
      { note: ' Your LDL is high. ', category: { id: 'c', categoryName: 'Heart' } },
      { note: '', category: null },
      { note: 'Keep training.', category: null },
    ] },
    { requisition_id: null, date: '2030-01-20', notes: [{ note: 'x' }] },
  ]);
  assert.deepEqual(rows.map(({ raw, ...r }) => r), [
    { requisitionId: 'r1', position: 0, notedOn: '2030-01-20', category: 'Heart', body: 'Your LDL is high.' },
    { requisitionId: 'r1', position: 2, notedOn: '2030-01-20', category: null, body: 'Keep training.' },
  ]);
  assert.deepEqual(notesFromResponse(null), []);
});
