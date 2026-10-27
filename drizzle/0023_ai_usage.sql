CREATE TABLE "ai_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"feature" text NOT NULL,
	"model" text NOT NULL,
	"effort" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_tokens" integer DEFAULT 0 NOT NULL,
	"cache_write_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" double precision DEFAULT 0 NOT NULL,
	"duration_ms" integer,
	"ok" boolean DEFAULT true NOT NULL,
	"ref_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_usage_feature_check" CHECK ("ai_usage"."feature" IN ('chat', 'chat_warmup', 'planner', 'planner_eval'))
);
--> statement-breakpoint
CREATE INDEX "ai_usage_user_created_idx" ON "ai_usage" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_ref_idx" ON "ai_usage" USING btree ("ref_id");--> statement-breakpoint
-- Copy the spend recorded before this table: chat answers (coach_messages) and planner runs (plan_runs).
INSERT INTO "ai_usage" ("id", "user_id", "feature", "model", "effort", "input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens", "cost_usd", "duration_ms", "ok", "ref_id", "created_at")
SELECT 'cm_' || "id", "user_id", 'chat', COALESCE("model", 'claude-opus-5-5'), "meta"->>'effort',
	COALESCE(("meta"->'usage'->>'input')::integer, 0), COALESCE(("meta"->'usage'->>'output')::integer, 0),
	COALESCE(("meta"->'usage'->>'cacheRead')::integer, 0), COALESCE(("meta"->'usage'->>'cacheWrite')::integer, 0),
	"cost_usd", ("meta"->>'latencyMs')::integer, COALESCE("meta"->>'stop', '') <> 'error', "id", "created_at"
FROM "coach_messages" WHERE "role" = 'assistant' AND "cost_usd" > 0;
--> statement-breakpoint
INSERT INTO "ai_usage" ("id", "user_id", "feature", "model", "effort", "input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens", "cost_usd", "duration_ms", "ok", "ref_id", "created_at")
SELECT 'pr_' || "id", "user_id", CASE WHEN "kind" = 'eval' THEN 'planner_eval' ELSE 'planner' END, "model", NULL,
	"input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens", "cost_usd", "duration_ms", "status" = 'ok', "id", "created_at"
FROM "plan_runs" WHERE "status" <> 'running';
