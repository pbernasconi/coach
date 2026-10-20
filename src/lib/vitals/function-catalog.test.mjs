// Synthetic fixtures only: the repo is public. The shapes copy Function's results-report, biomarker-data and
// pending-schedules responses; every name, value, id and date here is made up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bandsFor, catalogFromReport, contentFromBiomarkerData, orderInCategory, pickRecommendation, plannedDraws, rangeOf, sexDetailId,
  sexFromRequisitions, slug, statusOf, tabsFor,
} from './function-catalog.mjs';

const rec = (o = {}) => ({
  questBiomarkerId: 'q-1',
  rangeString: '10.0-20.0',
  rangeMinDisplay: '10.0',
  rangeMaxDisplay: '20.0',
  rangeMinOperator: '>=',
  rangeMaxOperator: '<=',
  optimalRangeMin: '12',
  optimalRangeMax: '18',
  optimalRange: '[12,18]',
  outOfRangeType: 'in_range',
  units: 'u/L',
  neutral: false,
  type: 4,
  categories: ['cat-a'],
  currentResult: { dateOfService: '2030-02-01', displayResult: '15.0', calculatedResult: '15.0', inRange: true, neutral: null },
  biomarker: {
    id: 'bm-1',
    name: 'Example Marker',
    oneLineDescription: 'A made-up marker.',
    status: null,
    categories: [{ id: 'cat-a', categoryName: 'Alpha' }],
    sexDetails: [{ id: 'sd-m', sex: 'Male' }, { id: 'sd-all', sex: 'All' }],
  },
  biomarkerResults: [
    { biomarkerName: '', dateOfService: '2029-08-01', testResult: '9.0' },
    { biomarkerName: 'Example Marker', dateOfService: '2030-02-01', testResult: '15.0' },
  ],
  interpretation: { kind: 'continuous_range', rangeMin: 10, rangeMax: 20, rangeMinOperator: '>=', rangeMaxOperator: '<=' },
  ...o,
});

test('status: Function rules for neutral, discontinued, allergen and inRange', () => {
  assert.equal(statusOf(rec()), 'in_range');
  assert.equal(statusOf(rec({ currentResult: { inRange: false } })), 'out_of_range');
  assert.equal(statusOf(rec({ neutral: true })), 'other');
  assert.equal(statusOf(rec({ currentResult: { inRange: true, neutral: true } })), 'other');
  assert.equal(statusOf(rec({ neutral: true, currentResult: { inRange: true, neutral: false } })), 'in_range'); // the result's flag wins
  assert.equal(statusOf(rec({ biomarker: { status: 'discontinued' } })), 'other');
  assert.equal(statusOf(rec({ type: 2, currentResult: { calculatedResult: '0.05' } })), 'in_range');
  assert.equal(statusOf(rec({ type: 2, currentResult: { calculatedResult: '0.4', inRange: true } })), 'out_of_range');
  assert.equal(statusOf({}), 'out_of_range');
});

test('slug: lower case, dashes, % as pct', () => {
  assert.equal(slug('Mean Corpuscular Hemoglobin Concentration (MCHC)'), 'mean-corpuscular-hemoglobin-concentration-mchc');
  assert.equal(slug('Neutrophils %'), 'neutrophils-pct');
  assert.notEqual(slug('Neutrophils %'), slug('Neutrophils'));
  assert.equal(slug('Stress & Aging'), 'stress-aging');
  assert.equal(slug(null), '');
});

test('sex detail and sex', () => {
  assert.equal(sexDetailId([{ id: 'a', sex: 'Female' }, { id: 'b', sex: 'Male' }, { id: 'c', sex: 'All' }], 'Male'), 'b');
  assert.equal(sexDetailId([{ id: 'b', sex: 'Male' }, { id: 'c', sex: 'All' }], null), 'c');
  assert.equal(sexDetailId(null, 'Male'), null);
  assert.equal(sexFromRequisitions([{ patient: { biologicalSex: 'MALE' } }]), 'Male');
  assert.equal(sexFromRequisitions('x'), null);
});

test('range and bands follow the operators', () => {
  assert.deepEqual(rangeOf(rec()), { min: 10, max: 20, minOp: '>=', maxOp: '<=', text: '10.0-20.0' });
  assert.deepEqual(
    bandsFor({ min: 10, max: 20, minOp: '>=', maxOp: '<=' }).map((b) => [b.key, b.text]),
    [['above', '> 20'], ['in', '10–20'], ['below', '< 10']]
  );
  assert.deepEqual(bandsFor({ min: null, max: 200, maxOp: '<' }).map((b) => [b.key, b.text]), [['above', '≥ 200'], ['in', '< 200']]);
  assert.deepEqual(bandsFor({ min: null, max: 5, maxOp: '<=' }).map((b) => b.text), ['> 5', '≤ 5']);
  assert.deepEqual(bandsFor({ min: 40, max: null, minOp: '>' }).map((b) => [b.key, b.text]), [['in', '> 40'], ['below', '≤ 40']]);
  assert.deepEqual(bandsFor({ min: null, max: null }), []);
  // Without an interpretation, the display fields are used.
  assert.deepEqual(rangeOf(rec({ interpretation: null, rangeMinDisplay: '', rangeMaxDisplay: '130', rangeMinOperator: null, rangeMaxOperator: '<' })).max, 130);
  assert.equal(rangeOf(rec({ interpretation: { kind: 'qualitative' }, rangeMinDisplay: '', rangeMaxDisplay: '' })).max, null);
});

test('catalogFromReport: names, categories, result names, order and counts', () => {
  const report = {
    data: {
      biomarkerResultsRecord: [
        rec(),
        rec({ biomarker: { ...rec().biomarker, id: 'bm-2', name: 'LDL-C' }, categories: ['cat-b'], currentResult: { inRange: false }, outOfRangeType: 'above', biomarkerResults: [{ biomarkerName: '', dateOfService: '2030-02-01', testResult: '150' }] }),
        rec({ biomarker: { ...rec().biomarker, id: 'bm-1' } }), // a duplicate key is skipped
        { biomarker: { name: 'No id' } },
      ],
      categories: [
        { category: { id: 'cat-b', categoryName: 'Beta' }, biomarkerIds: ['bm-2', 'bm-gone'], description: 'Second' },
        { category: { id: 'cat-a', categoryName: 'Alpha' }, biomarkerIds: ['bm-1', 'bm-2'] },
        { category: { id: 'cat-c', categoryName: 'Empty' }, biomarkerIds: ['bm-gone'] },
      ],
    },
  };
  const { biomarkers, categories } = catalogFromReport(report, 'Male');
  assert.deepEqual(biomarkers.map((b) => b.key), ['bm-1', 'bm-2']);
  const [a, b] = biomarkers;
  assert.equal(a.slug, 'example-marker');
  assert.deepEqual(a.resultNames, ['Example Marker']);
  assert.deepEqual(b.resultNames, ['LDL Cholesterol']); // the lab_results name (labs.mjs aliases)
  assert.deepEqual(a.categories, ['Alpha']);
  assert.deepEqual(b.categories, ['Beta', 'Alpha']);
  assert.equal(a.sexDetailId, 'sd-m');
  assert.equal(a.currentDisplay, '15.0');
  assert.equal(a.currentOn, '2030-02-01');
  assert.equal(b.status, 'out_of_range');
  assert.equal(a.optimalLow, 12);
  // Categories by name; empty ones and unknown ids dropped; positions follow the order.
  assert.deepEqual(categories.map((c) => [c.name, c.position, c.biomarkerKeys]), [['Alpha', 0, ['bm-1', 'bm-2']], ['Beta', 1, ['bm-2']]]);
  assert.deepEqual(catalogFromReport(null), { biomarkers: [], categories: [] });
});

const DATA = {
  whyItMatters: 'Why text.',
  resourcesCited: ['Source one.', '', 'Source two.'],
  recommendations: [
    { inRange: false, outOfRangeType: 'above', summaryDescription: 'High summary.', causesDescription: 'High causes.', symptomsDescription: null },
    { inRange: false, outOfRangeType: 'below', summaryDescription: 'Low summary.' },
    { inRange: true, outOfRangeType: null, summaryDescription: 'Normal summary.' },
    { inRange: true, summaryDescription: '' },
  ],
};

test('content and tabs: why it matters, the recommendation for the status, sources', () => {
  const c = contentFromBiomarkerData(DATA);
  assert.equal(c.recommendations.length, 3);
  assert.deepEqual(c.sources, ['Source one.', 'Source two.']);
  assert.deepEqual(tabsFor(c, 'in_range').map((t) => t.title), ['Why it matters', 'Summary', 'Sources']);
  assert.equal(tabsFor(c, 'in_range')[1].body, 'Normal summary.');
  assert.deepEqual(tabsFor(c, 'out_of_range', 'above').map((t) => t.title), ['Why it matters', 'Summary', 'Causes', 'Sources']);
  assert.equal(tabsFor(c, 'out_of_range', 'BELOW')[1].body, 'Low summary.');
  assert.equal(tabsFor(c, 'out_of_range', 'error')[1].body, 'High summary.'); // no match: the first out-of-range one
  assert.deepEqual(tabsFor(c, 'other').map((t) => t.title), ['Why it matters', 'Sources']);
  assert.equal(tabsFor(c, 'in_range').at(-1).body, '1. Source one.\n\n2. Source two.');
  assert.equal(pickRecommendation(null, 'in_range'), null);
  assert.deepEqual(tabsFor(null, 'in_range'), []);
  assert.equal(contentFromBiomarkerData('x'), null);
});

test('planned draws: the window and the visit; completed ones dropped', () => {
  const rows = plannedDraws([
    { id: 'p1', type: 'ANNUAL', recommendedDate: '2030-03-01T10:00:00Z', schedulerRangeStart: '2030-03-01T10:00:00Z', schedulerRangeEnd: '2031-03-01T10:00:00Z', scheduled: false, completed: false, nextVisit: { date: null } },
    { id: 'p2', completed: true },
    { id: 'p3', nextVisit: { date: '2030-05-02', scheduled: true, startDate: '2030-04-01', endDate: '2030-06-01' } },
    'x',
  ]);
  assert.deepEqual(rows, [
    { key: 'p1', type: 'ANNUAL', recommendedOn: '2030-03-01', windowStart: '2030-03-01', windowEnd: '2031-03-01', visitOn: null, scheduled: false },
    { key: 'p3', type: null, recommendedOn: null, windowStart: '2030-04-01', windowEnd: '2030-06-01', visitOn: '2030-05-02', scheduled: true },
  ]);
  assert.deepEqual(plannedDraws(null), []);
});

test('order in a category: out of range, in range, other; by name', () => {
  const items = [
    { name: 'B', status: 'in_range' }, { name: 'Z', status: 'out_of_range' }, { name: 'A', status: 'other' }, { name: 'A', status: 'in_range' },
  ];
  assert.deepEqual(orderInCategory(items).map((i) => `${i.status}:${i.name}`), ['out_of_range:Z', 'in_range:A', 'in_range:B', 'other:A']);
});
