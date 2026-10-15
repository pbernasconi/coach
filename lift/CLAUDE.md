# CLAUDE.md (Lift)

Lift is a native iOS weightlifting logger. It works offline, syncs to Postgres, and replaces Apple Notes
workout logs. Read `../ios-standards/CLAUDE.md` first: its rules, bans and definition of done apply to
every Swift file here. The full reasons are in `../ios-standards/IOS_GUIDELINES.md`.

## Layout

```text
lift/
├── ios/
│   ├── Packages/LiftKit/   LiftCore (pure domain: models, rules, Notes importer); later Store, Sync, Testing
│   └── (app target, widget extension and project.yml arrive with the first screens)
└── README.md               product notes and the Foundations decision log
```

UI comes from `../ios-standards/CraftUI`, themed with `.craftTheme(.lift)`. Lift-specific composites (set
rows, the workout screen) live in the app, never in CraftUI.

## Commands

```bash
(cd ios/Packages/LiftKit && swift test)   # domain tests; runs on Linux and macOS
../ios-standards/scripts/lint-all.sh      # run from ios-standards/ for the full static suite
```

## Product rules

- **Logging comes first.** Logging a set takes one tap. Editing weight or reps and tapping Done saves the
  values only; it never marks the set as logged.
- **No generated commentary.** No AI summaries or "insights" text. Show numbers and plain labels.
- **Rescheduling** uses the lift sheet: move to another day, push to next week, change the workout, or
  remove it. Each action offers Undo instead of a confirmation dialog.
- **Real data stays out of the repo.** Fixtures and tests use made-up sessions, never imported notes.
