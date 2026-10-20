import { sql } from 'drizzle-orm';
import { bigint, check, date, doublePrecision, index, jsonb, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Health storage (drizzle/0015_health.sql, COACH-API.md Health).
 *
 * `health_samples`: one value per user, day and metric, pushed by the Lift app from Apple Health. The metric set
 * and units are in src/lib/vitals/metrics.mjs. Sleep belongs to the day the night ends.
 */
export const healthSamples = pgTable(
  'health_samples',
  {
    userId: text('user_id').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    metric: text('metric').notNull(),
    value: doublePrecision('value').notNull(),
    unit: text('unit').notNull(),
    source: text('source').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: 'health_samples_pk', columns: [t.userId, t.date, t.metric] }),
    index('health_samples_metric_date_idx').on(t.userId, t.metric, t.date),
  ]
);

/**
 * `lab_results`: one biomarker from one blood draw (scripts/labs-import.mjs, from Function Health). `value` is null
 * for a text-only result ("Negative"); `value_text` keeps what the lab wrote ("<5").
 */
export const labResults = pgTable(
  'lab_results',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userId: text('user_id').notNull(),
    collectedOn: date('collected_on', { mode: 'string' }).notNull(),
    biomarker: text('biomarker').notNull(),
    category: text('category'),
    value: numeric('value'),
    valueText: text('value_text'),
    unit: text('unit'),
    refLow: numeric('ref_low'),
    refHigh: numeric('ref_high'),
    optimalLow: numeric('optimal_low'),
    optimalHigh: numeric('optimal_high'),
    status: text('status').$type<'optimal' | 'in_range' | 'out_of_range' | 'unknown'>().notNull().default('unknown'),
    source: text('source').notNull().default('function'),
    sourceId: text('source_id'),
    raw: jsonb('raw').$type<Record<string, unknown>>(),
    importedAt: timestamp('imported_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('lab_results_user_source_biomarker_day_uq').on(t.userId, t.source, t.biomarker, t.collectedOn),
    check('lab_results_status_check', sql`${t.status} IN ('optimal', 'in_range', 'out_of_range', 'unknown')`),
  ]
);

/**
 * `clinician_notes`: the clinician's notes on each Function test order (scripts/function-sync.mjs). One row per note;
 * a sync replaces the notes of each order it reads. `position` keeps Function's order inside the order.
 */
export const clinicianNotes = pgTable(
  'clinician_notes',
  {
    userId: text('user_id').notNull(),
    source: text('source').notNull().default('function'),
    requisitionId: text('requisition_id').notNull(),
    position: bigint('position', { mode: 'number' }).notNull(),
    notedOn: date('noted_on', { mode: 'string' }).notNull(),
    category: text('category'),
    body: text('body').notNull(),
    raw: jsonb('raw').$type<Record<string, unknown>>(),
    importedAt: timestamp('imported_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: 'clinician_notes_pk', columns: [t.userId, t.source, t.requisitionId, t.position] }),
    index('clinician_notes_user_day_idx').on(t.userId, t.notedOn),
  ]
);

/**
 * `garmin_connections`: the Garmin job's state (scripts/garmin/sync.py, src/lib/vitals/garmin.mjs). One row for the
 * owner. `tokens_ciphertext` is the Garmin login, encrypted with AES-256-GCM by the job; the key (GARMIN_TOKEN_KEY)
 * is only in GitHub and on Paolo's Mac, so Coach cannot read it. `synced_through` is the last day the job fetched,
 * and the next run starts from it. A backfill (`sync.py --since`) records `backfill_from` and its progress in
 * `backfill_through`; runs continue it until it is done, then `backfill_from` is null again. `last_error` is a
 * short line without secrets or health values.
 */
export const garminConnections = pgTable(
  'garmin_connections',
  {
    userId: text('user_id').primaryKey(),
    tokensCiphertext: text('tokens_ciphertext'),
    status: text('status').$type<'ok' | 'auth_failed' | 'error'>().notNull().default('ok'),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true, mode: 'date' }),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true, mode: 'date' }),
    lastError: text('last_error'),
    syncedThrough: date('synced_through', { mode: 'string' }),
    backfillFrom: date('backfill_from', { mode: 'string' }),
    backfillThrough: date('backfill_through', { mode: 'string' }),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [check('garmin_connections_status_check', sql`${t.status} IN ('ok', 'auth_failed', 'error')`)]
);

/**
 * `garmin_raw`: the Garmin Connect responses, one per user, day and kind (src/lib/vitals/garmin.mjs RAW_KINDS),
 * without the account ids, names and emails. The archive behind health_samples: it keeps the time series (sleep
 * stages, heart rate, stress, Body Battery, HRV readings) and the performance pages, so Coach can map more metrics
 * later without fetching from Garmin again. Once-a-run kinds use the run's day.
 */
export const garminRaw = pgTable(
  'garmin_raw',
  {
    userId: text('user_id').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    kind: text('kind').notNull(),
    payload: jsonb('payload').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: 'garmin_raw_pk', columns: [t.userId, t.date, t.kind] }),
    index('garmin_raw_kind_date_idx').on(t.userId, t.kind, t.date),
  ]
);

export type HealthSampleRow = typeof healthSamples.$inferSelect;
export type LabResultRow = typeof labResults.$inferSelect;
export type GarminConnectionRow = typeof garminConnections.$inferSelect;
export type GarminRawRow = typeof garminRaw.$inferSelect;
