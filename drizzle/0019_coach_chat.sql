CREATE TABLE "coach_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"text" text NOT NULL,
	"proposal_id" text,
	"model" text,
	"cost_usd" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coach_messages_role_check" CHECK ("coach_messages"."role" IN ('user', 'assistant'))
);
--> statement-breakpoint
CREATE TABLE "coach_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"why" text,
	"changes" jsonb NOT NULL,
	"items" jsonb NOT NULL,
	"warnings" jsonb NOT NULL,
	"status" text NOT NULL,
	"undo" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp,
	CONSTRAINT "coach_proposals_status_check" CHECK ("coach_proposals"."status" IN ('open', 'applied', 'undone', 'dismissed', 'stale'))
);
--> statement-breakpoint
CREATE TABLE "coach_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "coach_messages_thread_created_idx" ON "coach_messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "coach_messages_user_created_idx" ON "coach_messages" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "coach_proposals_thread_idx" ON "coach_proposals" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "coach_threads_user_updated_idx" ON "coach_threads" USING btree ("user_id","updated_at");