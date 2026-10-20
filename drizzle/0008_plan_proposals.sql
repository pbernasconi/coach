CREATE TABLE "plan_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"week_start" date NOT NULL,
	"status" text NOT NULL,
	"request" jsonb NOT NULL,
	"plan" jsonb,
	"summary" text,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp,
	CONSTRAINT "plan_proposals_status_check" CHECK ("plan_proposals"."status" IN ('requested', 'running', 'proposed', 'accepted', 'rejected', 'failed')),
	CONSTRAINT "plan_proposals_kind_check" CHECK ("plan_proposals"."kind" IN ('weekly', 'checkin'))
);
--> statement-breakpoint
CREATE INDEX "plan_proposals_user_created_idx" ON "plan_proposals" USING btree ("user_id","created_at");