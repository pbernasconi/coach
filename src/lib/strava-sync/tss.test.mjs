import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTss } from './sync.mjs';

const athlete = { ftp: 280, thresholdHr: 168 };

test('a run with running power uses heart rate, not the cycling FTP', () => {
  const run = { type: 'Run', sport_type: 'Run', moving_time: 5035, weighted_average_watts: 362, device_watts: true, average_heartrate: 151 };
  const r = computeTss(run, athlete);
  assert.equal(r.method, 'hr');
  assert.ok(r.tss > 100 && r.tss < 125, String(r.tss));
});

test('a ride with a power meter uses power', () => {
  const ride = { type: 'Ride', sport_type: 'VirtualRide', moving_time: 3600, weighted_average_watts: 224, device_watts: true, average_heartrate: 140 };
  assert.deepEqual(computeTss(ride, athlete), { tss: 64, method: 'power' });
});
