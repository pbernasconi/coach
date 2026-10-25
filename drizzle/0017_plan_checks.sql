CREATE TABLE "plan_verdicts" (
	"user_id" text NOT NULL,
	"item" text NOT NULL,
	"week_start" date NOT NULL,
	"verdict" text NOT NULL,
	"note" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plan_verdicts_user_id_item_pk" PRIMARY KEY("user_id","item"),
	CONSTRAINT "plan_verdicts_verdict_check" CHECK ("plan_verdicts"."verdict" IN ('good', 'bad'))
);
--> statement-breakpoint
ALTER TABLE "plan_proposals" ADD COLUMN "context" jsonb;--> statement-breakpoint
ALTER TABLE "plan_proposals" ADD COLUMN "checks" jsonb;