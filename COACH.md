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

## In the cloud (no Mac needed)

Coach plans in a GitHub job (`.github/workflows/plan.yml`) with Claude Code, by the same rules as `/plan`
(`scripts/plan-cloud/PROMPT.md` points the agent at `.claude/commands/plan.md`):

- **Every Sunday at 08:00 PDT** it plans next week from the data alone.
- **Any time**, Plan page → **Plan with Coach**: pick next week or the rest of this week (a check-in), and say how you
  feel, the focus and what to lock. The job starts at once and takes a few minutes.

The plan comes back as a proposal on the Plan page: **Review** shows the week and the coach's summary. **Accept**
writes it into Coach (the same import as `/plan`; workouts you changed on the web stay) and onto Google Calendar,
then `plan-apply.yml` plans the Lift sessions and puts the runs on Garmin. **Reject** changes nothing. Nothing reaches
your calendar before Accept: the profile holds calendar text from other people, and the review is the gate.

The agent gets no database URL and no Coach secret; it can only read the repository and write `plans/`. The steps
before and after it build the profile and send the plan (`scripts/plan-cloud/client.mjs`, `POST /api/plan/proposals`).

Setup (once): GitHub secret `CLAUDE_CODE_OAUTH_TOKEN` (`claude setup-token`) or `ANTHROPIC_API_KEY`, and
`LIFT_SYNC_TOKEN`; Vercel `GITHUB_DISPATCH_TOKEN` (a fine-grained token for this repository, Actions: read and write).

The local `/plan` and `/check-in` below still work, for a conversation about the week.

## What `/plan` actually does

1. Refreshes the athlete profile (Strava 90d, fitness state CTL/ATL/TSB, calendar, weather, Lift templates).
2. Shows a 4-line current-state snapshot.
3. Asks 3 quick questions (how you feel · this week's focus · anything to lock).
4. Drafts a 7-day plan honoring your goals, natural rhythm, weather, and calendar.
5. Confirms with you, then writes `plans/YYYY-MM-DD.{md,json}`.
6. Auto-pushes events to your personal Google Calendar (purple, idempotent re-runs). Each event links to its
   workout in Coach (`/plan?week=…&open=w-<id>`).

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
- **Calendar**: personal Gmail, purple events, each with an "Open in Coach" link to the workout. Moving an event on
  the calendar moves the workout in Coach (within the hour)
- **Templates**: the Lift app's templates (Heavy barbell, Upper (dumbbells), Hotel gym (dumbbells)) are authoritative for
  lift programming. `scripts/lift-plan.mjs` plans each strength workout as a Lift session, so every rep and load is logged

To update any of these: edit the file in the memory directory, or just tell Claude in conversation ("I changed my goal to X").

## Data sources

| Source | What we pull | How |
|---|---|---|
| Strava | Activities + laps + splits + streams + athlete profile (FTP, zones, weight) | OAuth refresh, `scripts/strava-backfill.mjs` |
| Google Calendar | Synced events from 3 accounts; pushed workout events to personal | App OAuth (read) + google-calendar skill creds (write) |
| Lift (iPhone) | Workouts and templates, synced to the database | Lift sync (`lift/SYNC.md`) |
| Garmin Connect | HRV, sleep, resting HR, Body Battery, readiness, lactate threshold | `garmin.yml` (GitHub Actions) |
| Function Health | Lab results and the clinician's notes | `function.yml`, by hand |
| Weather | NWS for US places, Open-Meteo elsewhere | Free, no key |

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
src/lib/
  plan/weather.ts, plan/forecast.mjs   # NWS and Open-Meteo forecasts (app + scripts)
  strava-sync/tss.mjs, load.mjs        # TSS and CTL/ATL/TSB
```

## Future extensions

- **Streams analysis**: TSS uses the streams (`src/lib/strava-sync/tss.mjs`), but there is no analyser yet for
  cardiac drift, decoupling or interval execution.
- **Goal-driven blocks**: /plan could build periodized blocks (base → build → test) toward each milestone deadline.
