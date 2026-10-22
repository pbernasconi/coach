import { sql } from 'drizzle-orm';
import { bigint, boolean, check, customType, date, doublePrecision, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

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

/**
 * `garmin_activities`: the watch's own record of each workout, from Garmin Connect (scripts/garmin/activities.py),
 * about a minute after the workout reaches Strava (the Strava webhook starts garmin.yml). What Strava does not
 * carry: training effect, Garmin's training load, running dynamics, stamina, respiration, Body Battery.
 * `summary` is the activity list item, `detail` the activity's summary page, `series` a few of its time series
 * at up to 600 points ({ t: seconds[], <metric key>: values[] }). The activity page matches a Strava activity by
 * start time (src/lib/activity/watch.mjs).
 */
export const garminActivities = pgTable(
  'garmin_activities',
  {
    garminActivityId: text('garmin_activity_id').primaryKey(),
    userId: text('user_id').notNull(),
    startUtc: timestamp('start_utc', { withTimezone: true, mode: 'date' }).notNull(),
    activityType: text('activity_type'),
    summary: jsonb('summary'),
    detail: jsonb('detail'),
    series: jsonb('series'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [index('garmin_activities_user_start_idx').on(t.userId, t.startUtc)]
);

/**
 * `lab_biomarkers`: Function Health's catalog entry for each biomarker Paolo has results for (scripts/function-sync.mjs,
 * src/lib/vitals/function-catalog.mjs). Function's status, range and the reading text for /health/labs. The values and
 * the history stay in lab_results; `result_names` are the lab_results.biomarker names of this biomarker's draws.
 * `content` is { whyItMatters, sources[], recommendations[{ inRange, outOfRangeType, sections[{ key, title, body }] }] }.
 */
export const labBiomarkers = pgTable(
  'lab_biomarkers',
  {
    userId: text('user_id').notNull(),
    source: text('source').notNull().default('function'),
    key: text('key').notNull(), // Function's biomarker id
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    resultNames: text('result_names').array().notNull(),
    categories: text('categories').array().notNull(),
    description: text('description'),
    units: text('units'),
    status: text('status').$type<'in_range' | 'out_of_range' | 'other'>().notNull(),
    outOfRangeType: text('out_of_range_type'),
    kind: text('kind'), // continuous_range | qualitative | unclassified | deviation | …
    rangeText: text('range_text'),
    rangeMin: numeric('range_min'),
    rangeMax: numeric('range_max'),
    rangeMinOp: text('range_min_op'),
    rangeMaxOp: text('range_max_op'),
    optimalRange: text('optimal_range'),
    optimalLow: numeric('optimal_low'),
    optimalHigh: numeric('optimal_high'),
    currentDisplay: text('current_display'),
    currentOn: date('current_on', { mode: 'string' }),
    content: jsonb('content').$type<Record<string, unknown>>(),
    raw: jsonb('raw').$type<Record<string, unknown>>(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: 'lab_biomarkers_pk', columns: [t.userId, t.source, t.key] }),
    uniqueIndex('lab_biomarkers_user_slug_uq').on(t.userId, t.source, t.slug),
    check('lab_biomarkers_status_check', sql`${t.status} IN ('in_range', 'out_of_range', 'other')`),
  ]
);

/** `lab_categories`: Function's categories with the biomarkers in each (one biomarker can be in several). */
export const labCategories = pgTable(
  'lab_categories',
  {
    userId: text('user_id').notNull(),
    source: text('source').notNull().default('function'),
    key: text('key').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    position: integer('position').notNull(),
    biomarkerKeys: text('biomarker_keys').array().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ name: 'lab_categories_pk', columns: [t.userId, t.source, t.key] })]
);

/**
 * `lab_planned_draws`: the next test order Function plans (pending-schedules): its recommended date, the window to
 * book it in, and the visit date once it is booked. A sync replaces the rows of its source.
 */
export const labPlannedDraws = pgTable(
  'lab_planned_draws',
  {
    userId: text('user_id').notNull(),
    source: text('source').notNull().default('function'),
    key: text('key').notNull(),
    type: text('type'),
    recommendedOn: date('recommended_on', { mode: 'string' }),
    windowStart: date('window_start', { mode: 'string' }),
    windowEnd: date('window_end', { mode: 'string' }),
    visitOn: date('visit_on', { mode: 'string' }),
    scheduled: boolean('scheduled').notNull().default(false),
    raw: jsonb('raw').$type<Record<string, unknown>>(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ name: 'lab_planned_draws_pk', columns: [t.userId, t.source, t.key] })]
);

/**
 * `bodyspec_connections`: the BodySpec account (DEXA scans) of a user, connected with OAuth from Settings
 * (src/lib/vitals/bodyspec-api.ts). BodySpec's sign-in server registers Coach as a public client on the first
 * connect (`client_id`, for `redirect_uri`); the tokens come from the code exchange with PKCE and are stored
 * encrypted (AES-256-GCM, `sealToken`). `last_error` is a short
 * line without secrets or health values.
 */
export const bodyspecConnections = pgTable('bodyspec_connections', {
  userId: text('user_id').primaryKey(),
  clientId: text('client_id').notNull(),
  redirectUri: text('redirect_uri').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
  scope: text('scope'),
  status: text('status').$type<'ok' | 'auth_failed' | 'error'>().notNull().default('ok'),
  connectedAt: timestamp('connected_at', { withTimezone: true, mode: 'date' }),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true, mode: 'date' }),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true, mode: 'date' }),
  lastError: text('last_error'),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

/**
 * `dexa_scans`: one row per BodySpec DEXA result (src/lib/vitals/bodyspec.mjs maps the API's sections). The totals
 * are columns; `regions` (arms, legs, trunk, android, gynoid: fat, lean and bone kg), `bone_regions` and
 * `percentiles` keep the detail. `raw` is every section as BodySpec sent it.
 */
export const dexaScans = pgTable(
  'dexa_scans',
  {
    resultId: text('result_id').primaryKey(),
    userId: text('user_id').notNull(),
    scannedAt: timestamp('scanned_at', { withTimezone: true, mode: 'date' }).notNull(),
    scanDate: date('scan_date', { mode: 'string' }).notNull(),
    location: text('location'),
    scanner: text('scanner'),
    ageYears: doublePrecision('age_years'),
    heightCm: doublePrecision('height_cm'),
    totalMassKg: doublePrecision('total_mass_kg'),
    fatMassKg: doublePrecision('fat_mass_kg'),
    leanMassKg: doublePrecision('lean_mass_kg'),
    boneMassKg: doublePrecision('bone_mass_kg'),
    bodyFatPct: doublePrecision('body_fat_pct'),
    vatMassKg: doublePrecision('vat_mass_kg'),
    vatVolumeCm3: doublePrecision('vat_volume_cm3'),
    androidGynoidRatio: doublePrecision('android_gynoid_ratio'),
    boneDensity: doublePrecision('bone_density'),
    rmrKcal: doublePrecision('rmr_kcal'),
    regions: jsonb('regions').$type<Record<string, Record<string, number>>>(),
    boneRegions: jsonb('bone_regions').$type<Record<string, Record<string, number | null>>>(),
    percentiles: jsonb('percentiles').$type<Record<string, { value: number; percentile: number }>>(),
    raw: jsonb('raw').$type<Record<string, unknown>>(),
    /** Measures computed from `raw` (FFMI, ALMI, left/right lean balance…): `storedDerived` in src/lib/vitals/dexa.mjs. */
    derived: jsonb('derived').$type<Record<string, number | null>>(),
    /** The scan as Markdown, every number plus the change since the scan before (`scanReport`), for AI questions. */
    reportMd: text('report_md'),
    /** `REPORT_VERSION` that wrote `derived` and `report_md`; the sync rebuilds older ones from `raw`. */
    reportVersion: integer('report_version'),
    resultUpdatedAt: text('result_updated_at'),
    syncedAt: timestamp('synced_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [index('dexa_scans_user_date_idx').on(t.userId, t.scanDate)]
);

/** Postgres bytea. The code reads it as base64 (`encode(data, 'base64')`), the same text with either driver. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

/**
 * `dexa_files`: scan reports (PDF) and images uploaded on /health/dexa. BodySpec's API has no images or PDFs for
 * users (only its partner export), so they come from BodySpec's report builder by hand. `data` is the file (at
 * most 4 MB, Vercel's request limit); `text` is the PDF's text, for AI questions. `result_id` links the scan when
 * one is chosen.
 */
export const dexaFiles = pgTable(
  'dexa_files',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    resultId: text('result_id'),
    kind: text('kind').$type<'report' | 'image' | 'other'>().notNull(),
    name: text('name').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    sha256: text('sha256').notNull(),
    data: bytea('data').notNull(),
    text: text('text'),
    note: text('note'),
    /** For a scan image: which BodySpec view it is (composite, fat, lean, bone). */
    view: text('view').$type<'composite' | 'fat' | 'lean' | 'bone'>(),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [index('dexa_files_user_idx').on(t.userId, t.uploadedAt), uniqueIndex('dexa_files_user_sha_idx').on(t.userId, t.sha256)]
);

export type HealthSampleRow = typeof healthSamples.$inferSelect;
export type LabResultRow = typeof labResults.$inferSelect;
export type GarminConnectionRow = typeof garminConnections.$inferSelect;
export type GarminRawRow = typeof garminRaw.$inferSelect;
export type DexaScanRow = typeof dexaScans.$inferSelect;
export type DexaFileRow = typeof dexaFiles.$inferSelect;
