---
description: Mid-week training check-in. Compares planned vs actual, asks how things felt, edits remaining days in place, syncs calendar.
---

# /check-in — Mid-Week Adjustment

## Durable preferences (same as /plan)
- Personal Gmail calendar, purple events
- 2 strength/wk, ≥1 above-threshold quality/wk
- The Lift templates (in the profile) are authoritative for lifts; "Lift sessions" in the profile shows each set logged
- "Notes from Lift" in the profile are what Paolo wrote on an exercise or a workout ("Achilles sore", "go up 5 lb"):
  bring them up in Step 3 and adjust the next days for them, the same way as /plan
- Celsius / km / min/km
- All scripts via `node --env-file=.env.local`

## Workflow

### Step 1 — Find the current plan
The plan lives in the Coach database. Read this week's (moves, skips and "how I feel" adapts from the web are in it):
```bash
node --env-file=.env.local scripts/plan-edit.mjs show YYYY-MM-DD   # any day of the week
```
If there is no plan → tell the user to run `/plan` first.

### Step 2 — Refresh data
```bash
node --env-file=.env.local scripts/coach-profile.mjs --week-of YYYY-MM-DD
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
- **Past days**: don't rewrite. Coach already marks them done (Strava and Lift) or missed.
- **Future days**: freely modify. Apply same coaching principles as /plan.

Common patterns:
- Felt great + TSB recovering → keep Fri quality session
- Beat up → drop intensity, swap to easy
- Skipped Tue strength → don't try to "make it up"; continue
- Weather got worse → outdoor → Zwift swap

### Step 6 — Apply the changes (database, then calendar)
Make each change to a **future** workout in the database. Each command also updates Google Calendar:
```bash
node --env-file=.env.local scripts/plan-edit.mjs move <workoutId> YYYY-MM-DD
node --env-file=.env.local scripts/plan-edit.mjs skip <workoutId>
node --env-file=.env.local scripts/plan-edit.mjs update <workoutId> title="Easy aerobic ride" duration=60 intensity=easy description="Z2 only"
node --env-file=.env.local scripts/plan-edit.mjs update <workoutId> lift_template="Upper (dumbbells)"
node --env-file=.env.local scripts/lift-plan.mjs
node --env-file=.env.local scripts/zwift-intervals.mjs
gh workflow run garmin.yml --repo pbernasconi/coach -f workouts_only=true
```
These bring Zwift (through intervals.icu) and the Garmin calendar in line with the changed workouts. Without them,
the cloud does it within 30 minutes (Zwift) and within the hour (Garmin).

### Step 7 — Report to user
Brief output:
- 1-line summary of what changed (e.g., "Moved Fri tempo to Sat easy. Calendar updated.")
- Updated fitness snapshot
- The week on the web: https://coach.paolobernasconi.com/plan?week=YYYY-MM-DD

## Notes for you, Claude

- Be surgical. Don't rewrite the whole plan.
- Don't ever delete past-day annotations — they're history.
- Future event changes always re-push the whole week's calendar (idempotent by design).
- If the user's check-in reveals major life event (sick, injured, travel surprise), suggest re-running `/plan` for the next week.
