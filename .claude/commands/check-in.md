---
description: Mid-week training check-in. Compares planned vs actual, asks how things felt, edits remaining days in place, syncs calendar.
---

# /check-in — Mid-Week Adjustment

## Durable preferences (same as /plan)
- Personal Gmail calendar, purple events
- 2 strength/wk, ≥1 above-threshold quality/wk
- Apple Notes templates authoritative for lifts
- Celsius / km / min/km
- All scripts via `/opt/homebrew/bin/node --env-file=.env.local`

## Workflow

### Step 1 — Find the current plan
List `plans/`. Read the most recent `plans/YYYY-MM-DD.md` AND `plans/YYYY-MM-DD.json`. If none exists → tell user to run `/plan` first.

### Step 2 — Refresh data
```bash
/opt/homebrew/bin/node --env-file=.env.local scripts/coach-profile.mjs --week-of YYYY-MM-DD
```
Read fresh `profile.md`. This pulls any newly completed Strava activities + fresh weather + fresh calendar.

### Step 3 — Diff planned vs actual
For each past day (Mon → today):
- **Completed**: Strava activity matches planned sport → record actual duration + TSS + how it compares.
- **Skipped**: No matching activity → mark skipped.
- **Swapped**: Different sport → note the swap.

Show as a compact table:
```
| Day | Planned | Actual | Notes |
| Mon | Easy Run 60min | ✅ 59min, TSS 70 | slightly harder than target |
| Tue | Strength heavy | ⚠️ skipped | — |
```

Also surface the **updated fitness state**: new CTL/ATL/TSB and the delta from when the plan was made.

### Step 4 — Ask 1-2 quick questions (AskUserQuestion)
1. **How did completed sessions feel?** Great / Normal / Harder than expected / Beat up
2. **Reason to change remaining days?** Stay the course / Reduce / Add quality / Reshuffle / Skip ahead

### Step 5 — Adjust remaining days
- **Past days**: don't rewrite. Just annotate completion status in the .md table (✅ with actuals; ~~strike~~ for skipped).
- **Future days**: freely modify. Apply same coaching principles as /plan.

Common patterns:
- Felt great + TSB recovering → keep Fri quality session
- Beat up → drop intensity, swap to easy
- Skipped Tue strength → don't try to "make it up"; continue
- Weather got worse → outdoor → Zwift swap

### Step 6 — Update the markdown + JSON
Edit `plans/YYYY-MM-DD.md` in place:
- Annotate past days
- Modify upcoming day rows
- Append a check-in log entry:
```markdown
#### {date} check-in
- {user feel report}
- {what you changed and why}
```

Before you change the JSON, read what he changed on the web week page (moves, skips, "how I feel" adapts):
```bash
/opt/homebrew/bin/node --env-file=.env.local scripts/plan-import.mjs --show plans/YYYY-MM-DD.json
```
Treat those web changes as his decisions. Put them in the JSON too, so the JSON and the web agree.

If any **future** events were modified (time, sport, intensity, removed), update `plans/YYYY-MM-DD.json` events array to match — keep IDs stable where possible (don't replace events that didn't change).

### Step 7 — Sync calendar (only if .json events changed)
If you modified the events array in the .json:
```bash
/opt/homebrew/bin/node --env-file=.env.local scripts/add-workouts-to-calendar.mjs --plan plans/YYYY-MM-DD.json
```
This will delete the old tagged events for the week and create the new ones (idempotent).
Then copy the plan to the database (web changes are kept):
```bash
/opt/homebrew/bin/node --env-file=.env.local scripts/plan-import.mjs --plan plans/YYYY-MM-DD.json
```

If only **past** days were annotated (no future event changes), skip the calendar sync — nothing changed in the future.

### Step 8 — Report to user
Brief output:
- 1-line summary of what changed (e.g., "Moved Fri tempo to Sat easy. Calendar updated.")
- Updated fitness snapshot
- File: `plans/YYYY-MM-DD.md`

## Notes for you, Claude

- Be surgical. Don't rewrite the whole plan.
- Don't ever delete past-day annotations — they're history.
- Future event changes always re-push the whole week's calendar (idempotent by design).
- If the user's check-in reveals major life event (sick, injured, travel surprise), suggest re-running `/plan` for the next week.
