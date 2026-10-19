ALTER TABLE "training_plans" ADD COLUMN IF NOT EXISTS "feel_log" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "training_plans_user_week_idx" ON "training_plans" USING btree ("user_id","week_start_date");--> statement-breakpoint
ALTER TABLE "training_plan_activities" ADD COLUMN IF NOT EXISTS "start_time" text;--> statement-breakpoint
ALTER TABLE "training_plan_activities" ADD COLUMN IF NOT EXISTS "end_time" text;--> statement-breakpoint
ALTER TABLE "training_plan_activities" ADD COLUMN IF NOT EXISTS "time_zone" text;--> statement-breakpoint
ALTER TABLE "training_plan_activities" ADD COLUMN IF NOT EXISTS "workout_type" text;--> statement-breakpoint
ALTER TABLE "training_plan_activities" ADD COLUMN IF NOT EXISTS "tss" real;--> statement-breakpoint
ALTER TABLE "training_plan_activities" ADD COLUMN IF NOT EXISTS "why" text;--> statement-breakpoint
ALTER TABLE "training_plan_activities" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'planned' NOT NULL;--> statement-breakpoint
ALTER TABLE "training_plan_activities" ADD COLUMN IF NOT EXISTS "adapted_from" jsonb;--> statement-breakpoint
ALTER TABLE "training_plan_activities" ADD COLUMN IF NOT EXISTS "edited_at" timestamp;--> statement-breakpoint
ALTER TABLE "training_plan_activities" ADD COLUMN IF NOT EXISTS "source_key" text;--> statement-breakpoint
ALTER TABLE "training_plan_activities" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "training_plan_activities_source_idx" ON "training_plan_activities" USING btree ("plan_id","source_key");
