CREATE TABLE "chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"context_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_message_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "strava_activities" DROP CONSTRAINT "strava_activities_user_activity_unique";--> statement-breakpoint
ALTER TABLE "strava_activities" ALTER COLUMN "strava_activity_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "strava_activities" ALTER COLUMN "strava_activity_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "strava_activities" ALTER COLUMN "distance" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "strava_activities" ALTER COLUMN "total_elevation_gain" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "strava_activities" ALTER COLUMN "average_speed" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "strava_activities" ALTER COLUMN "max_speed" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "strava_activities" ALTER COLUMN "average_cadence" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "strava_activities" ALTER COLUMN "average_watts" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "strava_activities" ALTER COLUMN "average_heartrate" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "strava_activities" ALTER COLUMN "kilojoules" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;