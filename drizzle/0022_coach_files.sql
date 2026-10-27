CREATE TABLE "coach_files" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"message_id" text,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"width" integer,
	"height" integer,
	"data" "bytea" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coach_files_kind_check" CHECK ("coach_files"."kind" IN ('image', 'pdf', 'text'))
);
--> statement-breakpoint
ALTER TABLE "coach_messages" ADD COLUMN "files" jsonb;--> statement-breakpoint
CREATE INDEX "coach_files_user_created_idx" ON "coach_files" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "coach_files_message_idx" ON "coach_files" USING btree ("message_id");