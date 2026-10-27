import { test } from 'node:test';
import assert from 'node:assert/strict';
import { usageOf, usageRow } from './usage.mjs';

test('a chat answer becomes one priced row', () => {
  const usage = usageOf({ input_tokens: 1200, output_tokens: 300, cache_read_input_tokens: 20000, cache_creation_input_tokens: 0 }, 'claude-sonnet-5-5');
  // Sonnet 5.5: $2 in, $10 out, $0.20 cache read per million.
  assert.ok(Math.abs(usage.usd - (0.0024 + 0.003 + 0.004)) < 1e-9);
  const row = usageRow({ feature: 'chat', model: 'claude-sonnet-5-5', effort: 'low', usage, durationMs: 4200.4, refId: 'msg_1' });
  assert.deepEqual(row, {
    feature: 'chat', model: 'claude-sonnet-5-5', effort: 'low', inputTokens: 1200, outputTokens: 300,
    cacheReadTokens: 20000, cacheWriteTokens: 0, costUsd: usage.usd, durationMs: 4200, ok: true, refId: 'msg_1',
  });
});

test('a failed call with no usage is a zero row, and an unknown feature is refused', () => {
  const row = usageRow({ feature: 'planner', model: 'claude-opus-5-5', ok: false });
  assert.equal(row.costUsd, 0);
  assert.equal(row.inputTokens, 0);
  assert.equal(row.ok, false);
  assert.throws(() => usageRow({ feature: 'dexa', model: 'claude-opus-5-5' }), /unknown AI usage feature/);
});
