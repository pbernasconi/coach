# Coach — Personal Training Workflow

The routes and data sources are in COACH-API.md; the Lift sync contract is lift/SYNC.md.

This repo doubles as my personal coach. Open it in Claude Code and use the slash commands.

## Quick start

```
/plan              # generate this week's plan (or next week)
/plan --two-weeks  # generate 2 weeks (e.g. build + recovery)
/check-in          # mid-week: log what you did, adjust remaining days
```

Both commands are non-interactive defaults plus 2–3 questions per run.

## What `/plan` actually does

1. Refreshes the athlete profile (Strava 90d, fitness state CTL/ATL/TSB, calendar, weather, Lift templates).
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
- **Goals**: milestones with a target and a deadline, in Coach → Settings → Goals (10k at 4:00/km, 3 × 4000 m ski peaks, VO2 max 52, 6,000 km of riding in 2027). Performance shows the progress.
- **Strength**: 2 sessions/wk — heavy barbell + dumbbell
- **Calendar**: personal Gmail, purple events
- **Templates**: the Lift app's templates (Heavy barbell, Upper (dumbbells), Hotel gym (dumbbells)) are authoritative for
  lift programming. `scripts/lift-plan.mjs` plans each strength workout as a Lift session, so every rep and load is logged

To update any of these: edit the file in the memory directory, or just tell Claude in conversation ("I changed my goal to X").

## Data sources

| Source | What we pull | How |
|---|---|---|
| Strava | Activities + laps + splits + streams + athlete profile (FTP, zones, weight) | OAuth refresh, `scripts/strava-backfill.mjs` |
| Google Calendar | Synced events from 3 accounts; pushed workout events to personal | App OAuth (read) + google-calendar skill creds (write) |
| Lift (iPhone) | Workouts and templates, synced to the database | Lift sync (`lift/SYNC.md`) |
| Open-Meteo | 7-day weather forecast for SF | Free, no key |

## File layout

```
.claude/commands/
  plan.md                  # /plan slash command instructions
  check-in.md              # /check-in slash command instructions
scripts/
  coach-profile.mjs        # athlete profile aggregator
  add-workouts-to-calendar.mjs  # push events to calendar (idempotent)
  lift-plan.mjs                 # strength workouts → planned Lift sessions (sets, targets), linked by id
  strava-backfill.mjs      # backfill Strava data
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
- **Goal-driven blocks**: /plan could build periodized blocks (base → build → test) toward each milestone deadline.
