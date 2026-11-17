import { sql } from 'drizzle-orm';
import { boolean, check, doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

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
    /** chat | chat_warmup | planner | planner_eval | activity_review (FEATURES in src/lib/ai-usage/usage.mjs). */
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
    check('ai_usage_feature_check', sql`${t.feature} IN ('chat', 'chat_warmup', 'planner', 'planner_eval', 'activity_review')`),
  ],
);

/**
 * The coach's review of a finished workout (src/lib/activity/review.ts): plan versus done step by step (`analysis`,
 * src/lib/activity/adherence.mjs) and Claude's words on it (`review`: headline, rating, what it did, what went well, what
 * to improve, tips for next time). One row per activity; `key` is what it was made from (reviewKey), so a changed plan
 * or a newly logged feel makes it again. `status` failed keeps the error and lets the page try again later.
 */
export const activityReviews = pgTable(
  'activity_reviews',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    stravaActivityId: text('strava_activity_id').notNull(),
    planActivityId: text('plan_activity_id'),
    /** The workout bank of the plan (vo2-a, threshold-a, …), to find the last sessions of the same workout. */
    bank: text('bank'),
    key: text('key').notNull(),
    status: text('status').notNull().default('ok'),
    error: text('error'),
    analysis: jsonb('analysis'),
    review: jsonb('review'),
    model: text('model'),
    costUsd: doublePrecision('cost_usd').notNull().default(0),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('activity_reviews_user_activity_idx').on(t.userId, t.stravaActivityId),
    index('activity_reviews_user_bank_idx').on(t.userId, t.bank, t.createdAt),
  ],
);
