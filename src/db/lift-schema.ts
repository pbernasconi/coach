import { sql } from 'drizzle-orm';
import { bigint, index, jsonb, pgSequence, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Lift sync storage (see lift/SYNC.md).
 *
 * `lift_rows` holds the latest version of every row the iPhone has pushed, keyed by (entity, id). The
 * payload is the LiftStore row as JSON, stored verbatim. `seq` comes from `lift_rows_seq` and is bumped on
 * every applied change, so a pull can page through changes in order with `seq > cursor`.
 */
export const liftRowsSeq = pgSequence('lift_rows_seq');

export const liftRows = pgTable(
  'lift_rows',
  {
    entity: text('entity').notNull(), // exercise | session | sessionExercise | set | template | templateExercise
    id: uuid('id').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    seq: bigint('seq', { mode: 'number' })
      .notNull()
      .default(sql`nextval('lift_rows_seq')`),
  },
  (table) => [
    primaryKey({ columns: [table.entity, table.id] }),
    index('lift_rows_seq_idx').on(table.seq),
  ]
);

/** Idempotency keys of every change already applied (or accepted as stale) by a push. */
export const liftAppliedChanges = pgTable('lift_applied_changes', {
  idempotencyKey: uuid('idempotency_key').primaryKey(),
  appliedAt: timestamp('applied_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export type LiftRow = typeof liftRows.$inferSelect;
export type LiftAppliedChange = typeof liftAppliedChanges.$inferSelect;
