CREATE TABLE "workout_feedback" (
	"user_id" text NOT NULL,
	"item" text NOT NULL,
	"date" date NOT NULL,
	"title" text,
	"plan_activity_id" text,
	"feel" smallint,
	"rpe" smallint,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workout_feedback_user_id_item_pk" PRIMARY KEY("user_id","item"),
	CONSTRAINT "workout_feedback_feel_check" CHECK ("workout_feedback"."feel" IS NULL OR "workout_feedback"."feel" BETWEEN 1 AND 5),
	CONSTRAINT "workout_feedback_rpe_check" CHECK ("workout_feedback"."rpe" IS NULL OR "workout_feedback"."rpe" BETWEEN 1 AND 10)
);
--> statement-breakpoint
CREATE INDEX "workout_feedback_user_date_idx" ON "workout_feedback" USING btree ("user_id","date");