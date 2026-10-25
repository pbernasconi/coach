import { sql } from 'drizzle-orm';
import { check, date, doublePrecision, index, integer, jsonb, pgTable, primaryKey, smallint, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Cloud plan requests and the plans they propose (src/lib/plan/proposals.ts, .github/workflows/plan.yml).
 * requested (from the Plan page) → running (the job claimed it) → proposed (the agent's plan, checked) → accepted or
 * rejected by Paolo; failed at any step. `request` is { kind, weekStart, feel, focus, lock } (proposal.mjs).
 */
export const planProposals = pgTable(
  'plan_proposals',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    kind: text('kind').notNull(),
    weekStart: date('week_start').notNull(),
    status: text('status').notNull(),
    request: jsonb('request').notNull(),
    plan: jsonb('plan'),
    summary: text('summary'),
    error: text('error'),
    // What the planner knew (the job's profile.json, without the user block): the golden weeks of the evals are
    // built from these. Large (tens of KB): never read it in a page loader.
    context: jsonb('context'),
    // The rule results (src/lib/plan/rules.mjs checkProposal) of the plan as the planner wrote it.
    checks: jsonb('checks'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
    decidedAt: timestamp('decided_at', { mode: 'date' }),
  },
  (t) => [
    index('plan_proposals_user_created_idx').on(t.userId, t.createdAt),
    check('plan_proposals_status_check', sql`${t.status} IN ('requested', 'running', 'proposed', 'accepted', 'rejected', 'failed')`),
    check('plan_proposals_kind_check', sql`${t.kind} IN ('weekly', 'checkin')`),
  ],
);

/**
 * How a workout felt, logged in the item modal (src/lib/plan/feedback.ts): the feel (1 very weak … 5 very strong),
 * the perceived effort (RPE 1–10) and a comment. One row per item: `item` is 'plan:<training_plan_activities.id>',
 * 'strava:<strava_activity_id>' or 'lift:<Lift session id>'. `plan_activity_id` is the planned workout it belongs
 * to, when there is one. /plan and /check-in read these (scripts/coach-profile.mjs, scripts/plan-edit.mjs show).
 */
export const workoutFeedback = pgTable(
  'workout_feedback',
  {
    userId: text('user_id').notNull(),
    item: text('item').notNull(),
    date: date('date').notNull(),
    title: text('title'),
    planActivityId: text('plan_activity_id'),
    feel: smallint('feel'),
    rpe: smallint('rpe'),
    comment: text('comment'),
    // 'watch' when the feel and RPE came from the Garmin watch (src/lib/activity/watch-feedback.mjs); a save in Coach clears it.
    source: text('source'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.item] }),
    index('workout_feedback_user_date_idx').on(t.userId, t.date),
    check('workout_feedback_feel_check', sql`${t.feel} IS NULL OR ${t.feel} BETWEEN 1 AND 5`),
    check('workout_feedback_rpe_check', sql`${t.rpe} IS NULL OR ${t.rpe} BETWEEN 1 AND 10`),
  ],
);

/**
 * Paolo's verdict on a past plan (the Past plans page, /plan/history): good or bad and one line why. Phase 0 of the
 * planner evals reads these to find what goes wrong. `item` is 'week:<training_plans.id>' or
 * 'proposal:<plan_proposals.id>'.
 */
export const planVerdicts = pgTable(
  'plan_verdicts',
  {
    userId: text('user_id').notNull(),
    item: text('item').notNull(),
    weekStart: date('week_start').notNull(),
    verdict: text('verdict').notNull(),
    note: text('note'),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.item] }),
    check('plan_verdicts_verdict_check', sql`${t.verdict} IN ('good', 'bad')`),
  ],
);

/**
 * One server planner run (src/lib/planner/run.ts): the model, the prompt version, how many tries it took, what the
 * first draft got wrong, and what it cost. The monthly cap (src/lib/planner/cost.mjs) adds up cost_usd. Summary columns only: no plan or profile text.
 */
export const planRuns = pgTable(
  'plan_runs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    proposalId: text('proposal_id'),
    kind: text('kind').notNull(),
    model: text('model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    status: text('status').notNull(),
    stop: text('stop'),
    turns: smallint('turns').notNull().default(0),
    submits: smallint('submits').notNull().default(0),
    firstDraftProblems: jsonb('first_draft_problems'),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    cacheReadTokens: integer('cache_read_tokens').notNull().default(0),
    cacheWriteTokens: integer('cache_write_tokens').notNull().default(0),
    costUsd: doublePrecision('cost_usd').notNull().default(0),
    durationMs: integer('duration_ms'),
    error: text('error'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('plan_runs_user_created_idx').on(t.userId, t.createdAt),
    check('plan_runs_kind_check', sql`${t.kind} IN ('plan', 'eval')`),
    check('plan_runs_status_check', sql`${t.status} IN ('running', 'ok', 'failed')`),
  ],
);
