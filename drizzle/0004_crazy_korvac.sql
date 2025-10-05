ALTER TABLE "strava_activities" ALTER COLUMN "strava_activity_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "strava_activities" DROP COLUMN "summary_polyline";--> statement-breakpoint
ALTER TABLE "strava_activities" DROP COLUMN "raw_activity_data";