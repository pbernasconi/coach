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
ALTER TABLE "strava_activities" ADD COLUMN "tss" real;--> statement-breakpoint
ALTER TABLE "strava_activities" ADD COLUMN "tss_method" text;--> statement-breakpoint
ALTER TABLE "strava_activities" ADD COLUMN "zone_times" jsonb;