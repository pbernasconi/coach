# LiftSeed

Writes to Lift from the Mac with Lift's own repositories (every row gets an outbox entry), planner and sync engine. The
iPhone gets the rows on its next sync. Each run starts from a full pull into `--db`, so use a new file every time.

```bash
swift run LiftSeed --db /tmp/lift-1.sqlite --server https://coach.paolobernasconi.com --templates t.json [--replace]
swift run LiftSeed --db /tmp/lift-2.sqlite --server https://… --plan plan.json --out planned.json --push
```

Without `--push` it is a dry run: it pulls and prints, and pushes nothing. The token is in `LIFT_SYNC_TOKEN`.

- `--templates`: a list of `{ "name", "exercises": [{ "name", "sets", "reps": [lo, hi], "weight": { "value", "unit" } |
  null, "rest": seconds | null, "note": text | null, "equipment"?, "load"?: "hand" | "side" | "bw" }] }`. Names match
  the library with LiftCore's `ExerciseMatcher`; a name with no match becomes a new library exercise. A template whose
  name is already in Lift is skipped, or with `--replace` gets these slots in place of its own (same template id).
- `--plan`: a list of `{ "key", "day", "template", "sessionId"?, "remove"? }`. With no live session it plans one from
  the template (`LiveWorkoutPlanRepository.createSession`: targets from the template and the logged history). A session
  that was started or has a logged set is never changed; any other moves to `day` and gets its sets planned again
  (`changeTemplate`), or is removed. `--out` writes each session with its exercises, set targets and logged values.

`scripts/lift-plan.mjs` (repository root) runs `--plan` for the strength workouts of the Coach plan.

The real templates live in Lift and the database, never in this repository. History, 2026-10-19: the Apple Notes
templates were seeded as "Heavy barbell" and "Hotel gym (dumbbells)". 2026-10-20: "Heavy barbell" was replaced with
the program logged in Aug–Sep 2026, and "Upper (dumbbells)" was added from the "Workout C" notes.
