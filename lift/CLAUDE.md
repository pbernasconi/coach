# CLAUDE.md (Lift)

Lift is a native iOS weightlifting logger. It works offline, syncs to Postgres, and replaces Apple Notes
workout logs. Read `../ios-standards/CLAUDE.md` first: its rules, bans and definition of done apply to
every Swift file here. The full reasons are in `../ios-standards/IOS_GUIDELINES.md`.

## Layout

```text
lift/
├── ios/
│   ├── project.yml         XcodeGen spec (app Lift, tests LiftTests, scheme Lift); the .xcodeproj is gitignored
│   ├── scripts/generate.sh runs xcodegen
│   ├── Lift/               app target
│   │   ├── App/            @main, CompositionRoot (the only Date()/UUID()/database opening), AppDependencies,
│   │   │                   LaunchOptions (-demo, -tab, -appearance), RootView (Kobo TabShell)
│   │   ├── Design/         LiftTheme: Theme.lift / Palette.lift (amber); the only place with hex colours
│   │   ├── Features/<Feature>/<Screen>/   the eight-file screen set: Week, History, Exercises, Settings
│   │   ├── Features/Sessions/             SessionSummary, DayCalendar, SessionText (shared by Week and History)
│   │   └── Resources/      Localizable.xcstrings
│   ├── LiftTests/          Swift Testing ViewModel tests, hand-written fakes in Fakes/
│   └── Packages/LiftKit/   one package (LAY-2):
│         LiftCore      pure domain: models, rules, Notes importer, LocalDay arithmetic
│         LiftStore     GRDB schema + migrations, repository protocols and Live* implementations,
│                       outbox writes, DemoSeeder (fabricated demo data)
│         LiftTesting   IDSequence, ManualNow, TestStore (in-memory DB), fakes, fixtures
│         (Sync, the widget extension and HealthKit arrive later)
└── README.md               product notes and the Foundations decision log
```

UI comes from `../ios-standards/Kobo`, themed with `.koboTheme(.lift)`. Lift-specific composites (set
rows, the workout screen) live in the app, never in Kobo.

## Commands

```bash
(cd ios/Packages/LiftKit && swift test)   # domain tests; runs on Linux and macOS
ios/scripts/generate.sh                   # project.yml → Lift.xcodeproj (macOS, needs xcodegen)
xcodebuild test -project ios/Lift.xcodeproj -scheme Lift \
  -destination 'platform=iOS Simulator,name=<any iPhone>'   # app + ViewModel tests
../ios-standards/scripts/lint-all.sh      # run from ios-standards/ for the full static suite
```

Launch arguments (scheme or `simctl launch`): `-demo` opens an in-memory database seeded by `DemoSeeder`
(fabricated data, nothing saved); `-tab week|history|exercises|settings` picks the first tab; `-appearance
dark|light` forces an appearance. Without `-demo` the app uses `Application Support/lift.sqlite`.

Note: the app target defaults to MainActor isolation, so screen value types (`State`, `Action`, row items)
are declared `nonisolated`; otherwise their `Equatable` conformance is main-actor-isolated and cannot be
used inside `Loadable`.

## Product rules

- **Logging comes first.** Logging a set takes one tap. Editing weight or reps and tapping Done saves the
  values only; it never marks the set as logged.
- **No generated commentary.** No AI summaries or "insights" text. Show numbers and plain labels.
- **Rescheduling** uses the lift sheet: move to another day, push to next week, change the workout, or
  remove it. Each action offers Undo instead of a confirmation dialog.
- **Real data stays out of the repo.** Fixtures and tests use made-up sessions, never imported notes.
