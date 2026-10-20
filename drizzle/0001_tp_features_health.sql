CREATE TABLE "activity_peak_scans" (
	"user_id" text NOT NULL,
	"strava_activity_id" text NOT NULL,
	"version" integer NOT NULL,
	"status" text NOT NULL,
	"scanned_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "activity_peak_scans_pk" PRIMARY KEY("user_id","strava_activity_id")
);
--> statement-breakpoint
CREATE TABLE "activity_peaks" (
	"user_id" text NOT NULL,
	"strava_activity_id" text NOT NULL,
	"metric" text NOT NULL,
	"span" integer NOT NULL,
	"value" real NOT NULL,
	"computed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "activity_peaks_pk" PRIMARY KEY("user_id","strava_activity_id","metric","span")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"date" date NOT NULL,
	"priority" text DEFAULT 'B' NOT NULL,
	"sport" text,
	"notes" text,
	"target" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "events_priority_check" CHECK ("events"."priority" IN ('A', 'B', 'C'))
);
--> statement-breakpoint
CREATE TABLE "garmin_connections" (
	"user_id" text PRIMARY KEY NOT NULL,
	"tokens_ciphertext" text,
	"status" text DEFAULT 'ok' NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"last_error" text,
	"synced_through" date,
	"backfill_from" date,
	"backfill_through" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "garmin_connections_status_check" CHECK ("garmin_connections"."status" IN ('ok', 'auth_failed', 'error'))
);
--> statement-breakpoint
CREATE TABLE "garmin_raw" (
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "garmin_raw_pk" PRIMARY KEY("user_id","date","kind")
);
--> statement-breakpoint
CREATE TABLE "health_samples" (
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"metric" text NOT NULL,
	"value" double precision NOT NULL,
	"unit" text NOT NULL,
	"source" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "health_samples_pk" PRIMARY KEY("user_id","date","metric")
);
--> statement-breakpoint
CREATE TABLE "lab_results" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lab_results_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"collected_on" date NOT NULL,
	"biomarker" text NOT NULL,
	"category" text,
	"value" numeric,
	"value_text" text,
	"unit" text,
	"ref_low" numeric,
	"ref_high" numeric,
	"optimal_low" numeric,
	"optimal_high" numeric,
	"status" text DEFAULT 'unknown' NOT NULL,
	"source" text DEFAULT 'function' NOT NULL,
	"source_id" text,
	"raw" jsonb,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lab_results_status_check" CHECK ("lab_results"."status" IN ('optimal', 'in_range', 'out_of_range', 'unknown'))
);
--> statement-breakpoint
CREATE INDEX "activity_peaks_metric_idx" ON "activity_peaks" USING btree ("user_id","metric","span");--> statement-breakpoint
CREATE INDEX "events_user_date_idx" ON "events" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "garmin_raw_kind_date_idx" ON "garmin_raw" USING btree ("user_id","kind","date");--> statement-breakpoint
CREATE INDEX "health_samples_metric_date_idx" ON "health_samples" USING btree ("user_id","metric","date");--> statement-breakpoint
CREATE UNIQUE INDEX "lab_results_user_source_biomarker_day_uq" ON "lab_results" USING btree ("user_id","source","biomarker","collected_on");