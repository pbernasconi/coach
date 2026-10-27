import { sql } from 'drizzle-orm';
import { boolean, check, doublePrecision, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * What every Claude API call Coach makes costs (src/lib/ai-usage/): one row per chat answer, chat cache warm-up and
 * planner run, with its tokens and dollars. The chat and planner monthly caps add up `cost_usd` here, and
 * `npm run ai:spend` (scripts/ai-spend.mjs) sums it by month, feature and model. `ref_id` is the coach_messages or
 * plan_runs row the call belongs to, when there is one. Rows from before 2026-10-27 were copied from those tables.
 */
export const aiUsage = pgTable(
  'ai_usage',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    /** chat | chat_warmup | planner | planner_eval (FEATURES in src/lib/ai-usage/usage.mjs). */
    feature: text('feature').notNull(),
    model: text('model').notNull(),
    effort: text('effort'),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    cacheReadTokens: integer('cache_read_tokens').notNull().default(0),
    cacheWriteTokens: integer('cache_write_tokens').notNull().default(0),
    costUsd: doublePrecision('cost_usd').notNull().default(0),
    durationMs: integer('duration_ms'),
    ok: boolean('ok').notNull().default(true),
    refId: text('ref_id'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('ai_usage_user_created_idx').on(t.userId, t.createdAt),
    index('ai_usage_ref_idx').on(t.refId),
    check('ai_usage_feature_check', sql`${t.feature} IN ('chat', 'chat_warmup', 'planner', 'planner_eval')`),
  ],
);
