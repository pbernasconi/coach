// The ai_usage ledger on a real Postgres (DATABASE.md, "What Claude costs"): a recorded call is priced and counted
// toward its own feature's monthly spend only, and last month's rows don't count.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from '@/db';
import { monthSpend, recordAiUsage } from '@/lib/ai-usage/store';
import { CHAT_FEATURES, PLANNER_FEATURES, usageOf } from '@/lib/ai-usage/usage.mjs';

const user = 'user_ai_usage';

test('calls add up per feature for the current month', async () => {
  await sql`DELETE FROM ai_usage WHERE user_id = ${user}`;
  try {
    const usage = usageOf({ input_tokens: 1000, output_tokens: 1000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, 'claude-sonnet-5-5');
    assert.ok(await recordAiUsage(user, { feature: 'chat', model: 'claude-sonnet-5-5', effort: 'low', usage, refId: 'msg_a' }));
    await recordAiUsage(user, { feature: 'chat_warmup', model: 'claude-sonnet-5-5', usage });
    await recordAiUsage(user, { feature: 'planner', model: 'claude-opus-5-5', usage: { ...usage, usd: 0.5 }, refId: 'run_a' });
    const old = await recordAiUsage(user, { feature: 'chat', model: 'claude-sonnet-5-5', usage: { ...usage, usd: 9 } });
    await sql`UPDATE ai_usage SET created_at = date_trunc('month', NOW()) - INTERVAL '1 day' WHERE id = ${old}`;

    assert.ok(Math.abs((await monthSpend(user, CHAT_FEATURES)) - 2 * 0.012) < 1e-9, 'chat counts answers and warm-ups, not last month');
    assert.equal(await monthSpend(user, PLANNER_FEATURES), 0.5);
    const [row] = (await sql`SELECT input_tokens, output_tokens, effort, ref_id, ok FROM ai_usage WHERE ref_id = 'msg_a'`) as Record<string, unknown>[];
    assert.deepEqual(row, { input_tokens: 1000, output_tokens: 1000, effort: 'low', ref_id: 'msg_a', ok: true });
  } finally {
    await sql`DELETE FROM ai_usage WHERE user_id = ${user}`;
  }
});
