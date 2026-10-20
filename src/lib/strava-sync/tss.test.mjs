import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTss, hrIntensity, normalizedPower, resolveThresholds, thresholdValues } from './tss.mjs';

const th = { ftp: 280, runLthr: 168, rideLthr: 163, restingHr: 42, runPaceS: 288 };
const steady = (n, v) => Array.from({ length: n }, () => v);
const seconds = (n) => Array.from({ length: n }, (_, i) => i);

test('a run with running power uses heart rate, not the cycling FTP', () => {
  const run = { sport_type: 'Run', moving_time: 5035, weighted_average_watts: 362, device_watts: true, average_heartrate: 151 };
  const r = computeTss(run, th);
  assert.equal(r.method, 'hr');
  assert.ok(r.tss > 95 && r.tss < 115, String(r.tss));
});

test('a ride with a power meter uses power', () => {
  const ride = { sport_type: 'VirtualRide', moving_time: 3600, weighted_average_watts: 224, device_watts: true, average_heartrate: 140 };
  assert.deepEqual(computeTss(ride, th), { tss: 64, method: 'power', intensity: 0.8 });
});

test('an hour at FTP is 100 TSS, from the watts stream', () => {
  const ride = { sport_type: 'Ride', moving_time: 3600, device_watts: true, weighted_average_watts: 200 };
  const r = computeTss(ride, th, { time: seconds(3600), watts: steady(3600, 280) });
  assert.equal(r.method, 'power_stream');
  assert.ok(Math.abs(r.tss - 100) < 1, String(r.tss));
});

test('Normalized Power is above the average for intervals', () => {
  const watts = Array.from({ length: 3600 }, (_, i) => (Math.floor(i / 120) % 2 ? 350 : 150)); // 2 min on, 2 min off
  const np = normalizedPower(watts, seconds(3600));
  assert.ok(np > 270 && np < 300, String(np)); // the average is 250
});

test('an easy hour by heart rate is 40 to 60 TSS, not 65', () => {
  const r = computeTss({ sport_type: 'Run', moving_time: 3600, average_heartrate: 135 }, th);
  assert.ok(r.tss >= 40 && r.tss <= 60, String(r.tss));
});

test('the heart-rate stream gives intervals more load than their average', () => {
  const hr = Array.from({ length: 3600 }, (_, i) => (Math.floor(i / 240) % 2 ? 175 : 125)); // average 150
  const fromStream = computeTss({ sport_type: 'Run', moving_time: 3600, average_heartrate: 150 }, { ...th, runPaceS: null }, { time: seconds(3600), heartrate: hr });
  const fromAverage = computeTss({ sport_type: 'Run', moving_time: 3600, average_heartrate: 150 }, th);
  assert.equal(fromStream.method, 'hr_stream');
  assert.ok(fromStream.tss > fromAverage.tss, `${fromStream.tss} vs ${fromAverage.tss}`);
});

test('a ride without power uses the cycling LTHR, which is lower than the run LTHR', () => {
  const ride = computeTss({ sport_type: 'Ride', moving_time: 3600, average_heartrate: 150 }, th);
  const run = computeTss({ sport_type: 'Run', moving_time: 3600, average_heartrate: 150 }, th);
  assert.ok(ride.tss > run.tss);
});

test('an hour at threshold pace on the flat is 100 TSS', () => {
  const v = 1000 / 288;
  const r = computeTss({ sport_type: 'Run', moving_time: 3600, average_heartrate: 160 }, th, {
    time: seconds(3600), velocity_smooth: steady(3600, v), grade_smooth: steady(3600, 0),
  });
  assert.equal(r.method, 'pace');
  assert.ok(Math.abs(r.tss - 100) < 1, String(r.tss));
});

test('the same pace uphill counts more', () => {
  const v = 1000 / 330;
  const flat = computeTss({ sport_type: 'Run', moving_time: 3600 }, th, { time: seconds(3600), velocity_smooth: steady(3600, v), grade_smooth: steady(3600, 0) });
  const hill = computeTss({ sport_type: 'Run', moving_time: 3600 }, th, { time: seconds(3600), velocity_smooth: steady(3600, v), grade_smooth: steady(3600, 5) });
  assert.ok(hill.tss > flat.tss * 1.2, `${hill.tss} vs ${flat.tss}`);
});

test('no heart rate falls back to a typical intensity', () => {
  assert.deepEqual(computeTss({ sport_type: 'Swim', moving_time: 3600 }, th), { tss: 49, method: 'duration_fallback', intensity: 0.7 });
  assert.equal(computeTss({ sport_type: 'Swim', moving_time: 0 }, th).tss, 0);
});

test('heart-rate intensity is the share of the reserve, capped', () => {
  assert.equal(hrIntensity(168, 168, 42), 1);
  assert.equal(hrIntensity(30, 168, 42), 0);
  assert.equal(hrIntensity(250, 168, 42), 1.3);
});

test('thresholds: settings first, then Garmin, then Strava and the estimates', () => {
  const zones = [{ min: 0, max: 122 }, { min: 122, max: 153 }, { min: 153, max: 168 }, { min: 168, max: 182 }, { min: 182, max: -1 }];
  const t = resolveThresholds({ settings: { ftp: 290 }, stravaFtp: 280, stravaHrZones: zones, restingHr: 40.4, garminLthr: 167, garminLtPaceS: 288, best10kS: 3025 });
  assert.deepEqual(thresholdValues(t), { ftp: 290, runLthr: 167, rideLthr: 162, restingHr: 40, runPaceS: 288 });
  assert.equal(t.ftp.source, 'settings');
  assert.equal(t.runLthr.source, 'garmin');
  const bare = resolveThresholds({ stravaHrZones: zones, best10kS: 3025 });
  assert.deepEqual(thresholdValues(bare), { ftp: null, runLthr: 168, rideLthr: 163, restingHr: 50, runPaceS: 315 });
  assert.equal(bare.runPaceS.source, 'best 10 km (365 d) + 4 %');
});

test('the stored summary gives the same TSS as the streams, for any threshold', async () => {
  const { tssInputs, tssFromInputs } = await import('./tss.mjs');
  const hr = Array.from({ length: 3600 }, (_, i) => (Math.floor(i / 240) % 2 ? 175 : 125));
  const streams = { time: seconds(3600), heartrate: hr };
  const inputs = JSON.parse(JSON.stringify(tssInputs(streams))); // as stored in jsonb
  const a = { sport_type: 'Run', moving_time: 3600, average_heartrate: 150 };
  for (const t of [th, { ...th, runLthr: 172, restingHr: 48, runPaceS: null }]) {
    assert.deepEqual(tssFromInputs(a, t, inputs), computeTss(a, t, streams));
  }
});
