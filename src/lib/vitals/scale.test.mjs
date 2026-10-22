import test from 'node:test';
import assert from 'node:assert/strict';
import { scaleWarning } from './scale.mjs';

test('scaleWarning: nothing before the first weigh-in or within 3 days', () => {
  assert.equal(scaleWarning(null, '2026-10-22'), null);
  assert.equal(scaleWarning('2026-10-22', '2026-10-22'), null);
  assert.equal(scaleWarning('2026-10-19', '2026-10-22'), null);
});

test('scaleWarning: info from 4 days, a banner from 10', () => {
  assert.equal(scaleWarning('2026-10-18', '2026-10-22')?.level, 'info');
  assert.match(scaleWarning('2026-10-18', '2026-10-22')?.text ?? '', /for 4 days/);
  assert.equal(scaleWarning('2026-10-12', '2026-10-22')?.level, 'warn');
});
