CREATE TABLE "plan_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"proposal_id" text,
	"kind" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"status" text NOT NULL,
	"stop" text,
	"turns" smallint DEFAULT 0 NOT NULL,
	"submits" smallint DEFAULT 0 NOT NULL,
	"first_draft_problems" jsonb,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_tokens" integer DEFAULT 0 NOT NULL,
	"cache_write_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" double precision DEFAULT 0 NOT NULL,
	"duration_ms" integer,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plan_runs_kind_check" CHECK ("plan_runs"."kind" IN ('plan', 'eval')),
	CONSTRAINT "plan_runs_status_check" CHECK ("plan_runs"."status" IN ('running', 'ok', 'failed'))
);
--> statement-breakpoint
CREATE INDEX "plan_runs_user_created_idx" ON "plan_runs" USING btree ("user_id","created_at");