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
| UI kit | `ios-standards/CraftUI` with the `.lift` theme | Shared, accessible, motion-aware components |
| Location | `coach/lift/` for now | Can be split into its own repo later with `git subtree split` |

## Build order

1. **LiftCore:** models, progression, warm-ups, plate maths, weekly volume and the Notes importer.
2. **Store:** GRDB schema, migrations, repositories with outbox writes, and a demo data set.
3. **App:** the Week, Workout, Exercises and Days screens, plus the rest timer, Live Activity and
   Dynamic Island.
4. **Notes import flow:** paste or share notes, review the parsed sessions, then import.
5. **Sync and the web dashboard.**
