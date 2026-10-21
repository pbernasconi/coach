# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rules

- **Schema changes** go through migrations: read DATABASE.md before you edit `src/db/*schema*.ts` or touch a
  database.
- **UI components** come from `@kobo/web` (`web-standards/kobo-web`, an npm workspace) when it has one. A new
  reusable component goes there first, under its CONVENTIONS.md. `npm run check -w @kobo/web` runs its checks.
- **Pages, loaders and database times** follow RELIABILITY.md: the deploy check renders every page and rolls
  back a deploy that breaks one.

## What Coach is

A personal training app for one athlete (the owner is the first row in `users`; RELIABILITY.md has the rules for
pages and loaders). It plans endurance and strength training and shows what was done. Live at
https://coach.paolobernasconi.com (Vercel Hobby, Neon Postgres with hard monthly quotas, Clerk sign-in).

- **Pages** (`src/app/(dashboard)/`): Performance (`/`), Plan (`/plan`, the month calendar), Lift, Goals, Health
  (vitals, labs), Settings, and an activity page (`/activities/[id]`).
- **Data in**: Strava (webhook and `sync.yml`), Garmin (`garmin.yml`, a Python job), the Lift iPhone app
  (`lift/`, its own sync), Google Calendar, Function Health (`function.yml`, by hand), BodySpec DEXA scans (OAuth from Settings, daily in `sync.yml`). COACH-API.md has every
  route and source.
- **Planning**: the `/plan` and `/check-in` commands in `.claude/commands/` (COACH.md).

## Code map

| Where | What |
| --- | --- |
| `src/lib/strava-sync/` | Strava sync, TSS (`tss.mjs`), thresholds, training load (CTL/ATL/TSB, `load.mjs`), OAuth |
| `src/lib/activity/` | The activity page: on-demand fetch, stream maths (zones, GAP, best efforts) |
| `src/lib/performance/` | Peak powers and run times, PMC, projection, events |
| `src/lib/plan/`, `src/lib/workouts/` | The plan calendar and the structured workout bank (.zwo, Garmin) |
| `src/lib/vitals/` | Garmin and Function Health data, readiness |
| `src/lib/lift-sync/`, `src/lib/lift-dashboard/` | Lift's sync protocol and the web Lift pages |
| `src/db/` | Drizzle schemas (DATABASE.md) |
| `scripts/` | CLI jobs and the integration tests (`scripts/README.md`) |

Pure logic is in `.mjs` files with a `*.test.mjs` next to them (`npm test`, no database). The core maths files
(`tss.mjs`, `load.mjs`, `stats.mjs`) are type-checked with `// @ts-check`. Code that needs Postgres is tested in
`scripts/integration/` on a local Postgres (`npm run test:integration` with `DATABASE_DRIVER=pg`).

## Commands

```bash
npm run dev          # never against production: .env.local points at it (DATABASE.md)
npm test             # unit tests
npm run typecheck
npm run lint
npm run test:integration   # DATABASE_URL=<local Postgres> DATABASE_DRIVER=pg
```

`.tsx` files use PascalCase names (`MonthCalendar.tsx`).
