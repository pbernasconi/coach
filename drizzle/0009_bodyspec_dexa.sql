CREATE TABLE "bodyspec_connections" (
	"user_id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"scope" text,
	"status" text DEFAULT 'ok' NOT NULL,
	"connected_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dexa_scans" (
	"result_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"scanned_at" timestamp with time zone NOT NULL,
	"scan_date" date NOT NULL,
	"location" text,
	"scanner" text,
	"age_years" double precision,
	"height_cm" double precision,
	"total_mass_kg" double precision,
	"fat_mass_kg" double precision,
	"lean_mass_kg" double precision,
	"bone_mass_kg" double precision,
	"body_fat_pct" double precision,
	"vat_mass_kg" double precision,
	"vat_volume_cm3" double precision,
	"android_gynoid_ratio" double precision,
	"bone_density" double precision,
	"rmr_kcal" double precision,
	"regions" jsonb,
	"bone_regions" jsonb,
	"percentiles" jsonb,
	"raw" jsonb,
	"result_updated_at" text,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "dexa_scans_user_date_idx" ON "dexa_scans" USING btree ("user_id","scan_date");