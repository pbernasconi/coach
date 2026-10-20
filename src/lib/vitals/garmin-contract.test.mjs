// The Garmin job (scripts/garmin/mapping.py) must send each metric with the unit this server accepts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { METRICS, TRAINING_STATUS } from './metrics.mjs';

const py = readFileSync(new URL('../../../scripts/garmin/mapping.py', import.meta.url), 'utf8');
const block = (name) => new RegExp(`${name}[^{]*\\{([^}]*)\\}`).exec(py)?.[1] ?? '';

test('every Garmin metric and unit matches the vitals contract', () => {
  const pairs = [...block('METRIC_UNITS').matchAll(/"([a-z0-9_]+)":\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]);
  assert.ok(pairs.length > 10, 'METRIC_UNITS not found in mapping.py');
  for (const [metric, unit] of pairs) {
    assert.ok(METRICS[metric], `${metric} is not a vitals metric`);
    assert.equal(unit, METRICS[metric].unit, `unit for ${metric}`);
  }
  // Every metric is a Garmin metric, except the Apple Health SDNN.
  const sent = new Set(pairs.map(([m]) => m));
  for (const metric of Object.keys(METRICS)) {
    if (metric === 'hrv_sdnn_ms') continue;
    assert.ok(sent.has(metric), `${metric} is not in mapping.py METRIC_UNITS`);
  }
});

test('the Garmin job sends integers where the server wants them', () => {
  const ints = new Set([...block('INTEGER_METRICS').matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1]));
  assert.ok(ints.size > 0, 'INTEGER_METRICS not found in mapping.py');
  for (const [metric, spec] of Object.entries(METRICS)) {
    if (metric === 'hrv_sdnn_ms') continue;
    assert.equal(ints.has(metric), Boolean(spec.integer), `integer flag for ${metric}`);
  }
});

test('training_status codes match', () => {
  const codes = [...block('TRAINING_STATUS_CODES').matchAll(/"([A-Z_]+)":\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]);
  assert.equal(codes.length, TRAINING_STATUS.length);
  for (const [name, code] of codes) assert.equal(name.replace(/_/g, ' ').toLowerCase(), TRAINING_STATUS[code], `code ${code}`);
});
