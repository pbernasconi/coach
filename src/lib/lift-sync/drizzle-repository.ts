import { asc, gt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { liftRows } from '@/db/lift-schema';
import type { LiftRepository, PulledRow, ApplyOutcome } from './sync.mjs';
import type { LiftEntity } from './contract.mjs';

/**
 * LiftRepository on Postgres (Neon HTTP driver, which has no interactive transactions). Each change is one
 * statement, so recording the idempotency key and the last-writer-wins upsert happen atomically:
 *
 * - `key` inserts the idempotency key; it returns nothing when the key was already applied.
 * - `up` upserts the row only if the key was new, and on conflict only when the incoming `updated_at` is
 *   newer, taking a fresh `seq` from `lift_rows_seq` so pulls see the change.
 */
export const drizzleLiftRepository: LiftRepository = {
  async applyChange(change): Promise<ApplyOutcome> {
    const result = await db.execute(sql`
      WITH key AS (
        INSERT INTO lift_applied_changes (idempotency_key)
        VALUES (${change.idempotencyKey}::uuid)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING idempotency_key
      ), up AS (
        INSERT INTO lift_rows (entity, id, payload, updated_at, deleted_at)
        SELECT ${change.entity}, ${change.id}::uuid, ${JSON.stringify(change.payload)}::jsonb,
               ${change.updatedAt.toISOString()}::timestamptz,
               ${change.deletedAt ? change.deletedAt.toISOString() : null}::timestamptz
        FROM key
        ON CONFLICT (entity, id) DO UPDATE SET
          payload = excluded.payload,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at,
          seq = nextval('lift_rows_seq')
        WHERE excluded.updated_at > lift_rows.updated_at
        RETURNING seq
      )
      SELECT (SELECT count(*) FROM key)::int AS fresh, (SELECT count(*) FROM up)::int AS applied
    `);
    const row = result.rows[0] as { fresh: number | string; applied: number | string } | undefined;
    if (!row || Number(row.fresh) === 0) return 'duplicate';
    return Number(row.applied) > 0 ? 'applied' : 'stale';
  },

  async listSince(afterSeq, limit): Promise<PulledRow[]> {
    const rows = await db
      .select({ seq: liftRows.seq, entity: liftRows.entity, id: liftRows.id, payload: liftRows.payload })
      .from(liftRows)
      .where(gt(liftRows.seq, afterSeq))
      .orderBy(asc(liftRows.seq))
      .limit(limit);
    return rows.map((row) => ({ ...row, entity: row.entity as LiftEntity }));
  },
};
