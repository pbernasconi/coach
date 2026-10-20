CREATE TABLE "workout_syncs" (
	"activity_id" text NOT NULL,
	"target" text NOT NULL,
	"remote_id" text NOT NULL,
	"content_hash" text NOT NULL,
	"status" text NOT NULL,
	"last_error" text,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workout_syncs_activity_id_target_pk" PRIMARY KEY("activity_id","target")
);
--> statement-breakpoint
ALTER TABLE "training_plan_activities" ADD COLUMN "steps" jsonb;