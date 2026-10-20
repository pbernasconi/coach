import { sql } from 'drizzle-orm';
import { check, date, index, integer, pgTable, primaryKey, real, text, timestamp } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

/**
 * Events and goals: races and target days, from the /goals page. Priority A is the season's main event.
 * The PMC chart marks them and the projection runs up to the next one.
 */
export const events = pgTable(
  'events',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    date: date('date', { mode: 'string' }).notNull(), // YYYY-MM-DD
    priority: text('priority').notNull().default('B'), // A | B | C
    sport: text('sport'), // ride | run | swim | triathlon | hike | strength | other
    notes: text('notes'),
    target: text('target'), // free text: "sub 1:35", "top 10"
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('events_user_date_idx').on(t.userId, t.date),
    check('events_priority_check', sql`${t.priority} IN ('A', 'B', 'C')`),
  ],
);

/**
 * Peak performances per Strava activity (src/lib/performance/peaks.mjs).
 * metric 'power': span = seconds, value = watts. metric 'run': span = meters (21097 = half), value = seconds.
 */
export const activityPeaks = pgTable(
  'activity_peaks',
  {
    userId: text('user_id').notNull(),
    stravaActivityId: text('strava_activity_id').notNull(),
    metric: text('metric').notNull(),
    span: integer('span').notNull(),
    value: real('value').notNull(),
    computedAt: timestamp('computed_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: 'activity_peaks_pk', columns: [t.userId, t.stravaActivityId, t.metric, t.span] }),
    index('activity_peaks_metric_idx').on(t.userId, t.metric, t.span),
  ],
);

/** The activities the peak scan has seen, so the backfill can stop and resume. status: ok | no_streams | gone. */
export const activityPeakScans = pgTable(
  'activity_peak_scans',
  {
    userId: text('user_id').notNull(),
    stravaActivityId: text('strava_activity_id').notNull(),
    version: integer('version').notNull(),
    status: text('status').notNull(),
    scannedAt: timestamp('scanned_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ name: 'activity_peak_scans_pk', columns: [t.userId, t.stravaActivityId] })],
);
