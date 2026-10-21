import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zonesFor } from './zones.mjs';

test('a VO2 ride gets Z5 power and a Z2 finish', () => {
  const z = zonesFor({ title: 'VO2 A bike', workoutType: 'vo2-bike', sport: 'ride' });
  assert.deepEqual(z.map((x) => x.zone), ['Z5', 'Z2']);
  assert.match(z[0].target, /284–318 W/);
});

test('a threshold run goes by heart rate only', () => {
  const z = zonesFor({ title: 'Threshold B run', sport: 'run' });
  assert.equal(z[0].zone, 'Z4');
  assert.equal(z[0].target, '175–182 bpm');
});

test('long sessions: rides mostly Z2, runs mostly Z1', () => {
  assert.equal(zonesFor({ title: 'Long ride', sport: 'ride' })[0].zone, 'Z2');
  assert.equal(zonesFor({ title: 'Long run', sport: 'run' })[0].zone, 'Z1');
});

test('strength and rest have no zones', () => {
  assert.deepEqual(zonesFor({ title: 'Heavy barbell lift', sport: 'strength' }), []);
  assert.deepEqual(zonesFor({ title: 'Rest day', sport: 'rest' }), []);
});
