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
│   │   │                   LaunchOptions (-demo, -fresh, -tab, -appearance, -open), RootView (Kobo TabShell)
│   │   │                   Sync/: Syncing (LiveSync over SyncEngine + Keychain, DisabledSync for demo or no
│   │   │                   server), SyncCoordinator (launch, foreground, outbox growth), SyncServer (LiftSyncBaseURL)
│   │   │                   Health/: Apple Health (HealthRecorder over HealthWorkoutStore; LiveHealthWorkoutStore
│   │   │                   saves with HKWorkoutBuilder; DisabledHealthRecorder for demo and -fresh), HealthSettings
│   │   ├── Design/         LiftTheme: Theme.lift / Palette.lift (amber); the only place with hex colours
│   │   ├── Features/<Feature>/<Screen>/   the eight-file screen set: Week, History, Exercises, Settings, Workout
│   │   │                                  (with its finish summary), Catalog (browse the bundled exercise
│   │   │                                  catalog, catalog detail), Templates (the list, the template editor and
│   │                                  the lift://templates review sheet, TEMPLATE-LINKS.md)
│   │   │                                  and the exercise picker (library or catalog, for templates and sessions)
│   │   ├── Features/ExerciseMedia/        catalog media: URLs at the pinned dataset commit, the cached loader,
│   │   │                                  GIF and thumbnail views
│   │   ├── Features/Sessions/             SessionSummary, DayCalendar, SessionText (shared by Week and History)
│   │   └── Resources/      Localizable.xcstrings
│   ├── LiftWidgets/        widget extension: the workout Live Activity (Lock Screen, Dynamic Island) from the first
│   │                       logged set until the workout is finished; it also compiles WorkoutActivityAttributes and
│   │                       RestSnapshot (Lift/Features/Workout/LiveActivity/) and the Done/Next/+30s/Skip
│   │                       LiveActivityIntents (Lift/App/WorkoutActivityIntents.swift). The intents run in the app's
│   │                       process and reach WorkoutActivityCenter through WorkoutActivityButtons (set in LiftApp.init)
│   ├── LiftShare/          Share extension: a note shared from Apple Notes goes to the App Group inbox, then
│   │                       Lift's Import (lift://import, IncomingNoteRouter; the app also checks on foreground)
│   ├── LiftTests/          Swift Testing ViewModel tests, hand-written fakes in Fakes/
│   └── Packages/LiftKit/   one package (LAY-2):
│         LiftCore      pure domain: models, rules, Notes importer, LocalDay arithmetic, the bundled exercise
│                       catalog (Resources/exercise-catalog.json, built by scripts/import-exercise-dataset.py)
│         LiftStore     GRDB schema + migrations, repository protocols and Live* implementations,
│                       outbox writes, DemoSeeder (fabricated demo data)
│         LiftTesting   IDSequence, ManualNow, TestStore (in-memory DB), fakes, fixtures
│         LiftSync      SyncEngine (push outbox, pull with LWW), URLSessionSyncTransport, wire types
│                       (SYNC.md), KeychainTokenStore; the pull applier and syncState live in LiftStore/Sync
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
(fabricated data, nothing saved); `-fresh` opens an empty in-memory database as a first launch leaves it (the exercise
library only; it wins over `-demo`, never syncs and never touches Apple Health), for the empty states;
`-tab week|history|exercises|settings` picks the first tab; `-appearance dark|light` forces an appearance; with
`-demo`, `-open workout` pushes today's or the next planned session onto the Week tab, `-open exercise` pushes the Back squat detail onto the Exercises tab, `-open templates` and
`-open template` push the templates list and the first template's editor onto the Exercises tab, `-open summary`
pushes the latest logged session's summary onto the Week tab, `-open template-link` opens the template link review over
Exercises with a made-up link, `-open progress` opens History on its Progress view
(hard sets per muscle and per week), `-open plates` pushes Plates and bars onto the Settings tab, and `-open import` opens Import from Notes over
History with a made-up note already read to the review step (for screenshots). Without `-demo` the app uses `Application Support/lift.sqlite`.

Note: the app target defaults to MainActor isolation, so screen value types (`State`, `Action`, row items)
are declared `nonisolated`; otherwise their `Equatable` conformance is main-actor-isolated and cannot be
used inside `Loadable`.

## Product rules

- **Logging comes first.** Logging a set takes one tap. Editing weight or reps and tapping Done saves the
  values only; it never marks the set as logged.
- **Apple Health.** A finished workout is saved to Health as traditional strength training from its start to its
  finish, with its title; no energy (Lift cannot estimate it honestly). The first summary asks before the system sheet
  does, never at launch; Settings has the switch. `session.healthWorkoutID` (schema v5) keeps it saved once, and a
  discard deletes the workout Lift saved. Demo and `-fresh` data never touch Health.
- **No generated commentary.** No AI summaries or "insights" text. Show numbers and plain labels.
- **Rescheduling** uses the lift sheet: move to another day, push to next week, change the workout, or
  remove it. Each action offers Undo instead of a confirmation dialog.
- **Real data stays out of the repo.** Fixtures and tests use made-up sessions, never imported notes. A person's own
  templates reach their iPhone through a template link (`TEMPLATE-LINKS.md`, `scripts/make-template-link.py`), never
  through a commit.
- **Weeks start on Monday** everywhere, whatever the locale: `CompositionRoot` sets it once on the app's `Calendar`
  (`Calendar.startingWeeksOnMonday()`), and every screen, Kobo's strip and calendar, and the LiftKit week maths use that
  calendar.
- **Catalog media is never bundled.** The dataset's text is MIT; its images and GIFs are © Gym visual. They load at
  runtime from the pinned commit. Lift is a personal app, so screens show no credit; keep it that way only while it
  stays personal (no public App Store release). See `ios/ExerciseMedia/ATTRIBUTION.md`.
