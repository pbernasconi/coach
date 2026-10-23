import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays } from './readiness.mjs';
import { boardOf } from './board.mjs';
import { dexaView } from './bodyspec.mjs';
import {
  boardFoot, dexaCaption, dexaChange, fmtDate, hm, isOff, labRangeText, labReading, labTrendView, labsSummary, outliersText,
  rangeBar, verdictOf, vitalCells, weightFoot,
} from './health-view.mjs';

const TODAY = '2026-10-22';

/** 90 days of HRV around 50 with last night at 30, resting HR 45 and sleep 7 h. */
function board({ lastHrv = 30, days = 30 } = {}) {
  const rows = [];
  for (let i = 0; i < 120; i++) {
    const date = addDays(TODAY, -i);
    rows.push({ date, metric: 'hrv_night_avg_ms', value: i === 0 ? lastHrv : i % 2 ? 46 : 54 });
    rows.push({ date, metric: 'resting_hr_bpm', value: i % 2 ? 44 : 46 });
    rows.push({ date, metric: 'sleep_total_min', value: 420 + ((i + 1) % 3) * 10 });
    rows.push({ date, metric: 'wear_min', value: 1400 });
  }
  rows.push({ date: addDays(TODAY, -3), metric: 'stress_avg', value: 30 });
  return boardOf(rows, { today: TODAY, days, syncedThrough: TODAY });
}

test('hm and dates', () => {
  assert.equal(hm(425), '7:05');
  assert.equal(fmtDate('2026-03-05'), 'Mar 5, 2026');
});

test('verdictOf: label and sentence for each status, unknown for a stray one', () => {
  assert.equal(verdictOf('good').label, 'Ready');
  assert.equal(verdictOf('low').label, 'Take it easy');
  assert.equal(verdictOf(/** @type {any} */ ('x')).label, 'Not enough data');
});

test('vitalCells: the web order, normal range text, off in the bad direction, stale days, no data', () => {
  const cells = vitalCells(board());
  assert.deepEqual(cells.map((c) => c.key), ['hrv', 'rhr', 'sleep', 'score', 'bb', 'ready', 'stress', 'weight']);
  const hrv = cells[0];
  assert.equal(hrv.valueText, '30');
  assert.equal(hrv.status, 'below');
  assert.equal(hrv.isOff, true);
  assert.match(hrv.footText, /^normal 46–54$/);
  assert.equal(hrv.staleText, null);
  assert.equal(cells[1].isOff, false);
  assert.match(cells[2].footText, /^normal \d:\d\d–\d:\d\d$/);
  assert.equal(cells[3].footText, 'No data');
  assert.equal(cells[3].valueText, '–');
  assert.equal(cells[6].staleText, 'Oct 19');
  assert.equal(cells[6].footText, 'building normal');
  assert.equal(outliersText(cells), 'Outside your normal: HRV low');
  assert.equal(outliersText(vitalCells(board({ lastHrv: 50 }))), 'All within your normal');
});

test('rangeBar: one range width each side, widened to the value', () => {
  assert.deepEqual(rangeBar({ latest: { date: TODAY, value: 50 }, normal: { low: 40, high: 60 }, status: 'normal' }), { low: 40, high: 60, value: 50, min: 20, max: 80 });
  assert.equal(rangeBar({ latest: { date: TODAY, value: 10 }, normal: { low: 40, high: 60 }, status: 'below' })?.min, 10);
  assert.equal(rangeBar({ latest: null, normal: null, status: null }), null);
  assert.equal(isOff('high', 'below'), false);
});

test('weightFoot: trend and rate, or the day', () => {
  assert.equal(weightFoot({ latest: { date: TODAY }, trend: { text: '83.5', rate: { text: '▼ 0.26 kg/wk' } } }), 'trend 83.5 · ▼ 0.26/wk');
  assert.equal(weightFoot({ latest: { date: TODAY }, trend: null }), 'Oct 22');
  assert.equal(weightFoot({ latest: null, trend: null }), undefined);
});

test('boardFoot: recorded days of the synced ones and the 30/90-day averages', () => {
  const f = boardFoot(board(), 'hrv');
  assert.equal(f.recorded, '30/30 nights');
  assert.match(f.compare ?? '', /^30d \d+ · 90d \d+$/);
  assert.equal(boardFoot(board(), 'steps').compare, null);
});

test('dexaChange and caption', () => {
  const pct = { digits: 1, unit: '%', better: /** @type {const} */ ('down') };
  assert.deepEqual(dexaChange(pct, -0.62, 'since last'), { text: '▼ 0.6 pts since last', glyph: '▼', amountText: '0.6 pts', label: 'since last', tone: 'good' });
  assert.equal(dexaChange(pct, 0.01, '')?.tone, 'neutral');
  assert.equal(dexaChange({ digits: 1, unit: 'kg', better: 'up' }, -1, 'x')?.tone, 'bad');
  assert.equal(dexaChange(pct, null, ''), null);
  const scan = (d, fat) => ({ resultId: d, scanDate: d, location: 'SF', bodyFatPct: fat, leanMassKg: 65, totalMassKg: 82, fatMassKg: 14, vatMassKg: 0.4, androidGynoidRatio: 1, boneDensity: null, rmrKcal: null, regions: null, percentiles: null });
  assert.equal(dexaCaption(dexaView([scan('2026-01-10', 19), scan('2026-09-01', 18)])), 'DEXA scans from BodySpec. 2 scans; latest Sep 1, 2026 at SF.');
  assert.match(dexaCaption(dexaView([])), /^DEXA scans from BodySpec:/);
});

test('labs: numbers, ranges, trend text and the summary', () => {
  assert.equal(labReading({ value: 123.4, valueText: null }), '123');
  assert.equal(labReading({ value: 4.567, valueText: null }), '4.57');
  assert.equal(labReading({ value: null, valueText: 'Negative' }), 'Negative');
  assert.equal(labRangeText(40, null), '≥ 40');
  assert.equal(labRangeText(null, 100), '≤ 100');
  assert.equal(labRangeText(null, null), null);
  assert.deepEqual(labTrendView({ delta: 12, previous: 80, previousOn: '2026-03-04', better: false }), {
    glyph: '▲', amountText: '12', sinceText: "vs Mar '26", titleText: '80 on Mar 4, 2026', tone: 'bad',
  });
  assert.equal(labTrendView({ delta: 0.1, previous: 80, previousOn: '2026-03-04', better: true })?.amountText, 'steady');
  assert.equal(labTrendView(null), null);
  const b = (name, status, value) => ({ biomarker: name, unit: 'mg/dL', refLow: 0, refHigh: 100, latest: { value, valueText: null, status } });
  const cats = [{ category: 'Heart', outOfRange: 1, biomarkers: [b('ApoB', 'out_of_range', 110), b('LDL', 'optimal', 70), b('HDL', 'in_range', 50), b('Lp(a)', 'unknown', 5)] }];
  const s = labsSummary(cats, ['2026-01-01', '2026-09-01']);
  assert.deepEqual(s.counts, { total: 4, inRange: 2, outOfRange: 1, noRange: 1 });
  assert.equal(s.drawDateText, 'Sep 1, 2026');
  assert.deepEqual(s.items, [{ name: 'ApoB', valueText: '110', unit: 'mg/dL', rangeText: '0–100', status: 'out_of_range', statusText: 'Out of range' }]);
  assert.equal(labsSummary([], []).drawDate, null);
  const many = [{ category: 'X', outOfRange: 10, biomarkers: Array.from({ length: 10 }, (_, i) => b(`M${i}`, 'out_of_range', 200)) }];
  assert.equal(labsSummary(many, ['2026-09-01']).items.length, 8);
  assert.equal(labsSummary(many, ['2026-09-01']).moreCount, 2);
});
