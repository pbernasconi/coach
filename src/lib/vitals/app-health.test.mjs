import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays } from './readiness.mjs';
import { BOARD_METRICS, boardOf } from './board.mjs';
import { dexaView } from './bodyspec.mjs';
import { EMPTY_TEXT, TREND_KEYS, healthResponse, statusSection } from './app-health.mjs';

const TODAY = '2026-10-22';
const NOW = Date.parse('2026-10-22T16:00:00Z');
const ok = (value) => ({ ok: true, value });

/** Every board metric on every day (VO2max once a week, as the watch sends it): the worst case for size. */
function fullRows(days) {
  const rows = [];
  for (let i = 0; i < days + 60; i++) {
    const date = addDays(TODAY, -i);
    for (const metric of Object.keys(BOARD_METRICS)) if (metric !== 'vo2max' || i % 7 === 0) rows.push({ date, metric, value: metric === 'wear_min' ? 1400 : 40 + ((i * 7) % 23) + 0.37 });
  }
  return rows;
}

function fullBoard(days) {
  return boardOf(fullRows(days), { today: TODAY, days, syncedThrough: TODAY });
}

const garmin = { connected: true, lastSuccessAt: '2026-10-22T13:00:00Z', syncedThrough: TODAY, backfill: null, warning: null };
const scan = (d, fat) => ({ resultId: d, scanDate: d, location: 'SF', bodyFatPct: fat, leanMassKg: 65.2, totalMassKg: 82, fatMassKg: 14, vatMassKg: 0.42, androidGynoidRatio: 1, boneDensity: null, rmrKcal: null, regions: null, percentiles: null });
const labs = {
  categories: [{ category: 'Heart', outOfRange: 1, biomarkers: [
    { biomarker: 'ApoB', unit: 'mg/dL', refLow: null, refHigh: 90, latest: { value: 104, valueText: null, status: 'out_of_range' } },
    { biomarker: 'HDL', unit: 'mg/dL', refLow: 40, refHigh: null, latest: { value: 60, valueText: null, status: 'in_range' } },
  ] }],
  draws: ['2026-09-01'],
};
const readiness = { status: 'ok', flags: ['Last night’s sleep was 5:40 (under 6 h)'], lastSampleDate: TODAY };

function response(days = 30, over = {}) {
  return healthResponse({
    now: NOW, days, today: TODAY, garmin, readiness: ok(readiness), board: ok(fullBoard(days)),
    dexa: ok(dexaView([scan('2026-03-01', 19.1), scan('2026-09-15', 18.4)])), labs: ok(labs), ...over,
  });
}

test('every section, display-ready', () => {
  const r = response();
  assert.equal(r.days, 30);
  assert.equal(r.status.ok, true);
  assert.equal(r.status.text, 'Garmin: synced 3 h ago, through Oct 22');
  assert.match(r.status.nightText, /^last night \d+:\d\d asleep$/);
  assert.deepEqual(r.readiness, { ok: true, status: 'ok', label: 'One flag', text: 'One signal is off. Keep the plan, but watch how the session feels.', flags: readiness.flags });
  assert.deepEqual(r.vitals.items.map((i) => i.key), ['hrv', 'rhr', 'sleep', 'score', 'bb', 'ready', 'stress', 'weight']);
  const hrv = r.vitals.items[0];
  assert.ok(['below', 'above', 'inRange'].includes(hrv.status));
  assert.equal(typeof hrv.range.min, 'number');
  assert.equal(r.vitals.items[7].range, null);
  assert.deepEqual(r.trends.items.map((i) => i.key), TREND_KEYS);
  const t = r.trends.items[0];
  assert.equal(t.points.length, 30);
  assert.match(t.normalText, /^normal \d+–\d+ ms$/);
  assert.ok(t.band);
  assert.equal(r.trends.items.find((i) => i.key === 'steps').band, null);
  assert.ok(r.trends.items.find((i) => i.key === 'weight').trendLine.length > 0);
  assert.equal(r.body.dexa.dateText, 'Sep 15, 2026');
  assert.deepEqual(r.body.dexa.measures[0], { key: 'bodyFatPct', label: 'Body fat', value: 18.4, valueText: '18.4', unit: '%', changeText: '▼ 0.7 pts since last', tone: 'good' });
  assert.equal(r.body.weight.unit, 'kg');
  assert.deepEqual(r.labs.counts, { total: 2, inRange: 1, outOfRange: 1, noRange: 0 });
  assert.deepEqual(r.labs.items[0], { name: 'ApoB', valueText: '104', unit: 'mg/dL', rangeText: '≤ 90', status: 'out_of_range', statusText: 'Out of range' });
  assert.equal(r.emptyText, null);
});

test('a failed loader fails only its section', () => {
  const r = response(30, { board: { ok: false }, labs: { ok: false }, garmin: null });
  assert.deepEqual([r.status, r.vitals, r.trends, r.body, r.labs], [{ ok: false }, { ok: false }, { ok: false }, { ok: false }, { ok: false }]);
  assert.equal(r.readiness.ok, true);
  assert.equal(r.emptyText, null);
});

test('no health data at all: empty lists and emptyText', () => {
  const r = healthResponse({
    now: NOW, days: 30, today: TODAY, garmin: { connected: false, warning: { level: 'info', text: 'x' } },
    readiness: ok({ status: 'unknown', flags: [], lastSampleDate: null }), board: ok(boardOf([], { today: TODAY, days: 30, syncedThrough: null })),
    dexa: ok(dexaView([])), labs: ok({ categories: [], draws: [] }),
  });
  assert.equal(r.emptyText, EMPTY_TEXT);
  assert.deepEqual(r.vitals.items, []);
  assert.deepEqual(r.trends.items, []);
  assert.equal(r.body.weight, null);
  assert.equal(r.body.dexa, null);
  assert.equal(r.labs.items.length, 0);
  assert.equal(r.status.text, 'Garmin: not set up');
  assert.equal(r.status.warning, null);
});

test('statusSection: the warning when it is more than info, the night when it is missing', () => {
  const s = statusSection({ ...garmin, warning: { level: 'warn', text: 'Garmin has not synced for 3 days.' } }, { status: 'waiting', sleepMin: null }, NOW);
  assert.deepEqual(s.warning, { level: 'warn', text: 'Garmin has not synced for 3 days.' });
  assert.equal(s.nightText, "waiting for last night's sleep");
  assert.equal(s.nightIn, false);
});

test('payload: under 40 KB at 90 days with every metric on every day', () => {
  const r = response(90);
  const bytes = Buffer.byteLength(JSON.stringify(r));
  assert.ok(r.trends.items.every((i) => i.points.length <= 90));
  assert.ok(bytes < 40 * 1024, `${bytes} bytes`);
});

test('a metric with no reading is left out of vitals and trends', () => {
  const noWeight = boardOf(
    fullRows(30).filter((r) => r.metric !== 'weight_kg'),
    { today: TODAY, days: 30, syncedThrough: TODAY }
  );
  const r = response(30, { board: ok(noWeight) });
  assert.ok(!r.vitals.items.some((i) => i.key === 'weight'));
  assert.ok(!r.trends.items.some((i) => i.key === 'weight'));
  assert.ok(r.vitals.items.every((i) => i.valueText !== null));
});
