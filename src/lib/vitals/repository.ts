import { sql } from '@/db';
import { toDay, toIso } from '@/lib/db-time.mjs';
import { ownerId } from '@/lib/plan/queries';
import type { GarminConnectionRow, GarminRawRepository, GarminRepository, GarminSyncStatus } from './garmin.mjs';
import { writeSamples, type VitalMetric, type VitalsRepository } from './sync.mjs';

/** health_samples in Postgres. The owner is the first row in users (ownerId, the rule for bearer-token routes). */
export const neonVitalsRepository: VitalsRepository = {
  ownerId,
  upsert: (userId, samples) => writeSamples(sql, userId, samples),
  async latestDates(userId: string, since: string | null) {
    const rows = (await sql`
      SELECT metric, to_char(max(date), 'YYYY-MM-DD') AS latest
      FROM health_samples
      WHERE user_id = ${userId} AND (${since}::date IS NULL OR date >= ${since}::date)
      GROUP BY metric`) as { metric: VitalMetric; latest: string }[];
    return Object.fromEntries(rows.map((r) => [r.metric, r.latest]));
  },
};

type Row = Record<string, unknown>;

/** The owner's garmin_connections row, with times as ISO text. */
export async function garminConnection(userId: string): Promise<GarminConnectionRow | null> {
  const [r] = (await sql`
    SELECT tokens_ciphertext, status, last_success_at, last_attempt_at, last_error, synced_through, backfill_from, backfill_through
    FROM garmin_connections WHERE user_id = ${userId}`) as Row[];
  if (!r) return null;
  return {
    tokensCiphertext: r.tokens_ciphertext == null ? null : String(r.tokens_ciphertext),
    status: String(r.status) as GarminSyncStatus,
    lastSuccessAt: toIso(r.last_success_at),
    lastAttemptAt: toIso(r.last_attempt_at),
    lastError: r.last_error == null ? null : String(r.last_error),
    syncedThrough: toDay(r.synced_through),
    backfillFrom: toDay(r.backfill_from),
    backfillThrough: toDay(r.backfill_through),
  };
}

/** garmin_connections in Postgres. A field that the update does not name keeps its stored value. */
export const neonGarminRepository: GarminRepository = {
  ownerId,
  get: garminConnection,
  async update(userId, u) {
    const setTokens = u.tokensCiphertext !== undefined;
    const setStatus = u.status !== undefined;
    const setError = u.lastError !== undefined;
    const setThrough = u.syncedThrough !== undefined;
    const setFrom = u.backfillFrom !== undefined;
    const setBackfill = u.backfillThrough !== undefined;
    const success = Boolean(u.success);
    const attempt = Boolean(u.attempt);
    await sql`
      INSERT INTO garmin_connections (user_id, tokens_ciphertext, status, last_error, synced_through, backfill_from, backfill_through,
                                      last_success_at, last_attempt_at, updated_at)
      VALUES (${userId}, ${u.tokensCiphertext ?? null}, ${u.status ?? 'ok'}, ${u.lastError ?? null}, ${u.syncedThrough ?? null}::date,
              ${u.backfillFrom ?? null}::date, ${u.backfillThrough ?? null}::date,
              CASE WHEN ${success}::boolean THEN now() END, CASE WHEN ${attempt}::boolean THEN now() END, now())
      ON CONFLICT (user_id) DO UPDATE SET
        tokens_ciphertext = CASE WHEN ${setTokens}::boolean THEN EXCLUDED.tokens_ciphertext ELSE garmin_connections.tokens_ciphertext END,
        status = CASE WHEN ${setStatus}::boolean THEN EXCLUDED.status ELSE garmin_connections.status END,
        last_error = CASE WHEN ${setError}::boolean THEN EXCLUDED.last_error ELSE garmin_connections.last_error END,
        synced_through = CASE WHEN ${setThrough}::boolean THEN EXCLUDED.synced_through ELSE garmin_connections.synced_through END,
        backfill_from = CASE WHEN ${setFrom}::boolean THEN EXCLUDED.backfill_from ELSE garmin_connections.backfill_from END,
        backfill_through = CASE WHEN ${setBackfill}::boolean THEN EXCLUDED.backfill_through ELSE garmin_connections.backfill_through END,
        last_success_at = CASE WHEN ${success}::boolean THEN now() ELSE garmin_connections.last_success_at END,
        last_attempt_at = CASE WHEN ${attempt}::boolean THEN now() ELSE garmin_connections.last_attempt_at END,
        updated_at = now()`;
  },
};

/** garmin_raw in Postgres: insert or replace on (user, date, kind). One statement per 50 rows (a day is ~300 KB). */
export const neonGarminRawRepository: GarminRawRepository = {
  ownerId,
  async upsertRaw(userId, rows) {
    for (let i = 0; i < rows.length; i += 50) {
      const chunk = rows.slice(i, i + 50);
      await sql`
        INSERT INTO garmin_raw (user_id, date, kind, payload, fetched_at)
        SELECT ${userId}, d, k, p::jsonb, now()
        FROM unnest(${chunk.map((r) => r.date)}::date[], ${chunk.map((r) => r.kind)}::text[], ${chunk.map((r) => r.payload)}::text[]) AS t(d, k, p)
        ON CONFLICT (user_id, date, kind) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = now()`;
    }
  },
};
