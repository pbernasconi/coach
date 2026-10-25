import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addUsage, costOf, NO_USAGE, PLANNER_MONTHLY_CAP_USD } from './cost.mjs';

test('prices a call by model', () => {
  const u = { input_tokens: 1e6, output_tokens: 1e6, cache_read_input_tokens: 1e6, cache_creation_input_tokens: 1e6 };
  assert.equal(costOf(u, 'claude-opus-5-5'), 4 + 20 + 0.2 + 5);
  assert.equal(costOf(u, 'claude-sonnet-5-5'), 2 + 10 + 0.2 + 2.5);
  assert.equal(costOf(u, 'unknown-model'), costOf(u, 'claude-opus-5-5'));
  assert.equal(costOf({}, 'claude-opus-5-5'), 0);
});

test('adds usage across calls', () => {
  const u = { input_tokens: 2000, output_tokens: 1000, cache_read_input_tokens: 10000 };
  const t = addUsage(addUsage(NO_USAGE, u, 'claude-opus-5-5'), u, 'claude-opus-5-5');
  assert.equal(t.input, 4000);
  assert.equal(t.output, 2000);
  assert.equal(t.cacheRead, 20000);
  assert.ok(Math.abs(t.usd - 2 * (0.008 + 0.02 + 0.002)) < 1e-9);
  assert.deepEqual(addUsage(NO_USAGE, null, 'claude-opus-5-5'), NO_USAGE);
});

test('the monthly cap is $25', () => assert.equal(PLANNER_MONTHLY_CAP_USD, 25));
