import { sql } from 'drizzle-orm';
import { check, date, index, jsonb, pgTable, primaryKey, smallint, text, timestamp } from 'drizzle-orm/pg-core';

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
