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
- **Skipped**: Paolo skipped it on purpose (Skip in the web, `SKIPPED (reason)` in `plan-edit.mjs show`). The reason
  is one of tired, sick, sore, busy, travel, other.
- **Missed**: No matching activity and not skipped → ask why in Step 4, then record it with
  `plan-edit.mjs skip <id> <reason>` so the history says why.
- **Swapped**: Different sport → note the swap.

Show as a compact table:
```
| Day | Planned | Actual | Notes |
| Mon | Easy Run 60min | ✅ 59min, TSS 70 | slightly harder than target |
| Tue | Strength heavy | ⚠️ skipped (tired) | — |
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
- Skipped Tue strength (busy) → move it once to the next free aerobic or rest day (see the lift rule below)
- Weather got worse → outdoor → Zwift swap

Skipped workouts, by reason:
- **A missed lift is the one exception.** Lifts are the goal most at risk (2 a week grows the arms), so a lift
  skipped or missed for busy, travel or other moves once to the next aerobic or rest day this week or in the next 7
  days: never on a workout day, at least 24 h from the other lift, stacked straight after that day's aerobic session
  (one session a day, or one block; never a run after it). A 40 min version is fine. Tired, sore or sick: don't move
  it; the next lift is the regular one. Never put two lifts on one day.
- **Never make up any other skipped workout.** Don't move it to a later day, don't add its TSS to other days, and don't stack
  two quality sessions to catch up. The week's TSS target drops by what was skipped.
- **tired / sore**: a fatigue signal. The next day is easy or rest. The next quality session needs one easy day in
  front of it; if it is tomorrow, push it a day or make it aerobic. If it is the week's second fatigue skip (or HRV
  and sleep in the profile are down), cut the rest of the week's intensity and tell Paolo.
- **sick**: rest until symptoms are gone, then 1–2 easy days before any intensity ("above the neck" mild cold: easy
  Z1–Z2 only). Drop the week's remaining quality sessions if it is mid-week or later.
- **busy / travel**: no fatigue signal. Keep the plan; if the skipped session was the week's only quality session,
  it may replace an easy day later in the week, never next to another hard day.
- The web does part of this already: a Skip of **today's** workout for tired, sore or sick records how Paolo feels
  (the feel log) and eases tomorrow's quality session the same way "how I feel: tired" does. Check what it changed
  (`adapted` in `plan-edit.mjs show`) before you change more.

### Step 6 — Apply the changes (database, then calendar)
Make each change to a **future** workout in the database. Each command also updates Google Calendar:
```bash
node --env-file=.env.local scripts/plan-edit.mjs move <workoutId> YYYY-MM-DD
node --env-file=.env.local scripts/plan-edit.mjs skip <workoutId> tired   # tired | sick | sore | busy | travel | other
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
- Future event changes always re-push the whole week's calendar (idempotent by design). Each event links to its
  workout in Coach; change workouts through `plan-edit.mjs`. A workout Paolo moved on the calendar keeps its new
  time: the push copies it into Coach (every hour too), so `profile.md` may show a time he set there.
- If the user's check-in reveals major life event (sick, injured, travel surprise), suggest re-running `/plan` for the next week.
