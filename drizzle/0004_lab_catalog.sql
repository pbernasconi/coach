CREATE TABLE "lab_biomarkers" (
	"user_id" text NOT NULL,
	"source" text DEFAULT 'function' NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"result_names" text[] NOT NULL,
	"categories" text[] NOT NULL,
	"description" text,
	"units" text,
	"status" text NOT NULL,
	"out_of_range_type" text,
	"kind" text,
	"range_text" text,
	"range_min" numeric,
	"range_max" numeric,
	"range_min_op" text,
	"range_max_op" text,
	"optimal_range" text,
	"optimal_low" numeric,
	"optimal_high" numeric,
	"current_display" text,
	"current_on" date,
	"content" jsonb,
	"raw" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lab_biomarkers_pk" PRIMARY KEY("user_id","source","key"),
	CONSTRAINT "lab_biomarkers_status_check" CHECK ("lab_biomarkers"."status" IN ('in_range', 'out_of_range', 'other'))
);
--> statement-breakpoint
CREATE TABLE "lab_categories" (
	"user_id" text NOT NULL,
	"source" text DEFAULT 'function' NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"position" integer NOT NULL,
	"biomarker_keys" text[] NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lab_categories_pk" PRIMARY KEY("user_id","source","key")
);
--> statement-breakpoint
CREATE TABLE "lab_planned_draws" (
	"user_id" text NOT NULL,
	"source" text DEFAULT 'function' NOT NULL,
	"key" text NOT NULL,
	"type" text,
	"recommended_on" date,
	"window_start" date,
	"window_end" date,
	"visit_on" date,
	"scheduled" boolean DEFAULT false NOT NULL,
	"raw" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lab_planned_draws_pk" PRIMARY KEY("user_id","source","key")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "lab_biomarkers_user_slug_uq" ON "lab_biomarkers" USING btree ("user_id","source","slug");