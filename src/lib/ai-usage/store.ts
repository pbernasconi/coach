/**
 * The ai_usage ledger (src/db/usage-schema.ts): every Claude API call Coach makes writes one row here, and the monthly
 * caps add it up. Writing a row never fails the call it describes: a database error is logged and the answer goes on.
 */

import { createId } from '@paralleldrive/cuid2';
import { sql } from '@/db';
import { usageRow } from './usage.mjs';

/** Saves one call's cost. Returns the row id, or null when the write failed. */
export async function recordAiUsage(userId: string, input: Parameters<typeof usageRow>[0]): Promise<string | null> {
  const r = usageRow(input);
  const id = createId();
  try {
    await sql`
      INSERT INTO ai_usage (id, user_id, feature, model, effort, input_tokens, output_tokens, cache_read_tokens,
        cache_write_tokens, cost_usd, duration_ms, ok, ref_id)
      VALUES (${id}, ${userId}, ${r.feature}, ${r.model}, ${r.effort}, ${r.inputTokens}, ${r.outputTokens},
        ${r.cacheReadTokens}, ${r.cacheWriteTokens}, ${r.costUsd}, ${r.durationMs}, ${r.ok}, ${r.refId})`;
    return id;
  } catch (error) {
    console.error('AI usage not saved:', error instanceof Error ? error.message : 'unknown error');
    return null;
  }
}

/** This calendar month's spend (UTC month, as the caps reset) on the given features, in USD. */
export async function monthSpend(userId: string, features: string[]): Promise<number> {
  const [r] = (await sql`
    SELECT COALESCE(SUM(cost_usd), 0)::float AS usd FROM ai_usage
    WHERE user_id = ${userId} AND feature = ANY(${features}) AND created_at >= date_trunc('month', NOW())`) as Record<string, unknown>[];
  return Number(r?.usd ?? 0);
}
