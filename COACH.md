# Coach — Personal Training Workflow

This repo doubles as my personal coach. Open it in Claude Code and use the slash commands.

## Quick start

```
/plan              # generate this week's plan (or next week)
/plan --two-weeks  # generate 2 weeks (e.g. build + recovery)
/check-in          # mid-week: log what you did, adjust remaining days
```

Both commands are non-interactive defaults plus 2–3 questions per run.

## Running in the cloud

`/plan` and `/check-in` also work in a Claude Code cloud session (claude.ai/code or a Claude project). One-time setup
in the cloud environment:

- **Environment variables** (copy from `.env.local`): `DATABASE_URL`, `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`.
  Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` too if you want `calendar-sync` to run there.
- **Allowed domains**: `*.neon.tech`, `www.strava.com`, `*.open-meteo.com` (plus `oauth2.googleapis.com` and
  `www.googleapis.com` for `calendar-sync`).

A SessionStart hook installs dependencies. Apple Notes is skipped there, and calendar reads and pushes go through the
Google Calendar connector. Details: "Running in a Claude Code cloud session" in `.claude/commands/plan.md`.

## What `/plan` actually does

1. Refreshes the athlete profile (Strava 90d, fitness state CTL/ATL/TSB, calendar, weather, Apple Notes).
2. Shows a 4-line current-state snapshot.
3. Asks 3 quick questions (how you feel · this week's focus · anything to lock).
4. Drafts a 7-day plan honoring your goals, natural rhythm, weather, and calendar.
5. Confirms with you, then writes `plans/YYYY-MM-DD.{md,json}`.
6. Auto-pushes events to your personal Google Calendar (purple, idempotent re-runs).

## What `/check-in` does

1. Reads the current `plans/YYYY-MM-DD.{md,json}`.
2. Pulls fresh Strava — diffs planned vs actual.
3. Shows updated fitness state.
4. Asks how things felt + whether to adjust.
5. Annotates past days (✅ or ~~skip~~) and modifies future days in place.
6. Syncs calendar if any future events changed.

## Durable preferences

Stored in `~/.claude/projects/-Users-paolo-work-personal-coach/memory/`. The commands honor these automatically — no need to re-state every week:

- **Units**: Celsius, km, min/km
- **Goals**: Road cycling races (Berkeley-style) + 10k/half marathon — moderate variety
- **Strength**: 2 sessions/wk — heavy barbell + dumbbell
- **Calendar**: personal Gmail, purple events
- **Templates**: Apple Notes workouts are authoritative for lift programming

To update any of these: edit the file in the memory directory, or just tell Claude in conversation ("I changed my goal to X").

## Data sources

| Source | What we pull | How |
|---|---|---|
| Strava | Activities + laps + splits + streams + athlete profile (FTP, zones, weight) | OAuth refresh, `scripts/strava-backfill.mjs` |
| Google Calendar | Synced events from 3 accounts; pushed workout events to personal | App OAuth (read) + google-calendar skill creds (write) |
| Apple Notes | Workout templates (via osascript) | `scripts/apple-notes-workouts.mjs` |
| Open-Meteo | 7-day weather forecast for SF | Free, no key |

## File layout

```
.claude/commands/
  plan.md                  # /plan slash command instructions
  check-in.md              # /check-in slash command instructions
scripts/
  coach-profile.mjs        # athlete profile aggregator
  add-workouts-to-calendar.mjs  # push events to calendar (idempotent)
  strava-backfill.mjs      # backfill Strava data
  apple-notes-workouts.mjs # pull Apple Notes workouts
  README.md                # detailed script docs
plans/
  YYYY-MM-DD.md            # one per Monday — human-readable plan
  YYYY-MM-DD.json          # one per Monday — structured events
src/modules/
  weather/                 # Open-Meteo client (used by app + scripts)
  fitness/                 # CTL/ATL/TSB compute (used by app)
  garmin/README.md         # design doc (blocked on Garmin API approval)
```

## Future extensions

- **Garmin Connect**: see `src/modules/garmin/README.md`. Adds HRV / Body Battery / sleep score. ~2 wk dev API approval.
- **Streams analysis**: data is in the DB but no analyzer yet (cardiac drift, time-in-zone, interval execution).
- **Goal-driven peaking**: when a race date is set in `user_goals`, /plan should auto-build periodized blocks (base → build → peak → taper).
