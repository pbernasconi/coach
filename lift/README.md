# Lift

A gym logger for about two strength sessions a week alongside endurance training. It works offline on the
iPhone and syncs to Postgres (Neon), with a web view of the history.

## Foundations

Each decision and why it was made. Change a decision here before changing the code.

| Decision | Choice | Why |
| --- | --- | --- |
| Platform | iOS 26, SwiftUI, Liquid Glass | It runs on one phone, so it can use the newest system controls |
| Language | Swift 6, strict concurrency, MainActor by default, warnings as errors | Concurrency mistakes fail the build instead of failing at the gym |
| Project | XcodeGen `project.yml`; the `.xcodeproj` is never committed | Agents can edit YAML safely |
| Local data | GRDB on SQLite, observed as `AsyncStream` | Offline-first, explicit migrations, testable on Linux |
| Sync | Outbox table, idempotent push, cursor pull, last writer wins | Logging never waits for the network |
| IDs | Client-made UUIDs, with `createdAt` / `updatedAt` / `deletedAt` | Rows can be created offline and merged later |
| UI kit | `ios-standards/Kobo` with the `.lift` theme | Shared, accessible, motion-aware components |
| Apple Health | Write-only: each finished workout as strength training via `HKWorkoutBuilder`, its id on the session | Health shows the training next to everything else; no energy, because Lift cannot estimate it honestly |
| Location | `coach/lift/` for now | Can be split into its own repo later with `git subtree split` |

## Logging

- **One tap logs a set.** The check logs it at its target or saved values and starts the rest timer. Nothing else is
  needed to log.
- **Values, effort and notes are optional.** Tapping a set's weight or reps opens the set editor: weight, reps, an RPE
  (6 to 10 in half steps; tap the chosen value again to clear it) and a note. Done saves them and never logs the set.
- **Notes.** "Add note" under the header writes a note for the whole session; "Add note" or "Edit note" in an
  exercise's "…" writes one for that exercise. Notes from an Apple Notes import show and edit in the same places.
- **Where RPE shows.** Under the set's row in the workout ("RPE 8 · paused", also when a past session opens from
  History) and beside the best set in an exercise's history. The progression rules do not use it.

## Build order

1. **LiftCore:** models, progression, warm-ups, plate maths, weekly volume and the Notes importer. Done.
2. **Store:** GRDB schema, migrations, repositories with outbox writes, and a demo data set. Done.
3. **App:** done. The tab shell (Week, History, Exercises, Settings), the Workout screen with notes and RPE, the rest
   timer with its Live Activity and Dynamic Island (the widget extension), templates and the exercise catalog, and
   Apple Health.
4. **Notes import flow:** paste or share notes, review the parsed sessions, then import. Done.
5. **Sync and the web dashboard:** done (`SYNC.md`); sync is live since 2026-10-19.

What remains:

- The items in `DEFERRED.md` that need the owner: the App Group (sharing from Apple Notes), the checks on a real
  iPhone, and a Gym visual licence before any public release.
- Multi-week programs (periodisation): planning is one day template at a time.
- The web Lift pages do not show a set's RPE yet; the rows already carry it.
