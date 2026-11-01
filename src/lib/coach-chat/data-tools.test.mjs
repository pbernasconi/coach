import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activitiesList, activityBrief, bestsText, checkDataCall, halves, loadText, manualLaps, peakRanks } from './data-tools.mjs';

const today = '2026-10-31';

test('checkDataCall checks refs, ranges and weeks', () => {
  assert.deepEqual(checkDataCall('get_activity', { ref: '20810678999' }, today), { ok: true, value: { tool: 'get_activity', ref: '20810678999', sport: null } });
  assert.equal(checkDataCall('get_activity', { ref: '2026-11-02' }, today).ok, false);
  assert.equal(checkDataCall('get_activity', {}, today).ok, false);
  assert.equal(checkDataCall('find_activities', { from: '2026-01-01' }, today).ok, false);
  assert.deepEqual(checkDataCall('find_activities', { from: '2026-10-01', sport: 'run' }, today), { ok: true, value: { tool: 'find_activities', from: '2026-10-01', to: today, sport: 'run' } });
  assert.deepEqual(checkDataCall('get_load', { weeks: 99 }, today), { ok: true, value: { tool: 'get_load', weeks: 26 } });
  assert.deepEqual(checkDataCall('get_load', {}, today), { ok: true, value: { tool: 'get_load', weeks: 8 } });
});

// Paolo's run of 2026-10-31: easy start, then a fast second half (the "5k test inside a 10k").
const paces = [322, 314, 311, 301, 285, 276, 273, 266, 268];
const hrs = [137, 152, 150, 161, 164, 165, 169, 168, 164];
const splits = paces.map((s, i) => ({ index: i + 1, distance: 1000, moving: s, elapsed: s, speed: 1000 / s, gapSpeed: 1000 / s, elevDiff: 0, hr: hrs[i] }));

test('halves finds a negative split and the HR drift', () => {
  const h = halves(splits);
  assert.ok(h);
  assert.ok(h.paceDelta < -30, `second half faster: ${h.paceDelta}`);
  assert.ok(h.drift != null && Math.abs(h.drift) < 10);
  assert.equal(halves(splits.slice(0, 3)), null);
});

test('manualLaps drops 1 km auto-laps but keeps interval laps', () => {
  assert.deepEqual(manualLaps([...splits, { ...splits[0], index: 10, distance: 186 }]), []);
  const intervals = [{ ...splits[0], distance: 2000 }, { ...splits[1], distance: 400 }, { ...splits[2], distance: 400 }];
  assert.equal(manualLaps(intervals).length, 3);
});

test('peakRanks ranks a 5 km against the year and all time', () => {
  const all = [
    { metric: 'run', span: 5000, value: 1368, day: today, activityId: 'now' },
    { metric: 'run', span: 5000, value: 1272, day: '2025-05-22', activityId: 'old' },
    { metric: 'run', span: 5000, value: 1400, day: '2026-09-01', activityId: 'sep' },
    { metric: 'run', span: 5000, value: 1300, day: '2026-10-01', activityId: 'oct' },
    { metric: 'run', span: 5000, value: 1200, day: '2026-11-05', activityId: 'later' },
  ];
  const [r] = peakRanks(all.slice(0, 1), all, today);
  assert.equal(r.yearRank, 2);
  assert.equal(r.yearCount, 3);
  assert.equal(r.allRank, 3);
  assert.equal(r.yearBest?.activityId, 'oct');
  assert.equal(r.allBest?.activityId, 'old');
});

test('activityBrief has splits, halves, best efforts, ranks and the plan', () => {
  const v = {
    stravaId: '20810678999', name: 'Afternoon Run', sportType: 'Run', layout: 'run', day: today, startLocal: `${today}T16:22:26`,
    place: 'San Francisco', trainer: false, description: null,
    stats: { distance: 9844, moving: 2920, elapsed: 3061, elevGain: 65, avgSpeed: 3.37, avgGapSpeed: 3.4, avgHr: 158, maxHr: 175, avgCadence: 168 },
    effort: { tss: 61, tssMethod: 'hr_stream' },
    weather: { tempC: 15.8, feelsLikeC: 13.5, humidityPct: 65, windKmh: 13 },
    watch: { aerobicTe: 3.6, anaerobicTe: 1.4, teLabel: 'Tempo', vo2max: 53 },
    splits, splitsSource: 'strava', laps: [],
    bestEfforts: [{ label: '5K', distance: 5000, seconds: 1421, prRank: null }], bestEffortsSource: 'strava',
    hrZones: [{ zone: 1, name: 'Endurance', min: 0, max: 130, seconds: 100 }, { zone: 2, name: 'Moderate', min: 130, max: 150, seconds: 600 }, { zone: 3, name: 'Tempo', min: 150, max: 168, seconds: 1800 }, { zone: 4, name: 'Threshold', min: 168, max: 182, seconds: 400 }, { zone: 5, name: 'Anaerobic', min: 182, max: -1, seconds: 0 }],
    powerZones: [], powerCurve: [], fetch: { needed: false },
  };
  const ctx = { planned: { id: 'w1', title: '10k test', duration: 50, tss: 70, compliance: { label: 'Done' } }, load: { before: { ctl: 50, atl: 45, tsb: 9 }, after: { ctl: 50.5, atl: 47, tsb: 8.5 }, dayTss: 61 }, garmin: null, sameRoute: [] };
  const ranks = peakRanks([{ metric: 'run', span: 5000, value: 1368, day: today, activityId: '20810678999' }], [{ metric: 'run', span: 5000, value: 1368, day: today, activityId: '20810678999' }, { metric: 'run', span: 5000, value: 1272, day: '2025-05-22', activityId: 'x' }], today);
  const text = activityBrief(v, ctx, ranks, { thresholdHr: 168 });
  assert.match(text, /Km splits/);
  assert.match(text, /^9: 4:28\/km \| 4:28\/km \| 164/m);
  assert.match(text, /negative split/);
  assert.match(text, /5K 23:41/);
  assert.match(text, /5 km 22:48 \(4:34\/km\): #1 of 1 in the year before it/);
  assert.match(text, /#2 all time \(best 21:12/);
  assert.match(text, /"10k test"/);
  assert.match(text, /threshold HR 168/);
  assert.match(text, /aerobic TE 3.6/);
  assert.doesNotMatch(text, /Laps/);
});

test('activitiesList filters by sport and shows ids', () => {
  const rows = [
    { strava_activity_id: '1', day: today, time: '16:22', name: 'Run', sport_type: 'Run', distance: 9844, moving_time: 2920, average_speed: 3.37, average_heartrate: 158, weighted_average_watts: null, average_watts: null, tss: 61, total_elevation_gain: 65 },
    { strava_activity_id: '2', day: '2026-10-30', time: '07:00', name: 'Zwift', sport_type: 'VirtualRide', distance: 30000, moving_time: 3600, average_speed: 8, average_heartrate: 140, weighted_average_watts: 230, average_watts: 220, tss: 70, total_elevation_gain: 0 },
  ];
  const text = activitiesList(rows, { from: '2026-10-25', to: today, sport: 'run' });
  assert.match(text, /^1 {2}Sat 2026-10-31 16:22 {2}Run "Run" {2}9.84 km, 48:40, 4:57\/km, \+65 m, HR 158, TSS 61$/);
  assert.match(activitiesList(rows, { from: '2026-10-25', to: today, sport: null }), /NP 230 W/);
  assert.match(activitiesList([], { from: '2026-10-25', to: today, sport: 'swim' }), /No swim activities/);
});

test('bestsText and loadText', () => {
  const cell = { value: 1272, date: '2025-05-22', activityId: 'x' };
  const t = bestsText({ run: [{ span: 5000, cells: { all: cell, d90: null, d28: null } }], power: [{ span: 1200, cells: { all: { value: 280, date: '2026-09-01', activityId: 'y' }, d90: null, d28: null } }] });
  assert.match(t, /5 km: all time 21:12 \(4:14\/km\) 2025-05-22 \(x\) \| 90 d – /);
  assert.match(t, /20 min: all time 280 W/);

  const days = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.parse('2026-10-02T12:00:00Z') + i * 86_400_000).toISOString().slice(0, 10);
    days.push({ date: d, ctl: 40 + i * 0.5, atl: 45, tsb: -5 + i * 0.2, tss: 60 });
  }
  const l = loadText(days, [{ day: '2026-10-30', sport_type: 'Run', moving_time: 3600 }], today, 2);
  assert.match(l, /Week of 2026-10-19: TSS 420, 0.0 h; end CTL 51.5 \(\+3.5\)/);
  assert.match(l, /Week of 2026-10-26 \(this week, so far\): TSS 360, 1.0 h \(run 1.0\)/);
  assert.match(l, /Today: CTL 54.5/);
});
