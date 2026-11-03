import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarText, checkContextCall, dexaText, healthText, labsText } from './context-tools.mjs';

const today = '2026-11-03';

test('checkContextCall: ranges, defaults and limits', () => {
  assert.deepEqual(checkContextCall('get_plan', { from: '2026-10-01', to: '2026-10-31' }, today), { ok: true, value: { tool: 'get_plan', from: '2026-10-01', to: '2026-10-31' } });
  assert.match(/** @type {any} */ (checkContextCall('get_plan', { from: '2026-01-01', to: '2026-10-31' }, today)).problem, /at most 63 days/);
  assert.match(/** @type {any} */ (checkContextCall('get_calendar', { from: '2026-11-10', to: '2026-11-01' }, today)).problem, /from is after to/);
  assert.match(/** @type {any} */ (checkContextCall('get_calendar', { from: 'next week' }, today)).problem, /YYYY-MM-DD/);
  assert.deepEqual(checkContextCall('get_health', {}, today), { ok: true, value: { tool: 'get_health', from: '2026-10-21', to: today } });
  assert.match(/** @type {any} */ (checkContextCall('get_health', { from: '2026-11-05', to: '2026-11-06' }, today)).problem, /past/);
  assert.deepEqual(checkContextCall('get_labs', { marker: ' Ferritin ' }, today), { ok: true, value: { tool: 'get_labs', marker: 'Ferritin' } });
  assert.deepEqual(checkContextCall('get_dexa', {}, today), { ok: true, value: { tool: 'get_dexa' } });
  assert.equal(checkContextCall('nope', {}, today).ok, false);
});

test('calendarText: local times, all-day spans, and empty days', () => {
  const t = calendarText([
    { title: 'Standup', start: '2026-11-04T17:00:00Z', end: '2026-11-04T17:30:00Z', allDay: false, location: 'Zoom', calendar: 'me' },
    { title: 'NYC trip', start: '2026-11-10', end: '2026-11-13', allDay: true, location: '', calendar: 'me' },
  ], { from: '2026-11-04', to: '2026-11-14' }, 'America/Los_Angeles');
  assert.match(t, /2026-11-04 Wed 09:00–09:30 {2}Standup @ Zoom {2}\[me\]/);
  assert.match(t, /2026-11-10 all day to 2026-11-12 {2}NYC trip/);
  assert.match(calendarText([], { from: '2026-11-04', to: '2026-11-05' }, 'UTC'), /No events/);
});

test('healthText: a row per day, newest first, RMSSD over SDNN, averages and baselines', () => {
  const rows = [
    { date: '2026-11-01', metric: 'sleep_total_min', value: 450 },
    { date: '2026-11-01', metric: 'hrv_night_avg_ms', value: 62 },
    { date: '2026-11-01', metric: 'hrv_sdnn_ms', value: 90 },
    { date: '2026-11-02', metric: 'sleep_total_min', value: 390 },
    { date: '2026-11-02', metric: 'hrv_night_avg_ms', value: 54 },
    { date: '2026-11-02', metric: 'resting_hr_bpm', value: 52 },
  ];
  const t = healthText(rows, { from: '2026-10-30', to: today }, { hrv: { mean: 60, sd: 5 }, restingHr: null });
  const lines = t.split('\n');
  assert.match(lines[0], /overnight RMSSD/);
  assert.match(lines[1], /^2026-11-02 {2}sleep 6h30, HRV 54ms, RHR 52$/);
  assert.match(lines[2], /^2026-11-01 {2}sleep 7h30, HRV 62ms, RHR –$/);
  assert.match(t, /Average: sleep 7h00, HRV 58ms, RHR 52/);
  assert.match(t, /60-day baseline: HRV 60 ± 5 ms \(RMSSD\)/);
  assert.match(healthText([], { from: '2026-10-30', to: today }, { hrv: null, restingHr: null }), /no health data/);
});

const marker = (biomarker, value, status, history = []) => ({
  biomarker, category: 'x', unit: 'ng/mL', refLow: 30, refHigh: 400, optimalLow: null, optimalHigh: null,
  latest: { collectedOn: '2026-09-01', value, valueText: null, status }, history: [...history, { collectedOn: '2026-09-01', value, valueText: null, status }],
});

test('labsText: out of range and key markers, or one marker\'s history', () => {
  const ms = [
    marker('Ferritin', 25, 'out_of_range', [{ collectedOn: '2026-03-01', value: 40, valueText: null, status: 'in_range' }]),
    marker('Vitamin D', 45, 'in_range'),
    marker('Sodium', 140, 'in_range'),
  ];
  const t = labsText(ms, ['2026-03-01', '2026-09-01'], null);
  assert.match(t, /Out of range \(1\):\nFerritin: 25 ng\/mL \(out of range, range 30–400, was 40 on 2026-03-01\)/);
  assert.match(t, /Key markers:\nVitamin D: 45/);
  assert.doesNotMatch(t, /Sodium/);
  const one = labsText(ms, [], 'ferr');
  assert.match(one, /2026-03-01: 40 \(in range\)\n {2}2026-09-01: 25 \(out of range\)/);
  assert.match(labsText(ms, [], 'zinc'), /No marker like "zinc"/);
  assert.equal(labsText([], [], null), 'No lab results.');
});

test('dexaText: the latest scan with its changes', () => {
  const t = dexaText({
    scans: [{ scanDate: '2026-03-01', location: null, boneDensity: null, rmrKcal: null }, { scanDate: '2026-09-01', location: 'SF', boneDensity: 1.31, rmrKcal: 1820.4 }],
    measures: [
      { key: 'bodyFatPct', label: 'Body fat', unit: '%', value: 15.2, sincePrevious: -1.3, sinceFirst: null },
      { key: 'leanMassKg', label: 'Lean mass', unit: 'kg', value: 62.1, sincePrevious: 0.8, sinceFirst: null },
      { key: 'vatMassKg', label: 'Visceral fat', unit: 'kg', value: null, sincePrevious: null, sinceFirst: null },
    ],
  });
  assert.match(t, /^2 scans: 2026-03-01, 2026-09-01\. Latest 2026-09-01 \(SF\):/);
  assert.match(t, /Body fat: 15\.2 % \(-1\.3 since the last scan\)/);
  assert.match(t, /Lean mass: 62\.1 kg \(\+0\.8 since the last scan\)/);
  assert.doesNotMatch(t, /Visceral/);
  assert.match(t, /Resting metabolic rate: 1820 kcal\/day/);
  assert.equal(dexaText({ scans: [], measures: [] }), 'No DEXA scans.');
});
