import { pgTable, text, timestamp, jsonb, integer, boolean, real, uniqueIndex } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

/**
 * Users
 * Core user profiles synced from Clerk
 */
export const users = pgTable('users', {
  id: text('id').primaryKey(), // Clerk user ID
  email: text('email').notNull().unique(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  imageUrl: text('image_url'),

  // Profile
  fullName: text('full_name'),
  username: text('username'),

  // Preferences
  timezone: text('timezone').default('UTC'),

  // Status
  isActive: boolean('is_active').notNull().default(true),

  // Metadata
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { mode: 'date' }),
});

/**
 * Google Calendar Connections
 * Stores OAuth credentials for each user's Google Calendar connection
 */
export const calendarConnections = pgTable('calendar_connections', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text('user_id').notNull(),
  googleEmail: text('google_email').notNull(),

  // OAuth credentials
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  tokenExpiresAt: timestamp('token_expires_at', { mode: 'date' }).notNull(),

  // Google account info
  googleAccountId: text('google_account_id').notNull().unique(),
  scope: text('scope').notNull(), // Space-separated list of granted scopes

  // Status
  isActive: boolean('is_active').notNull().default(true),
  lastSyncedAt: timestamp('last_synced_at', { mode: 'date' }),

  // Metadata
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});

/**
 * Calendar Events
 * Stores synced events from Google Calendar
 */
export const calendarEvents = pgTable('calendar_events', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  // Relationship
  connectionId: text('connection_id')
    .notNull()
    .references(() => calendarConnections.id, { onDelete: 'cascade' }),

  // Google Calendar identifiers
  googleEventId: text('google_event_id').notNull(),
  googleCalendarId: text('google_calendar_id').notNull(),

  // Event details
  summary: text('summary'),
  description: text('description'),
  location: text('location'),

  // Timing
  startTime: timestamp('start_time', { mode: 'date' }).notNull(),
  endTime: timestamp('end_time', { mode: 'date' }).notNull(),
  timezone: text('timezone'),
  isAllDay: boolean('is_all_day').notNull().default(false),

  // Recurrence
  recurringEventId: text('recurring_event_id'),
  recurrence: jsonb('recurrence'), // RRULE data

  // Status
  status: text('status').notNull().default('confirmed'), // confirmed, tentative, cancelled

  // Participants
  attendees: jsonb('attendees'), // Array of attendee objects
  organizer: jsonb('organizer'), // Organizer object

  // Metadata from Google
  htmlLink: text('html_link'),
  hangoutLink: text('hangout_link'),
  conferenceData: jsonb('conference_data'),

  // Full raw event data for reference
  rawEventData: jsonb('raw_event_data'),

  // Sync metadata
  lastModified: timestamp('last_modified', { mode: 'date' }),

  // Timestamps
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});

/**
 * Sync History
 * Tracks sync operations for debugging and monitoring
 */
export const calendarSyncHistory = pgTable('calendar_sync_history', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  connectionId: text('connection_id')
    .notNull()
    .references(() => calendarConnections.id, { onDelete: 'cascade' }),

  // Sync details
  syncStartedAt: timestamp('sync_started_at', { mode: 'date' }).notNull(),
  syncCompletedAt: timestamp('sync_completed_at', { mode: 'date' }),

  status: text('status').notNull(), // in_progress, completed, failed

  // Statistics
  eventsCreated: integer('events_created').notNull().default(0),
  eventsUpdated: integer('events_updated').notNull().default(0),
  eventsDeleted: integer('events_deleted').notNull().default(0),

  // Error tracking
  errorMessage: text('error_message'),
  errorDetails: jsonb('error_details'),

  // Metadata
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
});

/**
 * Training Plans
 * AI-generated weekly training plans
 */
export const trainingPlans = pgTable('training_plans', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  userId: text('user_id').notNull(),

  // Plan details
  weekStartDate: timestamp('week_start_date', { mode: 'date' }).notNull(),
  weekEndDate: timestamp('week_end_date', { mode: 'date' }).notNull(),

  // AI-generated content
  planContent: text('plan_content').notNull(), // Markdown or plain text
  aiModel: text('ai_model').notNull(), // e.g., "claude-3-5-sonnet-20241022"

  // Goals and context
  goals: jsonb('goals'), // User's stated goals
  contextData: jsonb('context_data'), // Summary of calendar/strava data used

  // Status
  status: text('status').notNull().default('active'), // active, completed, archived

  // "How do you feel" check-ins from the week page: [{ date: 'YYYY-MM-DD', feel, at }]
  feelLog: jsonb('feel_log').$type<{ date: string; feel: string; at: string }[]>().notNull().default([]),

  // Metadata
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
}, (table) => [uniqueIndex('training_plans_user_week_idx').on(table.userId, table.weekStartDate)]);

/**
 * Training Plan Activities
 * Individual workouts/activities within a training plan
 */
export const trainingPlanActivities = pgTable('training_plan_activities', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  planId: text('plan_id')
    .notNull()
    .references(() => trainingPlans.id, { onDelete: 'cascade' }),

  // Activity details
  activityType: text('activity_type').notNull(), // run, bike, rest, etc.
  title: text('title').notNull(),
  description: text('description'),

  // Scheduling
  scheduledDate: timestamp('scheduled_date', { mode: 'date' }).notNull(),
  duration: integer('duration'), // minutes
  distance: integer('distance'), // meters

  // Intensity
  intensity: text('intensity'), // easy, moderate, hard, recovery
  targetHeartRate: jsonb('target_heart_rate'), // zones or ranges
  targetPace: jsonb('target_pace'), // min/km or similar

  // Completion tracking
  isCompleted: boolean('is_completed').notNull().default(false),
  completedAt: timestamp('completed_at', { mode: 'date' }),
  stravaActivityId: text('strava_activity_id'), // Link to actual Strava activity

  // Week page (plans/*.json import, drag to move, adapt to how I feel)
  startTime: text('start_time'), // 'HH:MM' local time, or null for any time
  endTime: text('end_time'),
  timeZone: text('time_zone'),
  workoutType: text('workout_type'), // e.g. strength-heavy, vo2-bike, long-ride
  tss: real('tss'),
  why: text('why'),
  status: text('status').notNull().default('planned'), // planned | skipped
  adaptedFrom: jsonb('adapted_from').$type<Record<string, unknown> | null>(), // fields before an adapt, for undo
  editedAt: timestamp('edited_at', { mode: 'date' }), // set when moved or changed on the web; import then leaves it
  sourceKey: text('source_key'), // '<weekStart>#<index>' from plans/<weekStart>.json
  sortOrder: integer('sort_order').notNull().default(0),

  // Metadata
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
}, (table) => [uniqueIndex('training_plan_activities_source_idx').on(table.planId, table.sourceKey)]);

/**
 * User Goals
 * Long-term training goals and preferences
 */
export const userGoals = pgTable('user_goals', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  userId: text('user_id').notNull().unique(),

  // Goals
  primarySport: text('primary_sport'), // running, cycling, triathlon
  goalType: text('goal_type'), // distance, speed, endurance, general_fitness
  targetEvent: text('target_event'),
  targetEventDate: timestamp('target_event_date', { mode: 'date' }),

  // Training preferences
  daysPerWeek: integer('days_per_week'),
  hoursPerWeek: integer('hours_per_week'),
  preferredDays: jsonb('preferred_days'), // Array of day names

  // Current fitness level
  fitnessLevel: text('fitness_level'), // beginner, intermediate, advanced
  currentWeeklyVolume: jsonb('current_weekly_volume'), // Hours/distance by sport

  // Additional context
  notes: text('notes'),

  // Metadata
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});

/**
 * Strava Connections
 * Stores OAuth credentials for each user's Strava connection
 */
export const stravaConnections = pgTable('strava_connections', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text('user_id').notNull().unique(),
  athleteId: integer('athlete_id').notNull(),

  // OAuth credentials
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  expiresAt: integer('expires_at').notNull(), // Unix timestamp

  // Scope
  scope: text('scope').notNull(),

  // Status
  isActive: boolean('is_active').notNull().default(true),
  lastSyncedAt: timestamp('last_synced_at', { mode: 'date' }),

  // Metadata
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});

/**
 * Strava Activities
 * Stores synced activities from Strava
 */
export const stravaActivities = pgTable('strava_activities', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  // Relationship
  userId: text('user_id').notNull(),
  connectionId: text('connection_id')
    .notNull()
    .references(() => stravaConnections.id, { onDelete: 'cascade' }),

  // // Strava identifiers
  stravaActivityId: text('strava_activity_id').notNull(),

  // // Activity details
  name: text('name'),
  type: text('type'), // Run, Ride, Swim, etc.
  sportType: text('sport_type'),

  // Metrics
  distance: real('distance'), // meters
  movingTime: integer('moving_time'), // seconds
  elapsedTime: integer('elapsed_time'), // seconds
  totalElevationGain: real('total_elevation_gain'), // meters

  // Timing
  startDate: timestamp('start_date', { mode: 'date' }),
  startDateLocal: timestamp('start_date_local', { mode: 'date' }),
  timezone: text('timezone'),

  // Speed
  averageSpeed: real('average_speed'), // m/s
  maxSpeed: real('max_speed'), // m/s

  // Other metrics (nullable)
  averageCadence: real('average_cadence'),
  averageWatts: real('average_watts'),
  weightedAverageWatts: real('weighted_average_watts'), // Normalized Power — bike TSS input
  maxWatts: integer('max_watts'),
  deviceWatts: boolean('device_watts'), // true = real power meter, false = estimated
  averageHeartrate: real('average_heartrate'),
  maxHeartrate: integer('max_heartrate'),
  kilojoules: real('kilojoules'),
  averageTemp: real('average_temp'), // °C

  // Workout context
  workoutType: integer('workout_type'), // 0=default, 1=race (run), 2=long run, 3=workout; bike uses 10/11/12
  description: text('description'), // athlete's own notes — RPE/feel
  commute: boolean('commute').default(false),
  trainer: boolean('trainer').default(false),
  gearId: text('gear_id'),

  // Location
  startLatlng: jsonb('start_latlng'), // [lat, lng] or null
  locationCity: text('location_city'),
  locationState: text('location_state'),
  locationCountry: text('location_country'),

  // Elevation profile
  elevHigh: real('elev_high'),
  elevLow: real('elev_low'),

  // Performance signals
  achievementCount: integer('achievement_count').default(0),
  prCount: integer('pr_count').default(0),
  sufferScore: integer('suffer_score'), // Strava's HR-based load (detailed endpoint only)

  // Computed / cached metrics — populated at backfill time so reads are O(1)
  tss: real('tss'), // hrTSS (HR-based) or pTSS (power-based) — power preferred when device_watts && NP && FTP
  tssMethod: text('tss_method'), // 'power' | 'hr' | 'duration_fallback'
  zoneTimes: jsonb('zone_times'), // { z1, z2, z3, z4, z5 } in seconds — based on athlete HR zones, computed from streams when present

  // Social
  kudosCount: integer('kudos_count').default(0),
  commentCount: integer('comment_count').default(0),

  // Timestamps
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow(),
});

/**
 * Strava Activity Laps
 * Per-lap breakdown from a detailed activity (e.g., the 10 intervals of a VO2 session).
 */
export const stravaActivityLaps = pgTable('strava_activity_laps', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  activityId: text('activity_id')
    .notNull()
    .references(() => stravaActivities.id, { onDelete: 'cascade' }),
  lapIndex: integer('lap_index').notNull(),
  name: text('name'),
  distance: real('distance'),
  movingTime: integer('moving_time'),
  elapsedTime: integer('elapsed_time'),
  totalElevationGain: real('total_elevation_gain'),
  averageSpeed: real('average_speed'),
  maxSpeed: real('max_speed'),
  averageCadence: real('average_cadence'),
  averageWatts: real('average_watts'),
  averageHeartrate: real('average_heartrate'),
  maxHeartrate: integer('max_heartrate'),
  startIndex: integer('start_index'), // index into the streams array
  endIndex: integer('end_index'),
  lapSplit: integer('lap_split'), // 1=lap, 2=auto-lap, etc.
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow(),
});

/**
 * Strava Activity Splits (metric)
 * Per-km splits for runs.
 */
export const stravaActivitySplits = pgTable('strava_activity_splits', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  activityId: text('activity_id')
    .notNull()
    .references(() => stravaActivities.id, { onDelete: 'cascade' }),
  splitIndex: integer('split_index').notNull(),
  distance: real('distance'),
  movingTime: integer('moving_time'),
  elapsedTime: integer('elapsed_time'),
  averageSpeed: real('average_speed'),
  elevationDifference: real('elevation_difference'),
  paceZone: integer('pace_zone'),
  averageHeartrate: real('average_heartrate'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow(),
});

/**
 * Strava Activity Streams
 * Second-by-second time series. One row per stream type per activity.
 * Data is the raw float array as JSONB.
 */
export const stravaActivityStreams = pgTable('strava_activity_streams', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  activityId: text('activity_id')
    .notNull()
    .references(() => stravaActivities.id, { onDelete: 'cascade' }),
  streamType: text('stream_type').notNull(), // 'heartrate', 'watts', 'velocity_smooth', 'cadence', 'altitude', 'temp', 'time', 'distance'
  resolution: text('resolution'), // 'low', 'medium', 'high'
  originalSize: integer('original_size'),
  data: jsonb('data').notNull(), // number[]
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow(),
});

/**
 * Strava Athlete Profile
 * One-row-per-athlete cache of zones, FTP, weight — needed for proper TSS and zone-based prescription.
 */
export const stravaAthleteProfile = pgTable('strava_athlete_profile', {
  athleteId: integer('athlete_id').primaryKey(),
  userId: text('user_id').notNull(),
  sex: text('sex'),
  weightKg: real('weight_kg'),
  ftp: integer('ftp'), // functional threshold power, W
  // Zones stored as JSONB so we don't need to flatten them.
  hrZones: jsonb('hr_zones'), // { zones: [{ min, max }, ...] }
  powerZones: jsonb('power_zones'),
  paceZones: jsonb('pace_zones'),
  thresholdHr: integer('threshold_hr'), // derived or user-set
  maxHr: integer('max_hr'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});

/**
 * Daily Training Load
 * One row per user-day. Populated by the Strava backfill script.
 * Pre-computed CTL / ATL / TSB so profile reads are O(1).
 */
export const dailyTrainingLoad = pgTable(
  'daily_training_load',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text('user_id').notNull(),
    date: text('date').notNull(), // YYYY-MM-DD (local)
    tss: real('tss').notNull().default(0), // sum of activity TSS for the day
    ctl: real('ctl').notNull().default(0), // 42d EWMA
    atl: real('atl').notNull().default(0), // 7d EWMA
    tsb: real('tsb').notNull().default(0), // ctl - atl
    computedAt: timestamp('computed_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    userDateUnique: uniqueIndex('daily_training_load_user_date_idx').on(t.userId, t.date),
  }),
);

/**
 * Chat Sessions
 * Tracks conversation sessions with the AI coach
 */
export const chatSessions = pgTable('chat_sessions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  userId: text('user_id').notNull(),

  // Session metadata
  title: text('title'), // Optional custom title or auto-generated from first message

  // Status
  isActive: boolean('is_active').notNull().default(true),

  // Timestamps
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  lastMessageAt: timestamp('last_message_at', { mode: 'date' }).notNull().defaultNow(),
});

/**
 * Chat Messages
 * Stores individual messages within chat sessions
 */
export const chatMessages = pgTable('chat_messages', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  sessionId: text('session_id')
    .notNull()
    .references(() => chatSessions.id, { onDelete: 'cascade' }),

  // Message details
  role: text('role').notNull(), // 'user' or 'assistant'
  content: text('content').notNull(),

  // Context used for this message (for debugging/transparency)
  contextData: jsonb('context_data'), // Calendar events, Strava activities, goals used

  // Timestamps
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
});

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type CalendarConnection = typeof calendarConnections.$inferSelect;
export type NewCalendarConnection = typeof calendarConnections.$inferInsert;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type NewCalendarEvent = typeof calendarEvents.$inferInsert;
export type CalendarSyncHistory = typeof calendarSyncHistory.$inferSelect;
export type NewCalendarSyncHistory = typeof calendarSyncHistory.$inferInsert;
export type TrainingPlan = typeof trainingPlans.$inferSelect;
export type NewTrainingPlan = typeof trainingPlans.$inferInsert;
export type TrainingPlanActivity = typeof trainingPlanActivities.$inferSelect;
export type NewTrainingPlanActivity = typeof trainingPlanActivities.$inferInsert;
export type UserGoals = typeof userGoals.$inferSelect;
export type NewUserGoals = typeof userGoals.$inferInsert;
export type StravaConnection = typeof stravaConnections.$inferSelect;
export type NewStravaConnection = typeof stravaConnections.$inferInsert;
export type StravaActivity = typeof stravaActivities.$inferSelect;
export type NewStravaActivity = typeof stravaActivities.$inferInsert;
export type StravaActivityLap = typeof stravaActivityLaps.$inferSelect;
export type NewStravaActivityLap = typeof stravaActivityLaps.$inferInsert;
export type StravaActivitySplit = typeof stravaActivitySplits.$inferSelect;
export type NewStravaActivitySplit = typeof stravaActivitySplits.$inferInsert;
export type StravaActivityStream = typeof stravaActivityStreams.$inferSelect;
export type NewStravaActivityStream = typeof stravaActivityStreams.$inferInsert;
export type StravaAthleteProfile = typeof stravaAthleteProfile.$inferSelect;
export type NewStravaAthleteProfile = typeof stravaAthleteProfile.$inferInsert;
export type DailyTrainingLoad = typeof dailyTrainingLoad.$inferSelect;
export type NewDailyTrainingLoad = typeof dailyTrainingLoad.$inferInsert;
export type ChatSession = typeof chatSessions.$inferSelect;
export type NewChatSession = typeof chatSessions.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;

// Lift sync tables (lift/SYNC.md)
export * from './lift-schema';
