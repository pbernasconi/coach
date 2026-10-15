CREATE SEQUENCE "public"."lift_rows_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "lift_applied_changes" (
	"idempotency_key" uuid PRIMARY KEY NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lift_rows" (
	"entity" text NOT NULL,
	"id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"seq" bigint DEFAULT nextval('lift_rows_seq') NOT NULL,
	CONSTRAINT "lift_rows_entity_id_pk" PRIMARY KEY("entity","id")
);
--> statement-breakpoint
CREATE INDEX "lift_rows_seq_idx" ON "lift_rows" USING btree ("seq");