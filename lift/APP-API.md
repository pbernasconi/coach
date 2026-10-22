# App API

Read-only JSON for the Lift iPhone app: the web's Today, Trends, Activity and Lift pages (not Health, not Settings).
Server-side first: the server computes every number, state and label with the same functions as the web page, and
the phone shows them. The phone does not port web logic. Change this file first, then both sides. The week plan has
its own contract: `WEEK-API.md`.

## Shared rules

- Prefix `/api/app/…`, `GET` only. Auth: `Authorization: Bearer <LIFT_SYNC_TOKEN>` with `isAuthorized` from
  `src/lib/lift-sync/auth.mjs`; wrong or missing token `401 {"error":"unauthorized"}`. The proxy (`src/proxy.ts`) already treats
  `/api/app/*` as machine routes (no Clerk). The owner is `ownerId()` (`src/lib/plan/queries.ts`).
- `?tz=` IANA zone (invalid or missing: `America/Los_Angeles`) decides "today". Days are plain `YYYY-MM-DD`.
  Instants are ISO 8601 with `Z`. Database times only through `src/lib/db-time.mjs` (RELIABILITY.md).
- `Cache-Control: no-store`. Errors: `400` bad params, `404` not found, `500 {"error":"internal error"}` (log it).
- Every top-level section is independent: `{ "ok": true, …data }` or `{ "ok": false }`, so one failing loader
  never blanks the screen (the web uses `load()`/`safe()` from `src/lib/safe.ts` the same way).
- Display text is ready to show: every number the phone shows has a `…Text` field next to the raw value (the raw
  value is for charts and sorting). Units follow the web (metric; lift weights in the web's display unit).
- Links between screens are ids the phone can open with another endpoint (`activityId`, `sessionId`,
  `exerciseKey`), never web URLs. Web-only links (Health, Settings, edits) are left out.
- Payload: keep each response under about 100 KB. Long series are downsampled on the server.
- Each route is in the deploy health check (`runChecks()` in `src/lib/health.ts`), like `/api/lift/week`.

## Endpoints

Each feature adds its section below: path, params, response example, field rules, empty states.

### Today: `GET /api/app/today?tz=`

The web's Today page (`src/app/(dashboard)/page.tsx`) without its links to Health and Settings, without weather, and
without the week grid (the phone has `/api/lift/week`). Loader `loadAppToday` (`src/lib/performance/app-pages.ts`),
shape `todayResponse` (`src/lib/performance/today-api.mjs`), text from `src/lib/performance/display.mjs`, which the
web page also uses. About 17 KB (the fitness chart is about 13 KB of it).

```json
{
  "generatedAt": "2026-10-20T21:02:24.435Z",
  "timeZone": "America/Los_Angeles",
  "today": "2026-10-20",
  "dateText": "Tuesday, October 20",
  "header": {
    "ok": true,
    "chips": [
      { "key": "readiness", "label": "Readiness", "value": 56, "valueText": "56 · Moderate", "tone": "good" },
      { "key": "sleep", "label": "Sleep", "value": 442, "valueText": "7:22", "tone": "warn" },
      { "key": "hrv", "label": "HRV", "value": "Balanced", "valueText": "Balanced", "tone": "good" },
      { "key": "fitness", "label": "Fit / Fat", "value": 53, "valueText": "53 / 42", "tone": "neutral" },
      { "key": "form", "label": "Form", "value": 10, "valueText": "+10", "tone": "good" }
    ],
    "emptyText": null
  },
  "stale": { "ok": true, "text": null },
  "todayLine": {
    "ok": true,
    "items": [
      { "id": "ylfw7n0i8xabidggyzmge38q", "title": "Heavy barbell lift", "sport": "strength", "state": "today",
        "text": "10:30 · 1:15", "liftSessionId": "ca4f651b-98c7-4765-83a9-07ab74435d69" }
    ],
    "emptyText": null,
    "cue": "Readiness moderate: hold back about 10%"
  },
  "fitness": {
    "ok": true,
    "today": "2026-10-20",
    "days": [
      { "date": "2026-06-22", "ctl": 60.8, "atl": 67.6, "tsb": -6.8, "tss": 0, "projected": false },
      { "date": "2026-10-21", "ctl": 53.1, "atl": 48.2, "tsb": 4.8, "tss": 95, "projected": true }
    ],
    "zones": [
      { "label": "Fresh", "from": 5, "to": null, "shade": true },
      { "label": "Neutral", "from": -10, "to": 5, "shade": false },
      { "label": "Productive", "from": -30, "to": -10, "shade": true },
      { "label": "Overreaching", "from": null, "to": -30, "shade": false }
    ],
    "events": [{ "id": "12", "name": "Haute Route", "date": "2026-11-01", "priority": "A" }],
    "now": { "date": "2026-10-19", "ctl": 52.6, "atl": 42.2, "tsb": 10.4, "zone": "Fresh" },
    "caption": "Projection to 2026-11-03: 1210 planned TSS, fitness 61, form -8."
  },
  "last4Weeks": {
    "ok": true,
    "tiles": [
      { "key": "time", "label": "Time · 4 weeks", "valueText": "26:36 h", "noteText": "6.6 h a week", "sport": null },
      { "key": "run", "label": "Run", "valueText": "72 km", "noteText": "5:35 /km", "sport": "run" },
      { "key": "ride", "label": "Ride", "valueText": "313 km", "noteText": "14:14 h", "sport": "ride" },
      { "key": "strength", "label": "Strength", "valueText": "2 of 8", "noteText": "sessions", "sport": "strength" }
    ]
  },
  "body": {
    "ok": true,
    "weight": { "date": "2026-10-19", "kg": 78.4, "text": "78.4", "unit": "kg", "change4w": -1.2,
                "changeText": "▼ 1.2 kg", "changeTone": "good", "noteText": "in 4 weeks · -0.30 kg a week" },
    "series": [{ "date": "2026-08-01", "kg": 79.7 }, { "date": "2026-10-19", "kg": 78.4 }],
    "bodyFat": 14.3,
    "bodyFatText": "14.3 %",
    "emptyText": null
  },
  "lift": {
    "ok": true,
    "unit": "lb",
    "hasData": true,
    "arms": {
      "band": { "min": 10, "max": 20 },
      "bandText": "target 10–20",
      "rows": [{ "muscle": "biceps", "sets": 5.5, "setsText": "5.5" }, { "muscle": "triceps", "sets": 0, "setsText": "0" }]
    },
    "mainLifts": [
      { "exerciseKey": "id-4c494654-0000-4000-8000-000000000001", "name": "Back squat",
        "points": [{ "day": "2026-09-16", "e1rm": 310.5 }, { "day": "2026-09-25", "e1rm": 323 }],
        "latest": 323, "latestText": "323 lb", "change": 0.041, "changeText": "+4%", "tone": "good", "sparkText": null }
    ],
    "mainLiftsEmptyText": null,
    "strength": { "done": 0, "target": 2, "text": "0 / 2 this week" },
    "last": { "sessionId": "d5a25b33-32e0-5bcd-bc53-5f17cb084120", "day": "2026-09-29", "daysSince": 21,
              "whenText": "21 days ago", "late": true, "title": "Workout C", "prs": 0, "text": "Workout C" },
    "next": { "sessionId": "ca4f651b-98c7-4765-83a9-07ab74435d69", "day": "2026-10-20", "dateText": "Oct 20", "title": "Heavy barbell" },
    "nextEmptyText": null
  },
  "goals": {
    "ok": true,
    "items": [
      { "id": "run-10k-4min", "kind": "run_10k_pace", "title": "Run 10k at 4:00/km", "status": "open", "statusText": "open",
        "current": 297.51, "currentText": "4:58/km", "target": 240, "targetText": "4:00/km", "deadline": "2027-06-01",
        "daysLeft": 224, "timeText": "224 days left · 2027-06-01", "progress": 0.01,
        "detail": ["Best 10k+ run in 12 months: 4:58/km (Morning Run, 2025-11-13)", "Garmin 10k prediction: 4:49/km"] }
    ],
    "emptyText": null
  }
}
```

Field rules:

- `tone`: `good | warn | bad | neutral` (the web's chip dot: green, amber, red, gray). Never color alone: the
  phone shows `valueText` next to it.
- `header`: always `ok: true` (the web loads recovery as optional). A chip is left out when its value is missing:
  readiness, sleep and HRV need Garmin data from today or yesterday (`loadRecoveryToday`); fitness and form come from
  the last actual day of `fitness`. `emptyText` "No Garmin data today." only when there is neither. The chips are
  plain values: the web links them to Health, the phone does not.
- `stale.text`: "The newest Strava activity is from YYYY-MM-DD." when it is more than 7 days old, else `null`.
- `todayLine`: today's planned workouts, not skipped (the line above the web's week). `id` is the plan workout id,
  the same as `/api/lift/week` `items[].id`. `text`: start time and duration ("45m", "1:15"), plus " · done".
  `emptyText` when there are none: "Rest day" (the week has a plan) or "No plan this week. Run /plan in Claude Code
  to make one." `cue`: the readiness cue, only with items and a readiness value.
- `fitness.days`: 120 days before today, then the plan's projection (`projected: true`) to the end of the plan or
  the next event (at most 120 days). Values to 0.1. Today is projected while it has planned TSS and no done TSS
  yet; `now` is the last actual day (the source of the fitness and form chips). `zones`: form bands for the TSB panel, `null` = open end, `shade` = draw a band.
  `events`: A events get a label, B and C a thin line. `caption`: `null` without a projection.
- `last4Weeks.tiles`: the 4 complete weeks before this one; `[]` when there are none. `sport`: the tile's dot color
  (a `design/sports.json` id), `null` for ink.
- `body`: weight is in kg (the scale's unit), to 0.1. `series`: the last 12 weeks for the trend line (scaled to its
  own range). `weight: null` with `emptyText` when there is no reading in 12 weeks; `bodyFatText` "–" without one.
- `lift.arms.rows`: biceps and triceps hard sets this week against `band`. `lift.mainLifts`: the 4 exercises done most
  in 12 weeks, e1RM per session (`points`, in `unit`); `sparkText` "1 session" when there is one point (no line).
  `tone` of the change: `good` (up), `bad` (down), `null`. `mainLifts: []` with `mainLiftsEmptyText` when none.
  `strength.done`: strength days this week (Strava and Lift, one per day). `last.late`: 10 days or more (the web
  shows it in red). `last.text`: title plus " · 2 PRs" from the last 14 days. `next: null` with
  `nextEmptyText` "Not planned yet". Session ids are lower-case; compare case-insensitively.
- `goals.items`: `status` `done | open | on_track | behind | not_started | missed`; `daysLeft: null` for done and
  missed; `progress` 0–1 (bar width); `detail`: lines under the bar. `items: []` with `emptyText` when none.

### Trends: `GET /api/app/trends?tz=`

The web's Trends page (`src/app/(dashboard)/trends/page.tsx`). Loader `loadAppTrends`
(`src/lib/performance/app-pages.ts`), shape `trendsResponse` (`src/lib/performance/trends-api.mjs`), text from
`display.mjs`. About 17 KB.

```json
{
  "generatedAt": "2026-10-20T21:02:25.218Z",
  "timeZone": "America/Los_Angeles",
  "today": "2026-10-20",
  "performance": {
    "ok": true,
    "staleText": null,
    "tiles": [
      { "key": "hours", "label": "Hours, last 4 weeks", "valueText": "26:36", "sport": null,
        "delta": { "pct": -7, "text": "▼ 7%", "tone": "down" }, "footText": "vs the 4 weeks before",
        "spark": { "values": [5.02, 0.93], "labels": ["Week of Oct 12", "Week of Oct 19"], "texts": ["5:01 h", "0:56 h"] } },
      { "key": "run", "label": "Run, last 4 weeks", "valueText": "72 km", "sport": "run", "delta": null,
        "footText": "Pace 5:35/km", "spark": { "values": [39.81, 0], "labels": ["…"], "texts": ["…"] } },
      { "key": "form", "label": "Form today", "valueText": "+15", "sport": null, "delta": null,
        "footText": "Fresh · fitness 51 · strength 2/8", "spark": { "values": [52.7, 51.4], "labels": ["2026-10-18", "2026-10-20"], "texts": ["fitness 53", "fitness 51"] } }
    ],
    "weeklyHours": {
      "sports": [{ "id": "ride", "label": "Ride" }, { "id": "run", "label": "Run" }, { "id": "hike", "label": "Hike" }],
      "average": 6.89,
      "averageText": "avg 6:53",
      "weeks": [
        { "week": "2026-10-12", "label": "Oct 12", "current": false, "hours": 5.02, "hoursText": "5:01",
          "sports": [{ "id": "run", "hours": 3.64, "hoursText": "3:39", "detail": "Run · 39.8 km" },
                     { "id": "hike", "hours": 1.38, "hoursText": "1:23", "detail": "Hike · 4.5 km" }],
          "strength": 0, "tss": 320 },
        { "week": "2026-10-19", "label": "Oct 19", "current": true, "hours": 0.93, "hoursText": "0:56",
          "sports": [{ "id": "ride", "hours": 0.93, "hoursText": "0:56", "detail": "Virtual ride · 30 km" }],
          "strength": 0, "tss": 49 }
      ]
    },
    "table": [
      { "week": "2026-10-19", "current": true, "label": "Oct 19 (this week)", "hoursText": "0:56", "runKmText": "-",
        "runPaceText": "-", "rideKmText": "30", "strengthText": "-", "tssText": "49", "planText": "0/1" }
    ]
  },
  "ramp": {
    "ok": true,
    "rates": [
      { "days": 7, "label": "7 days", "change": -2.1, "changeText": "-2.1", "perWeek": -2.1, "perWeekText": "-2.1/wk",
        "level": "falling", "levelText": "Falling", "warn": false },
      { "days": 365, "label": "1 year", "change": null, "changeText": "–", "perWeek": null, "perWeekText": null,
        "level": null, "levelText": "Not enough data", "warn": false }
    ],
    "note": "CTL points. Over +8 a week is a high injury risk; +5 to +8 is aggressive."
  },
  "peaks": {
    "ok": true,
    "note": "From Strava streams. Elapsed time for runs, so stops count. 304 activities still to scan.",
    "windows": [{ "key": "all", "label": "All time" }, { "key": "d90", "label": "90 days" }, { "key": "d28", "label": "28 days" }],
    "power": {
      "title": "Power", "unitText": "best average, W", "empty": false,
      "rows": [
        { "span": 5, "label": "5 s", "cells": {
          "all": { "value": 861, "text": "861 W", "subText": null, "date": "2026-06-21", "dateText": "Jun 21, 26",
                   "activityId": "19015136492", "name": "Cycling", "best": true },
          "d90": { "value": 829, "text": "829 W", "subText": null, "date": "2026-09-07", "dateText": "Sep 7, 26",
                   "activityId": "20081894381", "name": "Cycling", "best": false },
          "d28": null } }
      ]
    },
    "run": {
      "title": "Run", "unitText": "fastest time · pace /km", "empty": false,
      "rows": [
        { "span": 1000, "label": "1 km", "cells": {
          "all": { "value": 267, "text": "4:27", "subText": "4:27", "date": "2025-10-31", "dateText": "Oct 31, 25",
                   "activityId": "16313062658", "name": "Morning Run", "best": true },
          "d90": null, "d28": null } }
      ]
    }
  },
  "lift": {
    "ok": true,
    "hasData": true,
    "emptyText": null,
    "unit": "lb",
    "muscles": {
      "band": { "min": 10, "max": 20 },
      "note": "This week. A set counts 1 for a primary muscle and 0.5 for a secondary one.",
      "rows": [
        { "muscle": "back", "label": "Back", "week": 0, "weekText": "0", "avg": 3, "avgText": "3",
          "status": "below", "statusText": "below target" }
      ]
    },
    "mainLifts": [{ "exerciseKey": "id-4c494654-0000-4000-8000-000000000001", "name": "Back squat", "points": [{ "day": "2026-09-25", "e1rm": 323 }], "latest": 323,
                    "latestText": "323 lb", "change": 0.041, "changeText": "+4%", "tone": "good", "sparkText": null }]
  }
}
```

Field rules:

- `performance.tiles`: always 4 (`hours`, `run`, `ride`, `form`), over the 4 complete weeks before this one.
  `delta`: change against the 4 weeks before those, `tone` `up | down` (the web: up green, down red); `null` when
  those weeks have no data, and the hours and ride tiles then show `footText` "Moving time". With a delta the phone
  shows `delta.text` then `footText`. `spark`: one value per week (12, oldest first; the form tile: fitness once a
  week), with `labels` and `texts` for a tap read-out. `sport`: accent color, `null` for the default.
- `performance.weeklyHours`: the last 12 weeks, oldest first. `sports`: the series in stack order (bottom first,
  `design/sports.json` order), only sports with hours in the 12 weeks, never rest. Each week's `sports`: its
  non-zero segments in the same order; `detail` is the tooltip text (exact Strava types, km). `current`: the week in
  progress (the web draws it lighter and leaves it out of `average`). `strength`: strength days (dots under the bar).
- `performance.table`: the same 12 weeks, newest first; every cell is text, "-" for none. `staleText` as Today's.
- `ramp.rates`: always 4 (7, 28, 90, 365 days). `warn`: high or aggressive (the web adds "▲" and red to `levelText`).
  A window without data has `change: null` and `levelText` "Not enough data".
- `peaks`: `power` spans are seconds (`value` watts), `run` spans meters (`value` seconds; 21097 is the half). A cell
  is `null` when there is no effort in that window. `best`: the cell is the all-time best (bold). `activityId`: the
  Strava activity id, for `/api/app/activities/{id}`. `empty`: no data for the table ("No data yet.").
- `lift.muscles.rows`: the top 10 muscles by the 4-week average; `week` this week's hard sets, `avg` the weekly
  average of the 4 weeks before, `status` `below | inRange | above` the band. `mainLifts` as Today's.
  `hasData: false`: `muscles: null`, `mainLifts: []` and `emptyText`.

### Lift: `GET /api/app/lift…`

The web's `/lift` pages: the overview, the weekly volume, one session (read-only, for finished sessions), and one
exercise. Routes through `appRoute` (`src/lib/app-api/route.ts`: token, owner, `tz`, errors). Loaders
`src/lib/lift-dashboard/app-api.ts`; shapes `src/lib/lift-dashboard/app-api.mjs`; text from `src/lib/lift-dashboard/text.mjs`, which the web
pages also use. The Lift rows come through the `lift` data cache, which each applied sync push clears (`WEEK-API.md`).
Weights are in the web's display unit `unit` (`kg | lb`: the unit most logged sets use); every weight text has it.

| Path | Web page | Params | Size (2026-10, 57 sessions) |
| --- | --- | --- | --- |
| `/api/app/lift?tz=` | `/lift` | `tz` decides today | about 66 KB |
| `/api/app/lift/weekly` | `/lift/weekly` | — | about 12 KB |
| `/api/app/lift/sessions/{id}?tz=` | `/lift/sessions/[id]` | a session id (any case) or `latest`; `tz` for the start time | 14–20 KB |
| `/api/app/lift/exercises/{key}` | `/lift/exercises/[key]` | an `exerciseKey`, URL-encoded | about 8 KB |

Errors: a malformed `id` or `key` `400`; an unknown session, or an exercise with no logged sets, `404 {"error":"not
found"}` (also `latest` with no sessions).

**Links.** `sessionId`: a lower-case session id, for `/api/app/lift/sessions/{id}` (a planned one too; the phone opens
its own workout screen for a session it has and that is not finished). `exerciseKey`: `id-<library id>` or
`name-<lower-case name>`, for `/api/app/lift/exercises/{key}`.

#### Overview: `GET /api/app/lift?tz=`

Trimmed real response (lists cut to one or two entries):

```json
{
  "generatedAt": "2026-10-20T21:03:45.321Z", "timeZone": "America/Los_Angeles", "today": "2026-10-20", "unit": "lb",
  "empty": null,
  "week": {
    "ok": true, "title": "This week · Oct 19–Oct 25", "done": 0, "target": 2, "doneText": "0 / 2",
    "caption": "strength sessions", "progress": 0, "targetMet": false,
    "days": [
      { "date": "2026-10-19", "letter": "M", "state": "none", "today": false, "sessionId": null, "label": "Monday" },
      { "date": "2026-10-20", "letter": "T", "state": "planned", "today": true,
        "sessionId": "ca4f651b-98c7-4765-83a9-07ab74435d69", "label": "Tuesday: Heavy barbell planned" }
    ],
    "stats": [
      { "id": "sets", "label": "Sets", "value": "0", "detail": "hard sets this week", "flame": false },
      { "id": "volume", "label": "Volume", "value": "0 lb", "detail": "reps × weight", "flame": false },
      { "id": "last", "label": "Last lift", "value": "21 days ago", "detail": "Workout C · Sep 29", "flame": false },
      { "id": "streak", "label": "Streak", "value": "0 weeks", "detail": "at 2+ a week", "flame": false }
    ],
    "next": { "sessionId": "ca4f651b-98c7-4765-83a9-07ab74435d69", "date": "2026-10-20", "title": "Heavy barbell",
              "whenText": "Next up · today", "detail": "9 exercises · 25 sets planned" },
    "nextEmptyText": "No Lift session planned. Put one on the plan, or start one from a template in Lift."
  },
  "tips": {
    "ok": true, "title": "Coach notes",
    "items": [
      { "id": "gap", "tone": "warn", "title": "21 days since your last lift", "body": "Ease back in: 2 sets per exercise …",
        "link": { "kind": "session", "sessionId": "d5a25b33-32e0-5bcd-bc53-5f17cb084120" } },
      { "id": "stalled", "tone": "info", "title": "Overhead triceps extension and Back squat have stalled", "body": "No new best …",
        "link": { "kind": "exercise", "exerciseKey": "id-4c494654-0000-4000-8000-000000000019" } }
    ]
  },
  "lifts": {
    "ok": true, "caption": "estimated 1RM per session · dashed line is your best", "emptyText": "No lifts in the last 12 weeks.",
    "items": [
      { "exerciseKey": "id-4c494654-0000-4000-8000-000000000019", "name": "Overhead triceps extension",
        "sessions": 9, "sessionsText": "9 sessions", "newBest": false, "e1rm": 60, "e1rmText": "60",
        "change": -0.211, "changeText": "▼ 21% in 12 weeks", "best": 76,
        "points": [{ "date": "2026-09-29", "sessionId": "d5a25b33-32e0-5bcd-bc53-5f17cb084120", "e1rm": 60,
                     "label": "Sep 29: 45 × 10, e1RM 60" }],
        "chartEmptyText": null, "lastText": "Last 45 lb × 10 · Sep 29", "bestText": "Best 76 · Aug 3" }
    ]
  },
  "muscles": {
    "ok": true, "title": "Hard sets per muscle", "caption": "10–20 a week grows a muscle. Primary muscle 1 set, secondary ½.",
    "band": { "min": 10, "max": 20 }, "scaleMax": 24,
    "arms": [{ "muscle": "biceps", "name": "Biceps", "arm": true, "week": 0, "weekText": "0", "avg": 1.9, "avgText": "1.9",
               "status": "below", "label": "Biceps: 0 sets this week, 1.9 a week on average, below the 10 to 20 range" }],
    "other": [{ "muscle": "back", "name": "Back", "arm": false, "week": 0, "weekText": "0", "avg": 3, "avgText": "3",
                "status": "below", "label": "…" }]
  },
  "sessions": {
    "ok": true, "caption": "57 logged · volume = reps × weight, warm-ups out", "shown": 8,
    "upcoming": [{ "sessionId": "ca4f651b-98c7-4765-83a9-07ab74435d69", "date": "2026-10-20", "title": "Heavy barbell",
                   "badge": "Today", "detail": "Tue, Oct 20 · 25 sets" }],
    "logged": [{ "sessionId": "d5a25b33-32e0-5bcd-bc53-5f17cb084120", "date": "2026-09-29", "weekdayText": "Tue",
                 "dayText": "29", "monthText": "Sep", "title": "Workout C", "meta": "6 exercises · 18 sets · 43 min",
                 "sets": 18, "exercises": 6, "minutes": 43, "volume": 6440, "volumeText": "6,440", "volumeUnit": "lb",
                 "relative": 0.249, "muscles": ["Shoulders", "Triceps", "Biceps"], "prs": [], "prText": null }]
  },
  "exercises": {
    "ok": true, "title": "All exercises", "count": 56,
    "items": [{ "exerciseKey": "id-4c494654-0000-4000-8000-000000000006", "name": "Dumbbell bench press", "sessions": 10,
                "detail": "10 sessions · last Sep 29", "bestText": "63 lb" }]
  },
  "consistency": {
    "ok": true, "caption": "16 weeks",
    "stats": [{ "id": "hits", "value": "3/8", "label": "weeks at target" },
              { "id": "avg", "value": "1.1", "label": "a week, 8 wks" },
              { "id": "total", "value": "57", "label": "sessions logged" }],
    "hits": 3, "avg": 1.1, "total": 57,
    "heatmap": [{ "start": "2026-10-19", "monthText": null,
                  "days": [{ "date": "2026-10-20", "sets": 0, "level": 0, "future": false, "today": true,
                             "sessionId": null, "label": "Tue, Oct 20" }] }],
    "weeks": { "target": 2, "scaleMax": 3, "caption": "line = target 2",
               "items": [{ "week": "2026-10-19", "sessions": 0, "sets": 0, "met": false,
                           "label": "Week of Oct 19: 0 sessions, 0 sets" }] }
  },
  "records": {
    "ok": true, "title": "Recent records", "caption": "estimated 1RM",
    "emptyText": "No records yet. They appear when a set beats every earlier session.",
    "items": [{ "exerciseKey": "id-4c494654-0000-4000-8000-000000000009", "sessionId": "7b20985d-d7fc-5c26-8c08-61a08eb1bd1a",
                "name": "Dumbbell shoulder press", "date": "2026-09-25", "detail": "28 lb × 8 · Sep 25",
                "e1rm": 34.8, "e1rmText": "35", "gainText": "+3 lb" }]
  }
}
```

Field rules:

- `empty`: not `null` when no session is logged; the phone shows `empty.title` and `empty.body` in place of the
  sections (the web's "No sessions yet").
- `week.days`: always 7, Monday first. `state`: `done` (a logged session), `planned` (a planned Lift session, not yet
  logged), `none`. `sessionId`: the logged session, else the planned one, else `null`. `label`: for accessibility.
  `progress`: 0–1; `targetMet`: the web colors the bar green. `stats`: always 4; `flame`: a streak of 2+ weeks.
  `next`: the first planned session from today; `null`: show `nextEmptyText`.
- `tips.items`: most pressing first. `tone`: `good | warn | info`. `link`: `{ kind: "session", sessionId }`,
  `{ kind: "exercise", exerciseKey }`, `{ kind: "week" }` (the Week tab), `{ kind: "section", section }` (a section of
  this screen: `muscles | records | consistency | sessions`), or `null` (the web links to Health, as the protein tip, or nothing).
- `lifts.items`: at most 6 (the most-done lifts of 12 weeks). `points`: the best e1RM per session, oldest first, at
  most 16; `best`: the all-time best e1RM (the web's dashed line). `chartEmptyText`: not `null` with fewer than 2
  points (show it in place of the chart). `newBest`: the web's "New best" badge (in place of `sessionsText`).
  `change`: a ratio (−0.211), `null` with one session in 12 weeks; `changeText` then `null` too.
- `muscles`: `arms` (biceps, triceps), then `other` (major muscles always, others with sets). `week`: hard sets this
  week (a primary muscle counts 1, a secondary ½); `avg`: the weekly average of the 4 weeks before (the web's tick).
  `status` of `avg` against `band`: `below | inRange | above`. Draw bars on 0…`scaleMax`.
- `sessions.upcoming`: up to 3 planned sessions from today. `logged`: every logged session, newest first; the web
  shows the first `shown` and folds the rest. `relative`: volume against the largest session, 0–1. `prs`: exercise
  names with a record in that session.
- `exercises.items`: every exercise with a logged set, the most recent first (the web folds the list).
- `consistency.heatmap`: 16 weeks, oldest first, each with 7 days Monday first. `level`: 0 none, 1 below 8 sets, 2
  8+, 3 14+, 4 20+ (the web's 40/60/80/100 % strength color). `future` days are faded. `monthText`: the column's
  month label, where the month changes. `weeks.items`: sessions per week for the same 16 weeks; `met`: full color.
- `records.items`: the 8 latest records (a session's best e1RM above every earlier session), newest first.
- A section fails alone: `{ "ok": false }`. When the Lift rows cannot load, every section is `{ "ok": false }`.

#### Weekly volume: `GET /api/app/lift/weekly`

```json
{
  "generatedAt": "2026-10-20T21:03:45.974Z", "unit": "lb",
  "weeks": {
    "ok": true, "title": "Weekly volume",
    "caption": "Weeks start on Monday. Volume = reps x logged weight over logged sets, warm-ups excluded, in lb.",
    "emptyText": "No sessions yet.",
    "items": [
      { "week": "2026-09-28", "weekText": "Mon, Sep 28, 2026", "sessions": 1, "sets": 18, "volume": 6440,
        "volumeText": "6,440 lb", "relative": 0.249 }
    ]
  }
}
```

- `items`: newest first, from the latest week with a logged session back to the first one, empty weeks included
  (all zero). `relative`: volume against the largest week, 0–1 (the web's bar). `[]`: show `emptyText`.

#### Session: `GET /api/app/lift/sessions/{id}?tz=`

```json
{
  "generatedAt": "2026-10-20T21:03:46.996Z", "timeZone": "America/Los_Angeles",
  "id": "ca4f651b-98c7-4765-83a9-07ab74435d69", "unit": "lb",
  "olderId": "004c7644-399d-44f4-9a61-8dea412c70c9", "newerId": "704c31ca-c04b-478b-802b-2f2219cad990",
  "hero": {
    "ok": true, "kicker": "Strength · Tue, Oct 20, 2026", "date": "2026-10-20", "dateText": "Tue, Oct 20, 2026",
    "startText": null, "title": "Heavy barbell", "note": null, "state": "planned", "stateLabel": "Planned",
    "stats": [
      { "id": "exercises", "label": "Exercises", "value": "9", "detail": null },
      { "id": "sets", "label": "Sets", "value": "0 / 25", "detail": "logged" },
      { "id": "plannedVolume", "label": "Planned volume", "value": "18,318 lb", "detail": null },
      { "id": "volume", "label": "Logged volume", "value": "0 lb", "detail": "warm-ups excluded" },
      { "id": "duration", "label": "Duration", "value": "–", "detail": null }
    ],
    "ring": { "logged": 0, "total": 25, "progress": 0, "text": "0/25", "caption": "sets logged" },
    "muscles": [{ "muscle": "back", "name": "Back", "sets": 8, "setsText": "8", "relative": 1 },
                { "muscle": "glutes", "name": "Glutes", "sets": 7, "setsText": "7", "relative": 0.875 }]
  },
  "exercises": {
    "ok": true, "emptyText": "This session has no exercises.",
    "items": [{
      "id": "543a30ee-4b76-4223-8cb7-73f5e2c35410", "exerciseKey": "id-4c494654-0000-4000-8000-000000000001",
      "indexText": "Exercise 1", "name": "Back squat", "setsText": "0/3 sets", "complete": false,
      "muscles": ["Quads", "Glutes"], "secondaryMuscles": ["Hamstrings", "Core"], "equipment": "Barbell",
      "loadNote": null, "restText": "3:00 rest", "note": "Warm up, about 12 min. …",
      "sets": [
        { "id": "01ee58bf-223d-4d80-9650-9b6b322a06a1", "label": "Set 1", "kind": "working", "status": "planned",
          "text": "230 lb × 5", "targetText": null, "beatTarget": false, "rpe": null, "rpeText": null, "note": null }
      ],
      "lastTime": { "sessionId": "7b20985d-d7fc-5c26-8c08-61a08eb1bd1a", "date": "2026-09-25",
                    "title": "Last time · Sep 25", "delta": -25, "deltaText": "−25 lb vs last",
                    "sets": ["255 lb × 8", "255 lb × 8", "255 lb × 8"] },
      "lastTimeEmptyText": null,
      "best": { "e1rm": 340, "text": "340 lb", "date": "2026-05-28", "dateText": "May 28" },
      "trend": { "values": [323, 323, 310.3, 323, 323, 323, 323, 323, 323, 323], "caption": "e1RM · last 10 sessions" },
      "steps": ["Stand with your feet shoulder-width apart, toes slightly turned out."],
      "media": { "image": "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/7455efae…/images/0043-qXTaZnJ.jpg",
                 "gif": "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/7455efae…/videos/0043-qXTaZnJ.gif" }
    }]
  }
}
```

- `olderId` / `newerId`: the sessions before and after this one (planned sessions too), `null` at the ends.
- `hero.state`: `planned | inProgress | done`; `stateLabel` its text. `kicker`: day and, once started, the start
  time in `tz`. `stats`: always 5. `ring.progress`: 0–1. `muscles`: up to 8, most sets first; `relative` against the
  first.
- `exercises.items`: in the session's order. `complete`: every working set logged (the web's check mark).
  `muscles` / `secondaryMuscles` / `equipment`: the library's, else the bundled catalog's; `equipment` `null` when
  unknown. `loadNote`: "Load each hand" / "Load each side" or `null`. `restText`, `note`: `null` when unset.
- `sets`: in order, warm-ups first. `label`: "Warm-up" or "Set n" (working sets counted). `status`:
  `planned | done | skipped`. `text`: once `done` the logged load × reps ("+12.5 lb × 8" or "BW × 8" on bodyweight
  work), else the target ("230 lb × 5", "35 kg × 8–10", "–"); `targetText`: "target …" under a done set, else `null`.
  `beatTarget`: logged weight above the target (the web's "↑"). `rpe`: 6–10 or `null`; `rpeText` "RPE 8.5".
  A skipped set shows `text` struck through.
- `lastTime`: the last earlier session with this exercise, `null` the first time (show `lastTimeEmptyText`).
  `deltaText`: today's top target against last time's heaviest set; `null` when equal or unknown.
- `best` and `trend` (the e1RM sparkline, oldest first, at most 10): `null` for bodyweight work, as the web; `trend`
  also `null` with fewer than 2 earlier sessions.
- `media`: the catalog picture and animation, full URLs (pinned dataset commit); `null` without a catalog match.
  `steps`: the catalog's how-to, `[]` when none. The catalog itself stays on the server.

#### Exercise: `GET /api/app/lift/exercises/{key}`

```json
{
  "generatedAt": "2026-10-20T21:03:55.564Z", "unit": "lb",
  "exerciseKey": "id-4c494654-0000-4000-8000-000000000019", "name": "Overhead triceps extension",
  "stats": { "ok": true, "items": [
    { "id": "sessions", "label": "Sessions", "value": "24", "detail": null },
    { "id": "sets", "label": "Logged sets", "value": "74", "detail": "Warm-ups excluded" },
    { "id": "heaviest", "label": "Heaviest set", "value": "60 lb", "detail": null },
    { "id": "best", "label": "Best est. 1RM", "value": "76 lb", "detail": null } ] },
  "chart": {
    "ok": true, "title": "Estimated 1RM over time",
    "caption": "Best set per session, Epley: weight x (1 + reps / 30), 1 to 12 reps, in lb.",
    "emptyText": "No sets with weight and 1 to 12 reps.",
    "points": [{ "date": "2026-09-29", "sessionId": "d5a25b33-32e0-5bcd-bc53-5f17cb084120", "e1rm": 60,
                 "label": "Tue, Sep 29, 2026: 60 lb est. 1RM (45 lb x 10)" }]
  },
  "sessions": { "ok": true, "items": [
    { "date": "2026-09-29", "dateText": "Tue, Sep 29, 2026", "sessionId": "d5a25b33-32e0-5bcd-bc53-5f17cb084120",
      "bestSetText": "45 lb x 10", "e1rm": 60, "e1rmText": "60 lb" } ] },
  "bestSets": { "ok": true, "title": "Best sets", "caption": "Top sets by estimated 1RM.", "items": [
    { "date": "2026-08-11", "dateText": "Tue, Aug 11, 2026", "sessionId": "6156ec87-fc83-5f6a-9244-eb8a7c3f6582",
      "weightText": "60 lb", "repsText": "8", "e1rm": 76, "e1rmText": "76 lb" } ] }
}
```

- `stats.items`: always 4. `chart.points`: the best e1RM per session, oldest first, at most 120 (longer histories
  are downsampled, first and last kept); `[]`: show `emptyText` and hide `sessions`. `sessions.items`: every session
  with an e1RM, newest first. `bestSets.items`: the top 10 sets by e1RM. Bodyweight exercises show their added load,
  as the web page.

### Activities: `GET /api/app/activities…`

The Strava activities: a list to browse, and the web's activity page (`/activities/[id]`). Shaping:
`src/lib/activity/app-api.mjs` (tests: `app-api.test.mjs`), loaders `src/lib/activity/app-api.ts`; the display text
comes from `src/lib/activity/view.mjs`, which the web page uses too. Read-only: the web page asks Strava for missing
parts (a POST); the detail route starts the same fetch itself (see `header.fetch`).

#### List: `GET /api/app/activities?before=<activityId>&limit=30&tz=`

- `limit`: 1–100, default 30. `before`: the `nextCursor` of the page before (an `activityId`); missing: the newest.
  A malformed `limit` or `before`: `400`. A `before` that is not one of the owner's activities: `404 {"error":"not found"}`.
- Newest first (`start_date`, then row id). `nextCursor`: `null` on the last page.

```json
{
  "generatedAt": "2026-10-20T21:03:42.893Z", "timeZone": "America/Los_Angeles", "today": "2026-10-20",
  "activities": [
    {
      "activityId": "20614350022", "name": "Morning Run", "sport": "run", "sportType": "Run", "typeText": "Run",
      "startLocal": "2026-10-17T07:15:54", "day": "2026-10-17", "startText": "Sat, Oct 17 · 7:15 AM",
      "distance": 12010.4, "distanceText": "12.01 km", "movingSeconds": 4038, "durationText": "1:07:18",
      "speed": 2.974, "paceText": "5:36 /km", "speedText": null, "tss": 84, "tssText": "84 TSS",
      "indoor": false, "commute": false, "plannedTitle": null,
      "subtitle": "12.01 km · 1:07:18 · 5:36 /km · 84 TSS"
    }
  ],
  "plannedOk": true,
  "nextCursor": "19944258397"
}
```

- `sport`: an id from `design/sports.json` (`sportOfStrava`). `typeText`: Strava's type in words ("Virtual ride").
- `startLocal`/`startText`: the activity's own clock (where it happened), not `tz`.
- `paceText` for foot sports (run, hike, walk), `speedText` for rides, both `null` otherwise. `distanceText` is
  `null` at 0 m (strength). `tss`/`tssText`: `null` without TSS. `subtitle` joins the texts that are present.
- `indoor`: Strava's `trainer` flag (Zwift rides often have it `false`). `commute`: Strava's flag.
- `plannedTitle`: the plan workout this activity completed (the calendar's matching, `loadRange`), without its emoji;
  `null` when none. `plannedOk: false`: that lookup failed, so every `plannedTitle` is `null`; the list still shows.
- Open a row with the detail endpoint below (`activityId`).

#### Detail: `GET /api/app/activities/{id}?tz=`

- `id`: what the web accepts: a Strava id, a Coach row id, or `latest` (the newest). Not `[A-Za-z0-9_-]{1,40}`: `400`;
  no such activity: `404 {"error":"not found"}`.
- `tz` decides `today` (the plan's state for the compliance). Times of day come from the activity's own clock.
- The sections are in the web's page order. Each is `{ "ok": true, … }`, `{ "ok": false }` (it failed: show the
  web's "could not load" row), or `null` (this activity does not have it: hide it). `coach` and `sameRoute` come from
  one loader (`loadActivityContext`), so they fail together.
- Measured on production: 2–14 KB without streams, 33 KB (Zwift ride), 38 KB (4:48 h ride with power), 45 KB (run
  with pace, GAP, HR, cadence, power, temperature, 16 laps, 9 segments).

Trimmed response (a run; arrays cut):

```json
{
  "generatedAt": "2026-10-20T21:05:10.000Z", "timeZone": "America/Los_Angeles", "today": "2026-10-20",
  "activityId": "20614350022",
  "header": {
    "ok": true, "activityId": "20614350022", "name": "Morning Run", "sport": "run", "sportType": "Run", "typeText": "Run",
    "startLocal": "2026-10-17T07:15:54", "day": "2026-10-17", "whenText": "Saturday, October 17, 2026 at 7:15 AM",
    "place": "Kyoto, Japan", "indoor": false, "commute": false, "outdoor": true,
    "subtitle": "Saturday, October 17, 2026 at 7:15 AM · Kyoto, Japan · Run",
    "description": null, "prevId": "20577277152", "nextId": "20655239904",
    "stravaUrl": "https://www.strava.com/activities/20614350022",
    "fetch": { "pending": false, "note": null }
  },
  "overview": {
    "ok": true,
    "big": [{ "label": "Distance", "valueText": "12.01", "unit": "km" }, { "label": "Moving Time", "valueText": "1:07:18" }, { "label": "Pace", "valueText": "5:36", "unit": "/km" }],
    "small": [{ "label": "Elevation", "valueText": "56", "unit": "m" }, { "label": "Calories", "valueText": "920" }],
    "grid": [{ "label": "Distance", "valueText": "12.01", "unit": "km" }, { "label": "Pace", "valueText": "5:36", "unit": "/km" }],
    "more": [{ "label": "Elapsed Time", "valueText": "1:09:02" }, { "label": "Calories", "valueText": "920" }],
    "achievementsText": "7 PRs · 7 achievements · 4 kudos"
  },
  "weather": { "ok": true, "headline": "Clear, 16 °C", "rows": [{ "label": "Wind", "valueText": "3.9 km/h NNW" }], "source": "Open-Meteo, the hour nearest the start" },
  "equipment": { "ok": true, "device": "Garmin fēnix 7S Pro", "gear": { "label": "Shoes", "name": "Nike AlphaFLY", "distanceText": "(1,464 km)" } },
  "splits": { "ok": true, "note": null, "rows": [{ "index": 1, "distance": 1000.2, "speed": 3.04, "gapSpeed": 3.11, "label": "1", "paceText": "5:29", "gapText": "5:22", "elevText": "+3", "hrText": "137" }] },
  "route": { "ok": true, "points": [[34.99831, 135.76627], [34.99827, 135.76625]] },
  "sameRoute": null,
  "coach": {
    "ok": true,
    "planned": null,
    "plannedEmptyText": "Not matched to a planned workout.",
    "load": {
      "tss": 84, "method": "hr", "tssText": "84", "methodText": "from average heart rate", "emptyText": null,
      "rows": [{ "key": "ctl", "label": "Fitness (CTL)", "value": 54, "valueText": "54 (+0.7)" }, { "key": "tsb", "label": "Form (TSB)", "value": 6, "valueText": "+6 fresh (−5.3)" }]
    },
    "garmin": { "day": "2026-10-17", "emptyText": null, "rows": [{ "key": "sleep", "label": "Sleep the night before", "value": 82, "valueText": "82 · 6:29 h" }, { "key": "hrv", "label": "HRV (night)", "value": 103, "valueText": "103 ms" }] }
  },
  "analysis": {
    "ok": true, "points": 300, "smoothingS": 30, "note": "Pace is upside down: faster is higher.", "emptyText": null,
    "x": { "distanceKm": [0.011, 0.039, 0.081], "timeS": [0, 12, 24] },
    "streams": [
      { "key": "pace", "label": "Pace", "unit": "/km", "values": [516, 403, 322], "avg": 336.25, "avgText": "5:36", "invert": true },
      { "key": "gap", "label": "GAP", "unit": "/km", "values": [524, 394, 313], "avg": 333, "avgText": "5:33", "invert": true, "overlayOf": "pace" },
      { "key": "hr", "label": "Heart rate", "unit": "bpm", "values": [94, 104, 116], "avg": 145.4, "avgText": "145" },
      { "key": "alt", "label": "Elevation", "unit": "m", "values": [38, 38, 38], "avg": null, "avgText": null, "area": true }
    ]
  },
  "paceBars": {
    "ok": true, "title": "Pace Analysis", "unit": "/km", "hasGap": true,
    "modes": [
      { "key": "splits", "avg": 2.956, "avgText": "5:38", "gapAvg": 2.985, "gapAvgText": "5:35",
        "bars": [{ "label": "Km 1", "width": 1000.2, "value": 3.04, "valueText": "5:29", "gap": 3.11, "gapText": "5:22", "timeText": "5:29", "distanceText": "1.00", "hrText": "137" }] },
      { "key": "laps", "avg": 2.949, "avgText": "5:39", "gapAvg": 2.98, "gapAvgText": "5:36", "bars": [] },
      { "key": "smoothed", "timeS": [0, 12, 24], "values": [2.43, 2.7, 2.73], "gapValues": [2.48, 2.75, 2.77] }
    ]
  },
  "paceHistogram": {
    "ok": true, "note": "Moving time per 15 s of pace", "unit": "/km", "avgIndex": 12, "avgText": "avg 5:36",
    "bins": [{ "fromS": 330, "toS": 345, "label": "5:30", "seconds": 1296, "timeText": "21:36", "percent": 32 }]
  },
  "relativeEffort": {
    "ok": true, "sufferScore": 17, "trimp": 117, "tss": 84, "note": null,
    "stats": [{ "label": "Relative Effort (Strava)", "valueText": "17" }, { "label": "TRIMP (from HR)", "valueText": "117" }, { "label": "Coach TSS", "valueText": "84" }, { "label": "TSS per hour", "valueText": "75" }]
  },
  "heartRate": {
    "ok": true, "note": "Strava's zones · avg 145 bpm · max 156 bpm",
    "zones": [{ "zone": 2, "name": "Moderate", "min": 122, "max": 153, "rangeText": "123–153 bpm", "timeText": "1:04:44", "seconds": 3884, "percent": 96 }]
  },
  "power": null,
  "laps": { "ok": true, "hasPower": true, "hasGap": true, "rows": [{ "index": 1, "name": "Lap 0", "distance": 1000, "movingSeconds": 330, "speed": 3.03, "distanceText": "1.00 km", "timeText": "5:30", "paceText": "5:30 /km", "gapText": "5:14 /km", "elevText": "7 m", "hrText": "137 bpm", "powerText": "369 W" }] },
  "bestEfforts": { "ok": true, "note": "From Strava", "rows": [{ "label": "1K", "distance": 1000, "seconds": 320, "prRank": null, "timeText": "5:20", "paceText": "5:20 /km", "rankText": "" }] },
  "segments": { "ok": true, "count": 9, "note": "9 segments · PRs and top 10s first", "rows": [{ "id": "12179678", "name": "Shijo-Imadegawa", "distance": 2800.5, "seconds": 933, "prRank": 1, "komRank": null, "distanceText": "2.80 km", "gradeText": "0.4%", "timeText": "15:33", "paceText": "5:33 /km", "hrText": "150", "rankText": "PR" }] }
}
```

A ride with power (Saturday, October 3, 102 km) has `power`, no `paceHistogram`, and other rides on its route:

```json
"power": {
  "ok": true, "ftp": 280, "ftpText": "FTP 280 W",
  "curve": [{ "seconds": 5, "label": "5s", "durationText": "0:05", "watts": 643, "wattsText": "643 W", "ftpPercent": 230 }],
  "zones": [{ "zone": 2, "name": "Endurance", "min": 155, "max": 210, "rangeText": "156–210 W", "timeText": "1:13:10", "seconds": 4390, "percent": 30 }]
},
"sameRoute": {
  "ok": true, "title": "Activities on this route", "note": "same start within 250 m, distance within 10 %, fastest first",
  "rows": [{ "activityId": "16536988096", "isThis": false, "day": "2025-11-22", "name": "Scribe", "distance": 100391, "movingSeconds": 12729, "distanceText": "100.3 km", "timeText": "3:32:09", "paceText": "28.4 km/h" }]
}
```

Field rules:

- `header.fetch`: `pending: true` when Coach has not stored an older activity's details or streams yet. The server
  never calls Strava for this request: the Strava webhook stores a new activity in full (detail, streams, weather)
  a few seconds after it reaches Strava, before the "workout completed" notice, and the 3-hourly Strava sync fills in
  older activities. `note` is then "The details of this older activity are still being imported." After a failed
  import, `note` is the web's text (rate limit, or the error) and `pending` is `false`. Show `note` under the header.
- `header.prevId`/`nextId`: the older and newer activity (`activityId`), `null` at the ends. `stravaUrl` is the only
  URL: the "Open on Strava" button. `description`: Strava's text, line breaks kept.
- `overview.big`/`small`: `{ label, valueText, unit? }`, shown as they are, in this order (the web's stat tiles).
  `overview.grid`: the phone's headline stats, at most 6, in the sport's order (run: distance, pace, moving time,
  elevation, average heart rate, Coach TSS; ride: distance, moving time, speed, elevation, power, Coach TSS), filled
  with other stats when one is missing. `overview.more`: every other stat of `big` and `small`, in their order.
- `header.outdoor`: the activity has a real track (not a trainer ride, not a `Virtual…` sport): the phone leads the
  page with the route map.
  `achievementsText`: `null` without PRs, achievements or kudos.
- `weather`, `equipment` (`device` and `gear` are each `null` when unknown), `splits` (foot sports only), `route`
  (at least 2 points), `sameRoute` (other activities of the same sport on the route; the row with `isThis` is this
  activity, not a link): `null` when absent.
- `route.points`: `[lat, lng]`, 5 decimals, at most 500 (Douglas–Peucker with the smallest tolerance that fits).
- `coach.planned`: `null` when no plan workout matched (show `plannedEmptyText`). `compliance.level`:
  `good | done | partial | off | …` (`complianceOf`, the web's `ComplianceMark` colours); `label` is its text. `ratioText`: `null` without a ratio.
  `load.rows`: CTL, ATL, TSB after the activity's day, with the change from the day before in brackets, and "TSS
  that day" when other activities added to it; `[]` with `emptyText` when there is no load row. `garmin.rows`: the
  values Garmin has (`value` raw, `valueText` as the web); `[]` with `emptyText` when none.
- `analysis`: always present. `x.distanceKm` (`null` without a distance stream; carried over gaps, so it never
  falls) and `x.timeS` (seconds from the start) have `points` entries; so does every `streams[].values` (a value can
  be `null`: a gap in the line). Values are smoothed with the web's default 30 s window, then averaged into 300
  buckets. Only the streams the activity has, in the web's panel order: `pace` (s/km, `invert`) with its `gap`
  overlay (`overlayOf: "pace"`) for foot sports, `speed` (km/h) for others, `watts`, `hr`, `cad` (`spm` on foot,
  `rpm` otherwise), `temp` (not smoothed), `alt` (not smoothed, `area`). `avg`/`avgText`: the web's average label,
  `null` when none. No streams: `streams: []`, `x: null`, and `emptyText` says why.
- `paceBars`: rides and foot sports with splits, laps or speed. `modes` in the web's toggle order: `splits`, `laps`
  (with 2 or more laps), `smoothed` (60 s speed and GAP in m/s on `timeS`, `null` below 0.5 m/s). A bar's `width`
  is its distance in meters (for a lap without distance: its seconds); its height is `value` (m/s, faster is
  taller); `valueText` is pace (foot) or km/h. `gap`/`gapText`: foot sports only. `avg`: the mean of the bar values,
  the web's dashed line.
- `paceHistogram`: foot sports with a speed stream. Bins of 15 s/km, fastest first. `percent` adds up to 100.
  `avgIndex`: the bin with the average pace, `null` when outside the bins.
- `heartRate` (when the zones have time) and `power.zones`: Z1 first (the web lists the top zone first);
  `percent` is whole and adds up to 100 (largest remainder, `percents()` in `format.mjs`, as the web).
  `power`: rides with a power meter. `power.curve`: `[]` with fewer than 2 points.
- `laps`: 2 or more laps. `powerText` is "–" for a lap without power; hide the column when `hasPower` is false, and
  the GAP column when `hasGap` is false.
- `segments.rows`: the top 15 (PRs and top-10 ranks first, then ride order); `count` is the total. The web's
  "All segments" list is not sent.
- Not sent: the web's range highlights (a lap or segment on the charts and the map), the map's crosshair dot, links
  to Strava segments, and the Health day link.

### Planned workout: `GET /api/app/plan/{id}?tz=`

One planned workout as the web's workout window shows it (`PlannedModal.tsx`, `PlannedDetails.tsx`); the Week tab
opens it for a planned workout that is not a Lift session. `id` is the Week API item's `id`. Built by `appWorkout`
(`src/lib/plan/app-workout.mjs`) from the same `loadRange` row as the web. `404` when the owner has no such workout.

```json
{
  "id": "…", "date": "2026-10-21", "title": "Threshold A — Zwift", "sport": "ride", "sportLabel": "Ride",
  "subtitle": "Ride · Wednesday, October 21 · 07:00",
  "state": "today", "stateLabel": "Today", "compliance": null, "adapted": false,
  "hero": [{ "label": "Planned time", "valueText": "1:30", "unit": null }, { "label": "Planned TSS", "valueText": "95", "unit": null }],
  "workout": {
    "summaryText": "1:30:00 · 95 TSS · IF 0.79",
    "keyTargets": [{ "text": "6 × 5:00 at 254–276 W, 2:00 easy", "zone": "Z4" }],
    "profile": [{ "seconds": 600, "from": 0.6, "to": 0.6, "zone": "Z2" }],
    "ticks": [{ "at": 0, "text": "0" }, { "at": 0.33, "text": "30" }],
    "steps": [
      { "kind": "step", "length": "10:00", "label": "Warm-up", "target": "157–210 W", "zone": "Z2" },
      { "kind": "repeat", "label": "6 ×", "steps": [{ "kind": "step", "length": "5:00", "label": "Work", "target": "254–276 W", "zone": "Z4" }] }
    ],
    "zones": { "basis": "by power", "items": [{ "zone": "Z1", "seconds": 600, "timeText": "10", "percent": 11 }] }
  },
  "intensity": null, "notes": "Coach notes (the text above the Lift session block)",
  "liftSessionId": null, "done": { "activityId": "16234567890", "name": "Morning Ride" }
}
```

- `hero`: planned time, TSS and IF, then done time and TSS once done (as the web's hero row).
- `workout`: `null` without structured steps. `profile` is the Week API's bars; `ticks` place the time labels along
  the chart (0…1). `steps` nest one level for repeats. `zones` is the web's "Time in zones" (`null` with no time).
- `done.activityId`: the Strava activity to open (`null` for a Lift match); `done` is `null` until done.

### Weigh-in: `GET /api/app/weigh-ins/{date | latest}`

The screen a weigh-in notice opens (lift/PUSH.md, `lift://weigh-in/<date>`). `date` is `YYYY-MM-DD`; `latest` is the
last day with a weight. `404` when that day has no weight.

```json
{
  "date": "2026-10-22", "dateText": "Thursday, Oct 22",
  "weight": { "kg": 83.2, "text": "83.2", "unit": "kg" },
  "bodyFat": { "pct": 18.4, "text": "18.4 %" },
  "changes": [
    { "id": "previous", "label": "Since yesterday", "kg": -0.3, "text": "▼ 0.3 kg", "tone": "good", "noteText": "83.5 kg on Oct 21" },
    { "id": "4w", "label": "4 weeks", "kg": -1.4, "text": "▼ 1.4 kg", "tone": "good", "noteText": "-0.35 kg a week" }
  ],
  "series": [{ "date": "2026-09-22", "kg": 84.6 }, { "date": "2026-10-22", "kg": 83.2 }],
  "source": "renpho", "recordedAt": "2026-10-22T14:05:00.000Z",
  "newerDate": null, "olderDate": "2026-10-21"
}
```

- `weight.kg` 2 decimals, `text` 1 decimal. `bodyFat`: `null` when the day has none.
- `changes`: `previous` against the last earlier weigh-in at any distance, `4w` against the last weigh-in 28 or
  more days before (the web's Health card). Either is left out when there is nothing to compare. `tone`: `good`
  (down), `bad` (up), `neutral`; the goal is losing fat (COACH.md).
- `series`: every weigh-in in the 12 weeks up to `date`, oldest first, 1 decimal.
- `source`: the sample's source (`renpho`, `garmin`, `apple_health`, …). `recordedAt`: when the day's weight was
  stored. `newerDate` / `olderDate`: the next and previous days with a weight, `null` at the ends.
