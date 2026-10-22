import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bandOf, heroStats, intensityOf, intensityWord, statGroups, tssNote, zoneShares } from './summary.mjs';

const run = {
  layout: 'run',
  weather: { tempC: 16 },
  stats: { distance: 9860, moving: 3387, elapsed: 3434, avgSpeed: 2.91, avgGapSpeed: 2.95, elevGain: 63, avgHr: 150, maxHr: 173, avgCadence: 167, avgWatts: 336, deviceWatts: true, calories: 766, avgTemp: 22 },
  effort: { sufferScore: 20, trimp: 85, tss: 69, tssMethod: 'pace', ftp: 250 },
  watch: {
    aerobicTe: 3.9, anaerobicTe: 0.1, teLabel: 'Tempo', load: 133, vo2max: 50, gctMs: 268, verticalOscCm: 9.0, verticalRatioPct: 8.6, strideM: 1.05,
    powerW: 336, respirationBrpm: 34, staminaStart: 100, staminaEnd: 66, bodyBatteryDelta: -16, performanceCondition: -3,
  },
};

test('bandOf: index of the first cut above the value', () => {
  assert.equal(bandOf(1, [2, 4]), 0);
  assert.equal(bandOf(2, [2, 4]), 1);
  assert.equal(bandOf(9, [2, 4]), 2);
});

test('intensity: IF from TSS and time, and its word', () => {
  assert.equal(intensityOf(100, 3600), 1);
  assert.equal(intensityOf(null, 3600), null);
  assert.equal(intensityWord(0.7), 'Easy');
  assert.equal(intensityWord(0.9), 'Tempo');
  assert.equal(intensityWord(1.1), 'Above threshold');
});

test('heroStats: a run leads with distance, time, pace, elevation, HR, TSS; companions as sub lines', () => {
  const h = heroStats(run);
  assert.deepEqual(h.map((s) => s.key), ['distance', 'time', 'pace', 'elevation', 'hr', 'tss']);
  assert.equal(h[2].sub, 'GAP 5:39');
  assert.equal(h[4].sub, 'max 173');
  assert.match(h[5].sub, /^IF 0\.\d\d · /);
  // Elapsed shows only when the stops add a minute or more.
  assert.equal(h[1].sub, undefined);
  assert.equal(heroStats({ ...run, stats: { ...run.stats, elapsed: 3600 } })[1].sub, '1:00:00 elapsed');
});

test('statGroups: effort, heart, running form; no duplicates of the hero; words place each value', () => {
  const g = statGroups(run);
  assert.deepEqual(g.map((x) => x.id), ['effort', 'heart', 'form']);
  const effort = g[0];
  assert.equal(effort.tag, 'Tempo');
  assert.deepEqual(effort.rows.map((r) => r.key), ['aerobicTe', 'anaerobicTe', 'stamina', 'bodyBattery']);
  assert.equal(effort.rows[0].word, 'Improving');
  assert.equal(effort.rows[1].word, 'No benefit');
  assert.equal(effort.rows[2].word, '34% used');
  assert.equal(effort.rows[3].valueText, '−16');
  assert.deepEqual(effort.footer, ['Garmin load 133', 'Relative Effort 20', 'TRIMP 85', '766 kcal']);
  const heart = g[1];
  assert.deepEqual(heart.rows.map((r) => r.key), ['performanceCondition', 'vo2max', 'respiration']);
  assert.equal(heart.rows[0].word, 'Below baseline');
  const form = Object.fromEntries(g[2].rows.map((r) => [r.key, r]));
  assert.equal(form.cadence.word, 'Average');
  assert.equal(form.gct.word, 'Average');
  assert.equal(form.vo.word, 'Average');
  assert.equal(form.vr.word, 'Average');
  assert.equal(statGroups({ ...run, watch: { ...run.watch, gctMs: 200 } })[2].rows.find((r) => r.key === 'gct').word, 'Top 5%');
  assert.equal(statGroups({ ...run, stats: { ...run.stats, avgCadence: 150 } })[2].rows.find((r) => r.key === 'cadence').word, 'Bottom 5%');
  // Device temperature only without weather.
  assert.ok(!g.flatMap((x) => x.rows).some((r) => r.key === 'temp'));
  assert.ok(statGroups({ ...run, weather: null })[1].rows.some((r) => r.key === 'temp'));
});

test('statGroups: without watch data a run keeps Strava cadence and power', () => {
  const g = statGroups({ ...run, watch: null });
  assert.deepEqual(g.map((x) => x.id), ['effort', 'form']);
  assert.deepEqual(g[1].rows.map((r) => r.key), ['cadence', 'power']);
});

test('tssNote: method, and the run power caveat', () => {
  assert.equal(tssNote(run), 'Coach TSS from grade-adjusted pace.');
  assert.match(tssNote({ ...run, effort: { ...run.effort, tssMethod: 'power' } }), /cycling FTP \(250 W\)/);
  assert.equal(tssNote({ ...run, effort: { ...run.effort, tss: null } }), null);
});

test('zoneShares: shares of the total, null without time', () => {
  assert.equal(zoneShares([{ zone: 1, name: 'a', seconds: 0 }]), null);
  assert.deepEqual(zoneShares([{ zone: 1, name: 'a', seconds: 30 }, { zone: 2, name: 'b', seconds: 90 }]).map((z) => z.share), [0.25, 0.75]);
});
