ALTER TABLE "training_plan_activities" ADD COLUMN IF NOT EXISTS "lift_template" text;--> statement-breakpoint
ALTER TABLE "training_plan_activities" ADD COLUMN IF NOT EXISTS "lift_session_id" text;