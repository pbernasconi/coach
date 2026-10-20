CREATE TABLE "clinician_notes" (
	"user_id" text NOT NULL,
	"source" text DEFAULT 'function' NOT NULL,
	"requisition_id" text NOT NULL,
	"position" bigint NOT NULL,
	"noted_on" date NOT NULL,
	"category" text,
	"body" text NOT NULL,
	"raw" jsonb,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clinician_notes_pk" PRIMARY KEY("user_id","source","requisition_id","position")
);
--> statement-breakpoint
CREATE INDEX "clinician_notes_user_day_idx" ON "clinician_notes" USING btree ("user_id","noted_on");