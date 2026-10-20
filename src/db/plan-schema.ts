import { sql } from 'drizzle-orm';
import { check, date, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

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
