CREATE SEQUENCE "public"."lift_rows_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "calendar_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"google_email" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"token_expires_at" timestamp NOT NULL,
	"google_account_id" text NOT NULL,
	"scope" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_connections_google_account_id_unique" UNIQUE("google_account_id")
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"google_event_id" text NOT NULL,
	"google_calendar_id" text NOT NULL,
	"summary" text,
	"description" text,
	"location" text,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"timezone" text,
	"is_all_day" boolean DEFAULT false NOT NULL,
	"recurring_event_id" text,
	"recurrence" jsonb,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"attendees" jsonb,
	"organizer" jsonb,
	"html_link" text,
	"hangout_link" text,
	"conference_data" jsonb,
	"raw_event_data" jsonb,
	"last_modified" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_sync_history" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"sync_started_at" timestamp NOT NULL,
	"sync_completed_at" timestamp,
	"status" text NOT NULL,
	"events_created" integer DEFAULT 0 NOT NULL,
	"events_updated" integer DEFAULT 0 NOT NULL,
	"events_deleted" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"error_details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"context_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_message_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_training_load" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"tss" real DEFAULT 0 NOT NULL,
	"ctl" real DEFAULT 0 NOT NULL,
	"atl" real DEFAULT 0 NOT NULL,
	"tsb" real DEFAULT 0 NOT NULL,
	"computed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strava_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"strava_activity_id" text NOT NULL,
	"name" text,
	"type" text,
	"sport_type" text,
	"distance" real,
	"moving_time" integer,
	"elapsed_time" integer,
	"total_elevation_gain" real,
	"start_date" timestamp,
	"start_date_local" timestamp,
	"timezone" text,
	"average_speed" real,
	"max_speed" real,
	"average_cadence" real,
	"average_watts" real,
	"weighted_average_watts" real,
	"max_watts" integer,
	"device_watts" boolean,
	"average_heartrate" real,
	"max_heartrate" integer,
	"kilojoules" real,
	"average_temp" real,
	"workout_type" integer,
	"description" text,
	"commute" boolean DEFAULT false,
	"trainer" boolean DEFAULT false,
	"gear_id" text,
	"start_latlng" jsonb,
	"location_city" text,
	"location_state" text,
	"location_country" text,
	"elev_high" real,
	"elev_low" real,
	"achievement_count" integer DEFAULT 0,
	"pr_count" integer DEFAULT 0,
	"suffer_score" integer,
	"tss" real,
	"tss_method" text,
	"zone_times" jsonb,
	"kudos_count" integer DEFAULT 0,
	"comment_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "strava_activity_laps" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_id" text NOT NULL,
	"lap_index" integer NOT NULL,
	"name" text,
	"distance" real,
	"moving_time" integer,
	"elapsed_time" integer,
	"total_elevation_gain" real,
	"average_speed" real,
	"max_speed" real,
	"average_cadence" real,
	"average_watts" real,
	"average_heartrate" real,
	"max_heartrate" integer,
	"start_index" integer,
	"end_index" integer,
	"lap_split" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "strava_activity_splits" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_id" text NOT NULL,
	"split_index" integer NOT NULL,
	"distance" real,
	"moving_time" integer,
	"elapsed_time" integer,
	"average_speed" real,
	"elevation_difference" real,
	"pace_zone" integer,
	"average_heartrate" real,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "strava_activity_streams" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_id" text NOT NULL,
	"stream_type" text NOT NULL,
	"resolution" text,
	"original_size" integer,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "strava_athlete_profile" (
	"athlete_id" integer PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"sex" text,
	"weight_kg" real,
	"ftp" integer,
	"hr_zones" jsonb,
	"power_zones" jsonb,
	"pace_zones" jsonb,
	"threshold_hr" integer,
	"max_hr" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strava_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"athlete_id" integer NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" integer NOT NULL,
	"scope" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "strava_connections_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "training_plan_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"activity_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"scheduled_date" timestamp NOT NULL,
	"duration" integer,
	"distance" integer,
	"intensity" text,
	"target_heart_rate" jsonb,
	"target_pace" jsonb,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"strava_activity_id" text,
	"start_time" text,
	"end_time" text,
	"time_zone" text,
	"workout_type" text,
	"tss" real,
	"why" text,
	"status" text DEFAULT 'planned' NOT NULL,
	"adapted_from" jsonb,
	"edited_at" timestamp,
	"source_key" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"week_start_date" timestamp NOT NULL,
	"week_end_date" timestamp NOT NULL,
	"plan_content" text NOT NULL,
	"ai_model" text NOT NULL,
	"goals" jsonb,
	"context_data" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"feel_log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_goals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"primary_sport" text,
	"goal_type" text,
	"target_event" text,
	"target_event_date" timestamp,
	"days_per_week" integer,
	"hours_per_week" integer,
	"preferred_days" jsonb,
	"fitness_level" text,
	"current_weekly_volume" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_goals_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"image_url" text,
	"full_name" text,
	"username" text,
	"timezone" text DEFAULT 'UTC',
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "lift_applied_changes" (
	"idempotency_key" uuid PRIMARY KEY NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lift_enrollments" (
	"code_hash" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lift_rows" (
	"entity" text NOT NULL,
	"id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"seq" bigint DEFAULT nextval('lift_rows_seq') NOT NULL,
	CONSTRAINT "lift_rows_entity_id_pk" PRIMARY KEY("entity","id")
);
--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_connection_id_calendar_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."calendar_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_sync_history" ADD CONSTRAINT "calendar_sync_history_connection_id_calendar_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."calendar_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strava_activities" ADD CONSTRAINT "strava_activities_connection_id_strava_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."strava_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strava_activity_laps" ADD CONSTRAINT "strava_activity_laps_activity_id_strava_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."strava_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strava_activity_splits" ADD CONSTRAINT "strava_activity_splits_activity_id_strava_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."strava_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strava_activity_streams" ADD CONSTRAINT "strava_activity_streams_activity_id_strava_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."strava_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plan_activities" ADD CONSTRAINT "training_plan_activities_plan_id_training_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_training_load_user_date_idx" ON "daily_training_load" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "training_plan_activities_source_idx" ON "training_plan_activities" USING btree ("plan_id","source_key");--> statement-breakpoint
CREATE UNIQUE INDEX "training_plans_user_week_idx" ON "training_plans" USING btree ("user_id","week_start_date");--> statement-breakpoint
CREATE INDEX "lift_rows_seq_idx" ON "lift_rows" USING btree ("seq");