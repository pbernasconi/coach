ALTER TABLE "garmin_activities" ADD COLUMN "feedback_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workout_feedback" ADD COLUMN "source" text;