import { sql } from 'drizzle-orm';
import { bigserial, check, customType, date, doublePrecision, index, integer, jsonb, pgTable, primaryKey, smallint, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Cloud plan requests and the plans they propose (src/lib/plan/proposals.ts, src/lib/planner/run.ts).
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
 * to, when there is one. The planner reads these (src/lib/planner/profile.mjs, current-week.mjs).
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

/**
 * The Coach tab's conversation (lift/COACH-CHAT.md, src/lib/coach-chat/): one open thread at a time, a new one after
 * 24 h idle. Its messages, and the change sets Coach proposes. Nothing in the plan changes until Paolo taps Apply.
 */
export const coachThreads = pgTable(
  'coach_threads',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [index('coach_threads_user_updated_idx').on(t.userId, t.updatedAt)],
);

/**
 * One message of a Coach thread. An assistant message can carry a proposal. `cost_usd` is what its Claude calls cost:
 * the chat's monthly cap (src/lib/coach-chat/cost.mjs) adds it up. Every message is kept, with an answer's context and
 * meta, so the conversations can be analysed later.
 */
export const coachMessages = pgTable(
  'coach_messages',
  {
    id: text('id').primaryKey(),
    threadId: text('thread_id').notNull(),
    userId: text('user_id').notNull(),
    role: text('role').notNull(),
    text: text('text').notNull(),
    proposalId: text('proposal_id'),
    model: text('model'),
    costUsd: doublePrecision('cost_usd').notNull().default(0),
    /** An answer's context as Claude got it (<now>, <plan>, <profile>), kept for analysis. */
    context: text('context'),
    /** How an answer came about: stop reason, turns, tokens, latency, every propose_changes try and its problems. */
    meta: jsonb('meta'),
    /** The cards an answer showed (src/lib/coach-chat/cards.ts), as the phone got them. */
    attachments: jsonb('attachments'),
    /** One-tap answers under an answer's question. */
    quickReplies: jsonb('quick_replies'),
    /** The photos and files on Paolo's message (src/lib/coach-chat/files.mjs `FileRef`); the bytes are in coach_files. */
    files: jsonb('files'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('coach_messages_thread_created_idx').on(t.threadId, t.createdAt),
    index('coach_messages_user_created_idx').on(t.userId, t.createdAt),
    check('coach_messages_role_check', sql`${t.role} IN ('user', 'assistant')`),
  ],
);

/**
 * A change set Coach proposed (src/lib/coach-chat/changes.mjs): `changes` as the model wrote them and checked,
 * `items` the rows the card shows, `warnings` the plan rules they break, `undo` what Apply changed so Undo can put it
 * back. open → applied (→ undone) or dismissed; stale when a workout it touches changed after it.
 */
export const coachProposals = pgTable(
  'coach_proposals',
  {
    id: text('id').primaryKey(),
    threadId: text('thread_id').notNull(),
    userId: text('user_id').notNull(),
    title: text('title').notNull(),
    why: text('why'),
    changes: jsonb('changes').notNull(),
    items: jsonb('items').notNull(),
    warnings: jsonb('warnings').notNull(),
    status: text('status').notNull(),
    undo: jsonb('undo'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    decidedAt: timestamp('decided_at', { mode: 'date' }),
  },
  (t) => [
    index('coach_proposals_thread_idx').on(t.threadId),
    check('coach_proposals_status_check', sql`${t.status} IN ('open', 'applied', 'undone', 'dismissed', 'stale')`),
  ],
);

/** Postgres bytea. The code reads it as base64 (`encode(data, 'base64')`), the same text with either driver. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

/**
 * A photo or file Paolo attached to a Coach message (lift/COACH-CHAT.md, "Attachments"). The phone uploads it first
 * (POST /api/app/coach/files, shrunk to about 1 MB for a photo), then sends the message with its id: `message_id` is
 * set then. An upload no message took within a day is deleted. `kind` is what the bytes are (files.mjs `sniffFile`).
 */
export const coachFiles = pgTable(
  'coach_files',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    messageId: text('message_id'),
    kind: text('kind').notNull(),
    name: text('name').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    sha256: text('sha256').notNull(),
    width: integer('width'),
    height: integer('height'),
    data: bytea('data').notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('coach_files_user_created_idx').on(t.userId, t.createdAt),
    index('coach_files_message_idx').on(t.messageId),
    check('coach_files_kind_check', sql`${t.kind} IN ('image', 'pdf', 'text')`),
  ],
);

/**
 * Every change to a planned workout (training_plan_activities): an insert, an update of a field that matters, or a
 * delete, with who made it. A database trigger (drizzle/0023_plan_changes.sql) writes these rows, so no write path can
 * skip it; the write names its source in `change_source` (src/lib/plan/change-source.mjs). `before`/`after` hold only
 * the fields that changed (the whole row for an insert or a delete). Read with src/lib/plan/change-log.ts.
 */
export const planChanges = pgTable(
  'plan_changes',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    workoutId: text('workout_id').notNull(),
    planId: text('plan_id'),
    // The workout's title at the change, so a line reads on its own after a delete.
    title: text('title'),
    op: text('op').notNull(),
    // chat | app | web | planner | calendar | lift | script | unknown
    source: text('source').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    at: timestamp('at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('plan_changes_workout_idx').on(t.workoutId, t.at),
    index('plan_changes_at_idx').on(t.at),
    check('plan_changes_op_check', sql`${t.op} IN ('insert', 'update', 'delete')`),
  ],
);
