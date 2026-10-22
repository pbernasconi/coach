import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bodyFatRange, distanceToHealthy, healthRanges, perYear, zFromPercentile, zoneOf } from './dexa-health.mjs';
import { viewForName } from './dexa-images.mjs';

test('bodyFatRange follows Gallagher 2000 by sex and age', () => {
  const m32 = bodyFatRange('male', 32);
  assert.equal(zoneOf(m32, 22.2).label, 'Over');
  assert.equal(zoneOf(m32, 19.9).label, 'Healthy');
  assert.equal(zoneOf(m32, 27.3).label, 'Obese');
  assert.equal(zoneOf(m32, 6).label, 'Low');
  assert.equal(Math.round(distanceToHealthy(m32, 22.2) * 10) / 10, 2.2);
  assert.equal(distanceToHealthy(m32, 15), 0);
  assert.equal(zoneOf(bodyFatRange('male', 45), 22.2).label, 'Over');
  assert.equal(zoneOf(bodyFatRange('male', 45), 21.9).label, 'Healthy');
  assert.equal(zoneOf(bodyFatRange('female', 30), 30).label, 'Healthy');
  assert.match(m32.source, /Men 20–39/);
});

test('healthRanges uses the sex-specific low cut-offs', () => {
  const [, ffmi, almi, bone] = healthRanges({ gender: 'male', age: 32 });
  assert.equal(zoneOf(ffmi, 16.9).label, 'Low');
  assert.equal(zoneOf(ffmi, 19.6).label, 'Healthy');
  assert.equal(zoneOf(almi, 6.9).label, 'Low');
  assert.equal(zoneOf(almi, 8.8).label, 'Healthy');
  assert.equal(zoneOf(bone, -2.1).tone, 'bad');
  const [, , almiF] = healthRanges({ gender: 'female', age: 32 });
  assert.equal(zoneOf(almiF, 6).label, 'Healthy');
});

test('perYear and zFromPercentile', () => {
  const r = perYear({ date: '2024-03-01', value: 27.3 }, { date: '2025-08-08', value: 22.2 });
  assert.ok(r !== null && r < -3.4 && r > -3.7);
  assert.equal(perYear({ date: '2025-01-01', value: 1 }, { date: '2025-01-10', value: 2 }), null);
  assert.ok(Math.abs((zFromPercentile(50) ?? 9)) < 1e-9);
  assert.ok(Math.abs((zFromPercentile(2.275) ?? 0) + 2) < 0.01);
  assert.equal(zFromPercentile(null), null);
});

test('viewForName reads the image type from a file name', () => {
  assert.equal(viewForName('2025-08-08 Composite.png'), 'composite');
  assert.equal(viewForName('scan-fat-tissue.png'), 'fat');
  assert.equal(viewForName('Lean Tissue.jpg'), 'lean');
  assert.equal(viewForName('bone.png'), 'bone');
  assert.equal(viewForName('fatigue.png'), null);
  assert.equal(viewForName('report.pdf'), null);
});
