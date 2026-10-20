# Coach API

The one contract between Coach (this repo's Next.js app, https://coach.paolobernasconi.com) and its clients: the
web pages, the Lift iPhone app (`lift/`) and the Dia start page (`pbernasconi/dia-home`). The Neon database behind
Coach is the only source of truth; every client reads or writes through these routes.

| Route | Auth | Used by | What |
| --- | --- | --- | --- |
| `GET /api/home?tz=` | `Bearer HOME_TOKEN` | Dia start page | Today, the week plan, activities, Lift, form, targets, calendar events, sync warnings |
| `POST /api/lift/sync/push` | `Bearer LIFT_SYNC_TOKEN` | Lift | Outbox changes (lift/SYNC.md) |
| `GET /api/lift/sync/pull?cursor=&limit=` | `Bearer LIFT_SYNC_TOKEN` | Lift | Changes since a cursor (lift/SYNC.md) |
| `POST /api/lift/enroll` | one-time code | Lift | `{ code }` → `{ token }`; codes come from Settings → Lift (`lift://sync?code=…`, 15 min, single use) |
| `GET/POST /api/webhooks/strava` | Strava verify token / athlete id | Strava | Subscription check; activity create, update, delete |
| `GET /api/cron/strava` | `Bearer CRON_SECRET` | Vercel cron (daily), GitHub Actions (every 3 h) | Strava sync, the backup for the webhook |
| `GET /api/cron/calendar` | `Bearer CRON_SECRET` | GitHub Actions (every 30 min) | Google Calendar sync (every calendar in Settings) |
| `GET /api/auth/strava/callback`, `/api/auth/google/callback` | Clerk session | Settings | OAuth connections |
| Web pages (`/`, `/plan`, `/lift`, `/settings`) | Clerk session (owner by verified email) | Paolo | Performance, the week plan, Lift history, settings |

## `GET /api/home`

```json
{
  "generatedAt": "ISO", "timeZone": "Asia/Tokyo", "today": "YYYY-MM-DD", "appUrl": "https://…", "planUrl": "https://…/plan",
  "week": { "start": "YYYY-MM-DD", "title": "…", "feel": "tired" | null, "hasPlan": true, "workouts": [Workout] },
  "upcoming": [Workout],            // today to today + 6, not skipped
  "activities": [{ "id", "url", "name", "sport", "start", "distanceKm", "movingMin", "elevM", "place", "effort", "tss" }],  // 35 days
  "sessions": [{ "title", "start", "end" }],                                // upcoming planned workouts, rest days left out
  "events": [{ "id", "calendarId", "calendar": "me" | "family" | "training", "title", "start", "end", "allDay",
               "location", "meetUrl", "link", "description", "attendees": [{ "name", "email", "status", "organizer" }] }],
  "lift": { "last": { "date", "name", "setsLogged", "volume", "unit" } | null, "weekSessions", "weekHardSets",
            "recent": [{ "date", "name", "startedAt", "setsLogged" }] },
  "fitness": { "date", "ctl", "atl", "tsb" } | null,
  "targets": { "runKm", "rideHours", "strength" },
  "warnings": [{ "level": "error" | "warn", "source": "strava" | "lift" | "calendar", "text" }],
  "sync": { "stravaLastSyncedAt", "stravaConnected", "liftLastChangeAt" }, "calendarSyncedAt": "ISO" | null
}
```

`Workout`: `{ id, date, startTime, endTime, title, sport, intensity, duration, tss, why, description,
state: "done" | "skipped" | "missed" | "today" | "planned", match: { source: "strava" | "lift", id, name } | null,
adapted, zones: [{ zone, label, target }] }`. Events leave out cancelled ones, ones Paolo declined, and room resources.

## Where each kind of data comes from

| Data | Written by | Stored in |
| --- | --- | --- |
| Activities | Strava webhook, crons | `strava_activities`, `daily_training_load` |
| Lifts and templates | Lift app (sync) | `lift_rows` |
| Week plan | `/plan` (import), web week page, `scripts/plan-edit.mjs` | `training_plans`, `training_plan_activities` |
| Calendar | calendar cron | `calendar_events` (Google is the source; Coach pushes plan workouts back as purple events) |
| Preferences, targets, calendars to sync | Settings page | `users.settings` |

Change this file first when a route or a field changes.
