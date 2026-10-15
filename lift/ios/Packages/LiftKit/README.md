# LiftKit

The local Swift package for Lift (`IOS_GUIDELINES.md` LAY-2). `LiftCore` is the pure domain core. It uses
Foundation only, with no SwiftUI, no I/O and no logging, so it builds and tests on macOS, iOS and Linux.
`LiftStore` is the GRDB persistence layer (see below) and `LiftTesting` holds test helpers and fakes.

## What's in LiftCore

| Folder | Contents |
| --- | --- |
| `Model/` | `Weight`/`WeightUnit` (conversion, rounding to a step), `Equipment` (default increments), `LoadMode`, `Muscle`, `Exercise` + `ExerciseLibrary.seed` (30 lifts with fixed ids `4C494654-…-0000000000NN`), `SetKind`, `SetTarget`, `SetActual`, `LoggedSet`, `SessionExercise`, `Session`, `LocalDay`, `DayTemplate`, `TemplateExercise`, `AppError`, `Loadable` |
| `Rules/` | `OneRepMax` (Epley and Brzycki), `PlateMath` + `PlateSet`/`PlateLoad`, `WarmUpPlanner`, `Progression` → `ProgressionSuggestion`, `WeeklyVolume` → `MuscleVolume`, `WeekPlan` → `WeekProgress` |
| `Import/` | `NotesImporter.parse(_:reference:calendar:library:makeID:)` for pasted Apple Notes text, and `ExerciseMatcher` |

Rows that get persisted (`Session`, `Exercise`, `DayTemplate`) carry `createdAt`, `updatedAt` and
`deletedAt` (DATA-2). Each logged set stores both target and actual, and each session exercise stores its
load mode and each session its unit (DATA-6, DATA-7). Nothing reads the clock or makes ids on its own:
`reference` and `makeID` are passed in.

### The Notes importer

The importer never throws and never drops a line without a trace. Every line ends up as data, as part of a
session or exercise note, or as an `ImportIssue` with its line number. A session starts at a title line
that ends in a date (`Workout C- sept 29`). When the title has no year, the importer picks the latest such
date on or before `reference`. Dash lines separate blocks inside a session and never start a new one.
Unchecked `- [ ]` sets get `actual = nil`: in a session before the reference day they count as skipped,
and in today's session they count as planned. A plain set line with no checkbox counts as done.
`ExerciseMatcher` only accepts exact matches after normalization: the name, an alias, or the same words in
another order. Anything weaker returns nil. The importer always keeps `displayName`.

## What's in LiftStore

GRDB 7 (pinned exactly) on SQLite. `LiftDatabase.onDisk(at:)` / `.inMemory()` open and migrate.

- **Schema** (`Database/`): `LiftMigrations` lists every migration; `SchemaV1` creates `exercise`, `session`
  (`day` is "YYYY-MM-DD" text), `sessionExercise`, `workoutSet` and `outbox`. Every synced row has a UUID
  `id`, `createdAt`, `updatedAt` and a `deletedAt` tombstone. Sets keep target and actual, with `unit`,
  `loadMode` and `status` (planned | done | skipped) on the row.
- **Repositories** (`Repositories/` protocols, `Live/` GRDB implementations): `ExerciseRepository`,
  `SessionRepository` (including move / push a week / remove with `undo`), `SetRepository`, `OutboxRepository`.
  Reads are `AsyncStream`s over `ValueObservation`; every write is one transaction that changes one row and
  appends one outbox entry with the full row as JSON and an idempotency key. `now` and `makeID` are injected.
- **Product rule:** `SetRepository.saveValues` (Done in the editor) never changes `status`; `log` is its own
  write.
- **Demo:** `DemoSeeder` writes a made-up block (Lower A / Upper A) through the same repositories.

## Test

```bash
swift build
swift test        # Swift Testing, table-driven; fixed Gregorian/UTC/en_US_POSIX calendar
```

All test fixtures are made up (TEST-8). Lint from `ios-standards/` with `scripts/ios-guard.sh`,
`swift format lint --strict` and SwiftLint `--strict`, using the configs in `templates/config/`.
