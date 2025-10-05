-- Drop and recreate strava_activities table with integer ID and nullable fields
DROP TABLE IF EXISTS "strava_activities" CASCADE;

CREATE TABLE "strava_activities" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" text NOT NULL,
  "connection_id" text NOT NULL REFERENCES "strava_connections"("id") ON DELETE CASCADE,
  "strava_activity_id" integer NOT NULL,
  "name" text,
  "type" text,
  "sport_type" text,
  "distance" integer,
  "moving_time" integer,
  "elapsed_time" integer,
  "total_elevation_gain" integer,
  "start_date" timestamp,
  "start_date_local" timestamp,
  "timezone" text,
  "average_speed" integer,
  "max_speed" integer,
  "average_cadence" integer,
  "average_watts" integer,
  "average_heartrate" integer,
  "max_heartrate" integer,
  "kilojoules" integer,
  "kudos_count" integer DEFAULT 0,
  "comment_count" integer DEFAULT 0,
  "summary_polyline" text,
  "raw_activity_data" jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "strava_activities_user_activity_unique" UNIQUE("user_id", "strava_activity_id")
);
