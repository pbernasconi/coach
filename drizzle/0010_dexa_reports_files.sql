CREATE TABLE "dexa_files" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"result_id" text,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"data" "bytea" NOT NULL,
	"text" text,
	"note" text,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dexa_scans" ADD COLUMN "derived" jsonb;--> statement-breakpoint
ALTER TABLE "dexa_scans" ADD COLUMN "report_md" text;--> statement-breakpoint
ALTER TABLE "dexa_scans" ADD COLUMN "report_version" integer;--> statement-breakpoint
CREATE INDEX "dexa_files_user_idx" ON "dexa_files" USING btree ("user_id","uploaded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "dexa_files_user_sha_idx" ON "dexa_files" USING btree ("user_id","sha256");