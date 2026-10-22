CREATE TABLE "garmin_activities" (
	"garmin_activity_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"start_utc" timestamp with time zone NOT NULL,
	"activity_type" text,
	"summary" jsonb,
	"detail" jsonb,
	"series" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "garmin_activities_user_start_idx" ON "garmin_activities" USING btree ("user_id","start_utc");