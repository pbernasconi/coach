import { pgTable, text, timestamp, jsonb, integer, boolean, bigint, real } from 'drizzle-orm/pg-core';
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

  // Metadata
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});

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

  // Metadata
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});

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
  averageHeartrate: real('average_heartrate'),
  maxHeartrate: integer('max_heartrate'),
  kilojoules: real('kilojoules'),

  // Social
  kudosCount: integer('kudos_count').default(0),
  commentCount: integer('comment_count').default(0),

  // Timestamps
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow(),
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
