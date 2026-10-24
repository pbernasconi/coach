# Week API

How the Lift iPhone app gets the athlete's full weekly plan (every sport, not only lifts). Read-only. The server
computes everything the phone shows (done state, compliance, totals, display text); the phone renders it and does
not port plan logic. Change this file first, then both sides.

## Request

`GET /api/lift/week?start=YYYY-MM-DD&weeks=2&tz=America/Los_Angeles`

- Auth: `Authorization: Bearer <LIFT_SYNC_TOKEN>`, the same token as sync (`src/lib/lift-sync/auth.mjs`). Wrong or
  missing token: `401 {"error":"unauthorized"}`.
- `start`: any day; the server snaps it to that week's Monday. Default: the Monday of today in `tz`.
- `weeks`: 1–4, default 2.
- `tz`: an IANA zone; invalid or missing means `America/Los_Angeles`. It decides "today" and so the states.
- A malformed `start` (not a real `YYYY-MM-DD` day) or `weeks` (not an integer 1–4): `400 {"error":"…"}`.
- `Cache-Control: no-store`. The plan rows and Strava activities come straight from Postgres. The Lift rows (for the
  done state of lifts) come through the server's `lift` data cache, which every applied sync push clears, so a fetch
  after a sync run sees that run's sets.

## Response `200`

```json
{
  "generatedAt": "2026-10-20T20:30:00.000Z",
  "timeZone": "America/Los_Angeles",
  "today": "2026-10-20",
  "weeks": [
    {
      "start": "2026-10-19",
      "title": "Build week 3",
      "hasPlan": true,
      "totals": {
        "plannedMinutes": 540, "plannedTss": 520, "doneMinutes": 130, "doneTss": 140,
        "plannedCount": 9, "doneCount": 2, "missedCount": 0,
        "text": "2/9 done · 2:10 of 9:00 · 140 of 520 TSS"
      },
      "days": [
        {
          "date": "2026-10-20",
          "items": [
            {
              "id": "plan activity id (string, not always a UUID)",
              "date": "2026-10-20",
              "startTime": "13:30",
              "endTime": "14:30",
              "title": "Heavy barbell lift",
              "sport": "strength",
              "workoutType": "strength-heavy",
              "intensity": "Heavy: 3 × 5 at 85%",
              "durationMinutes": 60,
              "tss": 45,
              "subtitle": "13:30 · 60 min · 45 TSS",
              "state": "today",
              "stateLabel": "Today",
              "compliance": null,
              "adapted": false,
              "why": "Strength keeps the legs durable for the ski block.",
              "notes": "Free text from the plan (for lifts: the text above the Lift session block)",
              "keyTargets": ["6 × 5:00 at 294–308 W"],
              "steps": [
                { "label": "Warm-up", "detail": "10:00 · 157–210 W" },
                { "label": "6 ×", "detail": "5:00 Work 294–308 W, 3:00 Recovery 126–154 W" }
              ],
              "profile": [
                { "seconds": 600, "from": 0.68, "to": 0.68, "zone": "Z2" },
                { "seconds": 300, "from": 1.13, "to": 1.13, "zone": "Z5" }
              ],
              "stats": { "time": "1:00:00", "distance": null, "tss": "45" },
              "liftSessionId": "ca4f651b-98c7-4765-83a9-07ab74435d69",
              "done": { "source": "strava", "activityId": "16234567890", "name": "Morning Ride", "minutes": 62, "tss": 70, "text": "62 min · 70 TSS / 60 min · 45 TSS" }
            }
          ]
        }
      ]
    }
  ]
}
```

Field rules:

- `days`: always 7 entries, Monday first. `items` as the web's day cell (`cellItems`): planned workouts in the web's
  order (`sort_order`, then `startTime`), then Strava activities that no planned workout matched. A Lift session is
  never an item (the phone has its own), but an unplanned one takes the day's watch strength activity, so a lift
  shows once.
- `unplanned`: `true` for such an activity: `id` is `activity-<Strava id>`, `state` is `done`, `stateLabel` "Done",
  `stats` and `done` are what was done, and the plan fields are `null` or empty. The phone opens the activity. `false`
  for a planned workout. A day with no
  items is empty; the phone shows it as a free day. A planned rest day is an item with `sport: "rest"`.
- `sport`: an id from `design/sports.json` (the phone's `SportStyle.swift`). Unknown ids: the phone uses `other`.
- `title`: without the leading emoji (`plainTitle`).
- `state`: `planned | today | done | missed | skipped` (from `matchWeek`). `stateLabel`: display text for it, the
  web's status chip (`complianceOf().label`): "Today", "Planned", "Missed", "Skipped", "Rest" for every rest day that
  is not skipped (planned, today or past), and for
  a done item "On target", "Partly on target", "Far off target" or "Done".
- `compliance`: `good | partial | off | null` (from `complianceOf`), only for done items.
- `startTime`, `endTime`, `durationMinutes`, `tss`, `intensity`, `why`, `notes`, `workoutType`, `liftSessionId`,
  `done`: `null` when unknown. `keyTargets`, `steps` and `profile`: `[]` when the workout has no structured steps.
- `profile`: the workout as bars for the row's small interval chart, the web's `WorkoutChart` rules
  (`profileBars` in `src/lib/workouts/steps.mjs`): one bar per step in order with repeats expanded, `seconds` (a lap
  step counts 300), `from`/`to` the height as a fraction of FTP or LTHR (equal unless the step is a ramp) and `zone`
  `Z1`–`Z5` for its colour. `[]` without structured steps (lifts, rest). Builds before it ignore the key.
- `stats`: the row's three numbers as text, each `null` when unknown: `time` ("1:30:00"), `distance` ("18.2 km", from
  the plan's meters or the Strava activity) and `tss` ("95"). A done item shows what was done; any other item what is
  planned.
- `subtitle`, `stateLabel`, `totals.text`, `keyTargets`, `steps[].label/detail`, `done.text`: display-ready text. The
  phone shows them as they are. Targets are in watts or beats with the athlete's anchors, as on the web.
- `subtitle`: start time, planned minutes and TSS; the sport label when all three are unknown.
- `done`: the matched Strava activity or Lift session (`minutes` of a Lift session from its start and finish).
  `done.activityId`: the Strava activity id as a string, the id `GET /api/app/activities/:id` takes; `null` when the
  match is a Lift session.
  `done.text`: done / planned, as the web's chip. `null` for a rest day.
- `totals`: as the web's week column. `doneMinutes`/`doneTss` count every activity of the week (not commutes), planned
  or not. `text` is "x/y done · h:mm of h:mm · a of b TSS" for a week that has started, "9 planned · 11:45 · 630 TSS"
  ahead, or "Nothing planned".
- `liftSessionId`: lower-case UUID of the Lift `session` row (`training_plan_activities.lift_session_id`). The phone
  compares it case-insensitively with its local session ids (LiftStore writes upper-case).
- Dates are plain `YYYY-MM-DD` calendar days. The phone maps them to its zone-free day type, never to a `Date`.

## Phone behaviour

- Fetch after every sync run (launch, scene active, Sync now) and on pull-to-refresh in Week. Keep the last
  successful response on disk and show it when offline; show when it was fetched.
- A strength item with `liftSessionId` that the phone has: show the local Lift session (its progress, tap to open
  the workout) on the plan's day. Exception: when the phone moved the session (`dayMovedAt`) after the shown week
  was downloaded (`generatedAt`), the session shows on its own new day and the item is hidden, until the next
  download carries the server's answer. A local Lift session that no item links to: show it on its own day, as today.
- Non-strength items open a read-only detail sheet: subtitle, state, why, notes, key targets, steps.
- Moving a planned Lift session to another day moves its plan workout too. The phone sets `session.dayMovedAt` to
  now whenever it changes `day` (a move, push to next week, the undo of a move; `SYNC.md`, schema v8). After an
  applied (not stale) `session` change whose `day` differs from the linked workout's date, the server moves the
  workout to that day only when `dayMovedAt` is present and newer than the workout's last change on the server
  (`edited_at`/`updated_at`). It moves it into that week's plan and marks it edited, so a plan re-import keeps it
  (`src/lib/lift/plan-follow.ts`). A skipped workout stays. Without `dayMovedAt` (builds before v8, or any other
  session edit) the plan does not move: an offline edit that still carries the old day cannot undo a web move. The
  web's own Lift pushes keep the stored `dayMovedAt` and never come back to the plan.
- Removing a linked session on the phone (soft delete) leaves its plan workout planned: not skipped, not removed.
  The plan stays the coach's; skip or move the workout in the plan (web or /check-in). The next `lift-plan.mjs` run
  plans a new session for a workout that still has a Lift template. A move the removal carries still counts (same
  `dayMovedAt` rule): Start on a workout planned for a later day moves it to today, and Discard puts the session back
  on its planned day before it removes it, so the plan workout goes back too instead of staying on today as missed.
