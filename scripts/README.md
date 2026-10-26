# Scripts — Coach Personal Workflow

All scripts use `node --env-file=.env.local` (env vars come from `.env.local`).

## Planning

Coach plans weeks and check-ins itself, with the Claude API (`src/lib/planner/`; prompts in
`src/lib/planner/prompts/`). There are no local planning scripts or commands. The scripts below are data tools,
syncs and device jobs.

## Active

| Script | Purpose | Used by |
|---|---|---|
| `travel.mjs` | Library (no CLI). Parses Gmail "Flight to X" events into an itinerary: stay/flight/transit segments, `placeByDate`, `travelDays`. Geocodes destinations (open-meteo) for lat/lon/tz. Layovers <18h are downgraded to transit so they don't pull weather. Also exports **`HOME_TZ`** — the single source of truth for the default timezone; the planner's profile and `add-workouts-to-calendar.mjs` import it rather than redeclaring the literal. Exports only `resolveTravel`, `dateKeysBetween`, `HOME_TZ`. | `src/lib/planner/profile.mjs`, `add-workouts-to-calendar.mjs` |
| `untrusted.mjs` | Library (no CLI). Neutralizes third-party calendar text before it reaches the LLM's context: collapses newlines/control chars, defangs backticks, caps length. Its own module so it's testable. | `src/lib/planner/profile.mjs` |
| `rotation.mjs` | Library (no CLI). `loadRotation(sql, userId, targetKey)` → which quality session comes next (bike VO2 ↔ run intervals), from the plans in the database; `rotationFromPlans` is the pure part. Ignores the target week so re-planning a week can't flip its own rotation. | `src/lib/planner/profile.mjs` |
| `add-workouts-to-calendar.mjs` | `--week YYYY-MM-DD [--dry-run]`: puts the week's workouts from the database on the personal calendar (purple), one event per workout tagged with its id, so a re-run changes only what differs. Logic in `src/lib/calendar-sync/push.mjs`, which the web week page also calls. Each event links to its workout in Coach. From the cloud, the `calendar-push.yml` workflow re-pushes weeks through production. | by hand |
| `zwift-intervals.mjs` | `[--days 14] [--dry-run]`: sends the plan's indoor rides to intervals.icu as `.zwo` (uid `coach:<id>`, so a re-send updates), deletes dropped ones, reads back Zwift upload errors. intervals.icu uploads the coming week to Zwift. The cloud runs the same every 30 minutes (`/api/cron/workouts`, `sync.yml`). Needs `INTERVALS_API_KEY`, `INTERVALS_ATHLETE_ID`. | by hand |
| `zwift-workouts.mjs` | Fallback when intervals.icu is down: `[--days 14] [--dry-run] [--folder P]`: writes the plan's indoor rides (`steps`) as `Coach - <date> <title>.zwo` into `~/Documents/Zwift/Workouts/<id>/`, rewrites changed ones and deletes moved, skipped or removed ones (never a file without the prefix). `zwift/install.sh` runs it every 30 minutes (launchd). Runs on the Garmin watch: `garmin/workouts.py`. Logic in `src/lib/workouts/sync.mjs`. | launchd, by hand |
| `lift-plan.mjs` | `[--days 21] [--dry-run]`: plans each strength workout with a `lift_template` (today on) as a Lift session through `lift/tools/LiftSeed` (Lift's own planner), stores its id in `lift_session_id`, writes the planned sets into the description and pushes the calendar. Re-plans sessions not yet started; never touches one with a logged set. Needs `LIFT_SYNC_TOKEN` and swift. Logic in `src/lib/plan/lift-plan.mjs`. | `plan-apply.yml`, by hand |
| `plan-edit.mjs` | `show` / `move` / `skip` / `unskip` / `update` / `add` workouts in the database, then updates the calendar. | by hand (data fixes) |
| `strava-backfill.mjs` | Incremental sync by default (uses `last_synced_at`). Pulls list, optionally `--detailed` (description, laps, splits, suffer_score) and `--streams` (HR/watts/etc.). Computes & persists `tss`, `tss_method`, `zone_times` per activity, then rebuilds `daily_training_load` (CTL/ATL/TSB). `--days N` or `--force` for explicit windows. | manual |
| `recompute-tss.mjs` | Recomputes every activity's TSS with the current thresholds (`src/lib/strava-sync/tss.mjs`) and rebuilds `daily_training_load`. `--dry-run` shows the change by sport; `--fetch-streams [--limit N]` first fetches missing streams within Strava's rate limit. | manual, after a TSS rule change |
| `function-sync.mjs` | Reads Function Health and posts it to `POST /api/vitals/function`. No database access. | `function.yml`, by hand |
| `calendar-sync.mjs` | Pull events from all active calendar connections into `calendar_events`. Refreshes OAuth on each run. Marks deleted events as cancelled. `--days-back 7` / `--days-forward 30` configurable. | manual |

## Tests

```bash
npm test          # node --test scripts/*.test.mjs — no framework, no deps
```

Covers the logic that regresses invisibly: `travel.mjs` (itinerary resolution,
layover downgrade, `sameCity`, the `FLIGHT_RE` ReDoS bound), `untrusted.mjs`
(injection neutralizing, legit-title preservation), and `rotation.mjs`
(alternation, self-read guard, malformed-plan tolerance). 33 tests, ~70ms, no
network — `resolveTravel` takes an injectable `deps.geocode`.

The planner's own tests are in `src/lib/planner/*.test.mjs` (the prompt, the loop with a fake Claude, cost).

## Design notes (don't undo these)

**Calendar text is untrusted.** Anyone who can send Paolo an invite controls the
event `summary`/`location` verbatim, and the planner's profile feeds that text to
Claude. So:
- `untrusted()` flattens newlines/control chars, defangs
  backticks and caps length before any calendar string reaches `profile.md`. Newlines
  are the actual injection vector — a title containing `\n\n## Ignore the above` would
  otherwise render as top-level markdown indistinguishable from our own instructions.
- Calendar rows render inside a labelled `>` blockquote telling the reader the
  contents are data, not instructions.
- `FLIGHT_RE`'s destination capture is **bounded** (`[^()\n]{1,80}`). An unbounded
  lazy `.+?` next to `\s*` backtracks catastrophically (~O(n^2.8): 12s on an 8KB
  title), and Google documents no max length for `summary`.
- Paolo's Accept is **not optional**: nothing a plan holds reaches his calendar, Lift
  or Garmin before he accepts it. It is the last gate between a hostile event title
  and attacker-shaped calendar events.

**`sameCity()` is an exact token match, not substring.** `includes` treated
"San Francisco del Rincon" (Guanajuato, MX) as home — which would silently apply SF
weather + PDT and schedule a bike ride there.

## Usage

### Manual Strava resync (e.g., after a new ride)
```bash
node --env-file=.env.local scripts/strava-backfill.mjs --days 7
```

### Push a week to the calendar again
```bash
node --env-file=.env.local scripts/add-workouts-to-calendar.mjs --week 2026-10-26 [--dry-run]
```
