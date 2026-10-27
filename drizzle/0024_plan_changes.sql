CREATE TABLE "plan_changes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"workout_id" text NOT NULL,
	"plan_id" text,
	"title" text,
	"op" text NOT NULL,
	"source" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_changes_op_check" CHECK ("plan_changes"."op" IN ('insert', 'update', 'delete'))
);
--> statement-breakpoint
ALTER TABLE "training_plan_activities" ADD COLUMN "change_source" text;--> statement-breakpoint
CREATE INDEX "plan_changes_workout_idx" ON "plan_changes" USING btree ("workout_id","at");--> statement-breakpoint
CREATE INDEX "plan_changes_at_idx" ON "plan_changes" USING btree ("at");--> statement-breakpoint
-- Hand-written below: drizzle-kit does not model triggers. Every insert, update and delete of a planned workout
-- writes a plan_changes row. The source is the row's change_source (then cleared, so it never sticks to the next
-- write), else the transaction's coach.change_source setting (a delete has no new row), else 'unknown'. An update
-- that changes only timestamps logs nothing.
CREATE OR REPLACE FUNCTION log_plan_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  quiet text[] := ARRAY['created_at', 'updated_at', 'edited_at', 'change_source'];
  src text;
  old_j jsonb;
  new_j jsonb;
  before_j jsonb := '{}'::jsonb;
  after_j jsonb := '{}'::jsonb;
  k text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    src := coalesce(nullif(current_setting('coach.change_source', true), ''), 'unknown');
    INSERT INTO plan_changes (workout_id, plan_id, title, op, source, before, after)
    VALUES (OLD.id, OLD.plan_id, OLD.title, 'delete', src, to_jsonb(OLD) - quiet, NULL);
    RETURN OLD;
  END IF;
  src := coalesce(NEW.change_source, nullif(current_setting('coach.change_source', true), ''), 'unknown');
  NEW.change_source := NULL;
  new_j := to_jsonb(NEW) - quiet;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO plan_changes (workout_id, plan_id, title, op, source, before, after)
    VALUES (NEW.id, NEW.plan_id, NEW.title, 'insert', src, NULL, new_j);
    RETURN NEW;
  END IF;
  old_j := to_jsonb(OLD) - quiet;
  FOR k IN SELECT jsonb_object_keys(new_j) LOOP
    IF (new_j -> k) IS DISTINCT FROM (old_j -> k) THEN
      before_j := before_j || jsonb_build_object(k, old_j -> k);
      after_j := after_j || jsonb_build_object(k, new_j -> k);
    END IF;
  END LOOP;
  IF after_j <> '{}'::jsonb THEN
    INSERT INTO plan_changes (workout_id, plan_id, title, op, source, before, after)
    VALUES (NEW.id, NEW.plan_id, NEW.title, 'update', src, before_j, after_j);
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER training_plan_activities_log_change
BEFORE INSERT OR UPDATE OR DELETE ON training_plan_activities
FOR EACH ROW EXECUTE FUNCTION log_plan_change();
