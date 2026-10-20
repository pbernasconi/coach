CREATE TABLE "strava_activity_details" (
	"activity_id" text PRIMARY KEY NOT NULL,
	"polyline" text,
	"summary_polyline" text,
	"calories" real,
	"device_name" text,
	"place" text,
	"perceived_exertion" real,
	"best_efforts" jsonb,
	"segment_efforts" jsonb,
	"weather" jsonb,
	"detail_fetched_at" timestamp,
	"streams_fetched_at" timestamp,
	"weather_fetched_at" timestamp,
	"fetch_error" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strava_gear" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text,
	"distance" real,
	"retired" boolean,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "strava_activity_splits" ADD COLUMN "average_grade_adjusted_speed" real;--> statement-breakpoint
ALTER TABLE "strava_activity_details" ADD CONSTRAINT "strava_activity_details_activity_id_strava_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."strava_activities"("id") ON DELETE cascade ON UPDATE no action;