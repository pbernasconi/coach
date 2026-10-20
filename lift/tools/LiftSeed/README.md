# LiftSeed

Seeds Lift templates on Coach's sync server from a JSON file, with Lift's own repositories (every row gets an
outbox entry) and sync engine. The iPhone pulls them on its next sync. It pulls first and skips a template whose
name the server already has, so a second run adds nothing.

```bash
swift run LiftSeed --templates templates.json --db /tmp/lift-seed.sqlite                 # dry run
LIFT_SYNC_TOKEN=… swift run LiftSeed --templates templates.json --db /tmp/lift-seed.sqlite \
    --push --server https://coach.paolobernasconi.com
```

`templates.json` is a list of `{ "name", "exercises": [{ "name", "sets", "reps": [lo, hi],
"weight": { "value", "unit" } | null, "rest": seconds | null, "note": text | null }] }`. Exercise names are matched
to the library with LiftCore's `ExerciseMatcher`; a name with no match becomes a new library exercise.

History, 2026-10-19: the two Apple Notes templates ("Workout lift – April 28" and "Hotel Gym Lift – 45 min") were
seeded as "Heavy barbell" and "Hotel gym (dumbbells)". After that, Apple Notes is an archive and nothing reads it.
The old logged workouts in Notes were not imported: LiftCore's Notes importer read only 23 of them, and only partly
(the notes are free-form, not Lift's checklist format), so importing them would have put wrong data in Lift.
