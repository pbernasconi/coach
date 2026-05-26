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
ALTER TABLE "strava_activities" ADD COLUMN "weighted_average_watts" real;--> statement-breakpoint
ALTER TABLE "strava_activities" ADD COLUMN "max_watts" integer;--> statement-breakpoint
ALTER TABLE "strava_activities" ADD COLUMN "device_watts" boolean;--> statement-breakpoint
ALTER TABLE "strava_activities" ADD COLUMN "average_temp" real;--> statement-breakpoint
ALTER TABLE "strava_activities" ADD COLUMN "workout_type" integer;--> statement-breakpoint
ALTER TABLE "strava_activities" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "strava_activities" ADD COLUMN "commute" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "strava_activities" ADD COLUMN "trainer" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "strava_activities" ADD COLUMN "gear_id" text;--> statement-breakpoint
ALTER TABLE "strava_activities" ADD COLUMN "start_latlng" jsonb;--> statement-breakpoint
ALTER TABLE "strava_activities" ADD COLUMN "location_city" text;--> statement-breakpoint
ALTER TABLE "strava_activities" ADD COLUMN "location_state" text;--> statement-breakpoint
ALTER TABLE "strava_activities" ADD COLUMN "location_country" text;--> statement-breakpoint
ALTER TABLE "strava_activities" ADD COLUMN "elev_high" real;--> statement-breakpoint
ALTER TABLE "strava_activities" ADD COLUMN "elev_low" real;--> statement-breakpoint
ALTER TABLE "strava_activities" ADD COLUMN "achievement_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "strava_activities" ADD COLUMN "pr_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "strava_activities" ADD COLUMN "suffer_score" integer;--> statement-breakpoint
ALTER TABLE "strava_activity_laps" ADD CONSTRAINT "strava_activity_laps_activity_id_strava_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."strava_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strava_activity_splits" ADD CONSTRAINT "strava_activity_splits_activity_id_strava_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."strava_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strava_activity_streams" ADD CONSTRAINT "strava_activity_streams_activity_id_strava_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."strava_activities"("id") ON DELETE cascade ON UPDATE no action;