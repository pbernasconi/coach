CREATE TABLE "activity_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"strava_activity_id" text NOT NULL,
	"plan_activity_id" text,
	"bank" text,
	"key" text NOT NULL,
	"status" text DEFAULT 'ok' NOT NULL,
	"error" text,
	"analysis" jsonb,
	"review" jsonb,
	"model" text,
	"cost_usd" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage" DROP CONSTRAINT "ai_usage_feature_check";--> statement-breakpoint
CREATE UNIQUE INDEX "activity_reviews_user_activity_idx" ON "activity_reviews" USING btree ("user_id","strava_activity_id");--> statement-breakpoint
CREATE INDEX "activity_reviews_user_bank_idx" ON "activity_reviews" USING btree ("user_id","bank","created_at");--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_feature_check" CHECK ("ai_usage"."feature" IN ('chat', 'chat_warmup', 'planner', 'planner_eval', 'activity_review'));