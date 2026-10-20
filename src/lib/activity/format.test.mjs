import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duration, km, kmh, pace, signed } from './format.mjs';

test('formats', () => {
  assert.equal(duration(5035), '1:23:55');
  assert.equal(duration(319), '5:19');
  assert.equal(pace(15797.2 / 5035), '5:19');
  assert.equal(pace(0), '–');
  assert.equal(kmh(10), '36.0');
  assert.equal(km(15797.2), '15.79');
  assert.equal(km(102392), '102.3');
  assert.equal(signed(3), '+3');
  assert.equal(signed(-2.4), '−2');
});
