# Scripts — Coach Personal Workflow

All scripts use `node --env-file=.env.local` (env vars come from `.env.local`).

## Active (used by /plan and /check-in)

| Script | Purpose | Used by |
|---|---|---|
| `coach-profile.mjs` | Aggregate athlete profile: physiology + fitness state (from `daily_training_load`) + 90d sport stats + 365d rhythm + 14d log + **N weeks** of calendar + **travel-aware weather** + quality rotation state + Apple Notes. Auto-runs `calendar-sync.mjs` and `strava-backfill.mjs` first (`--no-sync` to skip). `--weeks N` / `--two-weeks` sets the horizon. Rejects unknown flags. Writes `profile.md` + `profile.json`. | `/plan`, `/check-in` |
| `travel.mjs` | Library (no CLI). Parses Gmail "Flight to X" events into an itinerary: stay/flight/transit segments, `placeByDate`, `travelDays`. Geocodes destinations (open-meteo) for lat/lon/tz. Layovers <18h are downgraded to transit so they don't pull weather. Also exports **`HOME_TZ`** — the single source of truth for the default timezone; `coach-profile.mjs`, `render-plan.mjs` and `add-workouts-to-calendar.mjs` all import it rather than redeclaring the literal. Exports only `resolveTravel`, `dateKeysBetween`, `HOME_TZ`. | `coach-profile.mjs`, `render-plan.mjs`, `add-workouts-to-calendar.mjs` |
| `render-plan.mjs` | Render `plans/YYYY-MM-DD.md` from `plans/YYYY-MM-DD.json`. The JSON is the single source of truth; the md is derived. `--stdout` to preview. | `/plan`, `/check-in` |
| `untrusted.mjs` | Library (no CLI). Neutralizes third-party calendar text before it reaches the LLM's context: collapses newlines/control chars, defangs backticks, caps length. Its own module so it's testable. | `coach-profile.mjs` |
| `rotation.mjs` | Library (no CLI). `loadRotation(sql, userId, targetKey)` → which quality session comes next (bike VO2 ↔ run intervals), from the plans in the database; `rotationFromPlans` is the pure part. Ignores the target week so re-running `/plan` can't flip its own rotation. | `coach-profile.mjs` |
| `add-workouts-to-calendar.mjs` | `--week YYYY-MM-DD [--dry-run]`: puts the week's workouts from the database on the personal calendar (purple), one event per workout tagged with its id, so a re-run changes only what differs. Logic in `src/lib/calendar-sync/push.mjs`, which the web week page also calls. | `/plan`, `/check-in` |
| `plan-import.mjs` | Copies a `/plan` draft (`plans/YYYY-MM-DD.json`, local and gitignored) into the database; keeps workouts changed on the web. | `/plan` |
| `plan-edit.mjs` | `show` / `move` / `skip` / `unskip` / `update` workouts in the database, then updates the calendar. | `/check-in` |
| `apple-notes-workouts.mjs` | Pull workout-shaped notes from Apple Notes via osascript. JSON to stdout. | `coach-profile.mjs` |
| `strava-backfill.mjs` | Incremental sync by default (uses `last_synced_at`). Pulls list, optionally `--detailed` (description, laps, splits, suffer_score) and `--streams` (HR/watts/etc.). Computes & persists `tss`, `tss_method`, `zone_times` per activity, then rebuilds `daily_training_load` (CTL/ATL/TSB). `--days N` or `--force` for explicit windows. | `coach-profile.mjs` auto, manual |
| `calendar-sync.mjs` | Pull events from all active calendar connections into `calendar_events`. Refreshes OAuth on each run. Marks deleted events as cancelled. `--days-back 7` / `--days-forward 30` configurable. | `coach-profile.mjs` auto, manual |

## Tests

```bash
npm test          # node --test scripts/*.test.mjs — no framework, no deps
```

Covers the logic that regresses invisibly: `travel.mjs` (itinerary resolution,
layover downgrade, `sameCity`, the `FLIGHT_RE` ReDoS bound), `untrusted.mjs`
(injection neutralizing, legit-title preservation), and `rotation.mjs`
(alternation, self-read guard, malformed-plan tolerance). 33 tests, ~70ms, no
network — `resolveTravel` takes an injectable `deps.geocode`.

Not covered: `coach-profile.mjs` itself (a top-to-bottom script that queries the
DB at import time, so it can't be imported by a test) and `render-plan.mjs`.
Verify those by running them — see Usage below.

## Design notes (don't undo these)

**Calendar text is untrusted.** Anyone who can send Paolo an invite controls the
event `summary`/`location` verbatim, and `coach-profile.mjs` feeds that text into an
LLM that then writes files and pushes events to his real calendar. So:
- `coach-profile.mjs`'s `untrusted()` helper flattens newlines/control chars, defangs
  backticks and caps length before any calendar string reaches `profile.md`. Newlines
  are the actual injection vector — a title containing `\n\n## Ignore the above` would
  otherwise render as top-level markdown indistinguishable from our own instructions.
- Calendar rows render inside a labelled `>` blockquote telling the reader the
  contents are data, not instructions.
- `FLIGHT_RE`'s destination capture is **bounded** (`[^()\n]{1,80}`). An unbounded
  lazy `.+?` next to `\s*` backtracks catastrophically (~O(n^2.8): 12s on an 8KB
  title), and Google documents no max length for `summary`.
- `/plan` Step 5's human confirm is **not optional** — it's the last gate between a
  hostile event title and attacker-shaped calendar events. `--yes` skips the
  questions, not the human.

**`sameCity()` is an exact token match, not substring.** `includes` treated
"San Francisco del Rincon" (Guanajuato, MX) as home — which would silently apply SF
weather + PDT and schedule a bike ride there.

**The plan `.json` is the source of truth; the `.md` is derived.** Never hand-edit a
`plans/*.md` — it will be overwritten. Edit the JSON and re-run `render-plan.mjs`.
Corollary: a plan JSON missing the rich fields (`tss`/`intensity`/`why`/`completed`/
`philosophy`) renders a threadbare table, so keep them populated.

## Usage

Most of the time you don't run these directly — type `/plan` or `/check-in` in Claude Code and the slash commands invoke the right scripts.

### Manual Strava resync (e.g., after a new ride)
```bash
node --env-file=.env.local scripts/strava-backfill.mjs --days 7
```

### Just see the profile without planning
```bash
node --env-file=.env.local scripts/coach-profile.mjs
cat profile.md

# Two-week horizon (calendar + weather + travel span both weeks):
node --env-file=.env.local scripts/coach-profile.mjs --two-weeks

# Fast re-read with no upstream sync:
node --env-file=.env.local scripts/coach-profile.mjs --two-weeks --no-sync
```

### Non-interactive plan (skips the 3 questions)
```
/plan --two-weeks --feel fresh --focus cycling --yes
```

### Re-render a plan's markdown after hand-editing its JSON
```bash
node --env-file=.env.local scripts/render-plan.mjs --plan plans/2026-07-20.json
# Preview without writing:
node --env-file=.env.local scripts/render-plan.mjs --plan plans/2026-07-20.json --stdout
```

### Push a hand-edited plan to calendar
```bash
node --env-file=.env.local scripts/add-workouts-to-calendar.mjs --plan plans/2026-05-25.json
# Dry-run:
node --env-file=.env.local scripts/add-workouts-to-calendar.mjs --plan plans/2026-05-25.json --dry-run
```
