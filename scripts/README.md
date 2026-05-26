# Scripts — Coach Personal Workflow

All scripts use `/opt/homebrew/bin/node --env-file=.env.local` (env vars come from `.env.local`).

## Active (used by /plan and /check-in)

| Script | Purpose | Used by |
|---|---|---|
| `coach-profile.mjs` | Aggregate athlete profile: physiology + fitness state (from `daily_training_load`) + 90d sport stats + 365d rhythm + 14d log + this week's calendar + weather + Apple Notes. Auto-runs `calendar-sync.mjs` and `strava-backfill.mjs` first (pass `--no-sync` to skip). Writes `profile.md` + `profile.json`. | `/plan`, `/check-in` |
| `add-workouts-to-calendar.mjs` | Push training events to personal Gmail calendar (purple, idempotent via `extendedProperties.private.coachPlanDate` tag). Takes `--plan plans/YYYY-MM-DD.json`. | `/plan`, `/check-in` |
| `apple-notes-workouts.mjs` | Pull workout-shaped notes from Apple Notes via osascript. JSON to stdout. | `coach-profile.mjs` |
| `strava-backfill.mjs` | Incremental sync by default (uses `last_synced_at`). Pulls list, optionally `--detailed` (description, laps, splits, suffer_score) and `--streams` (HR/watts/etc.). Computes & persists `tss`, `tss_method`, `zone_times` per activity, then rebuilds `daily_training_load` (CTL/ATL/TSB). `--days N` or `--force` for explicit windows. | `coach-profile.mjs` auto, manual |
| `calendar-sync.mjs` | Pull events from all active calendar connections into `calendar_events`. Refreshes OAuth on each run. Marks deleted events as cancelled. `--days-back 7` / `--days-forward 30` configurable. | `coach-profile.mjs` auto, manual |

## One-off (kept for reference, not in the workflow)

| Script | Purpose |
|---|---|
| `coach-query.mjs` | Original DB exploration query |
| `coach-cal.mjs` | Original calendar freshness check |
| `coach-fitness.mjs` | Original standalone fitness compute (superseded by coach-profile.mjs) |
| `coach-context.mjs` | Original context aggregator (superseded by coach-profile.mjs) |
| `coach-write.mjs` | One-off — wrote first weekly plan to DB |
| `coach-reshuffle.mjs` | One-off — first reshuffle + weather wire-up |
| `coach-update-monday.mjs` | One-off — first Monday-update test |

## Usage

Most of the time you don't run these directly — type `/plan` or `/check-in` in Claude Code and the slash commands invoke the right scripts.

### Manual Strava resync (e.g., after a new ride)
```bash
/opt/homebrew/bin/node --env-file=.env.local scripts/strava-backfill.mjs --days 7
```

### Just see the profile without planning
```bash
/opt/homebrew/bin/node --env-file=.env.local scripts/coach-profile.mjs
cat profile.md
```

### Push a hand-edited plan to calendar
```bash
/opt/homebrew/bin/node --env-file=.env.local scripts/add-workouts-to-calendar.mjs --plan plans/2026-05-25.json
# Dry-run:
/opt/homebrew/bin/node --env-file=.env.local scripts/add-workouts-to-calendar.mjs --plan plans/2026-05-25.json --dry-run
```
