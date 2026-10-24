# Push notifications

Coach sends Lift notices through APNs when something happens that Paolo should see: a workout finished, a weigh-in
stored. A tap opens the screen for it. This file is the contract between the server (`src/lib/notifications/`) and
the app (`lift/ios/Lift/App/Push/`). Change it first, then both sides.

## How a notice is made

```
Lift sync push ──┐                                   ┌─ bind: zod-check the payload, build title/body/link
Strava sync ─────┼─ trigger (triggers.mjs) ─ notify ─┼─ mute check (category switch; system is mandatory)
Vitals push ─────┘   after() the response            ├─ store the notice (unique per idempotency key)
                                                     ├─ send to each active device (APNs, retries)
                                                     └─ record each delivery; turn dead tokens off
```

- **Events** (`src/lib/notifications/events/`): each event type is one `defineEvent` with a zod payload, an
  idempotency key, the title and body, a destination (where a tap goes), a collapse key, a thread, an
  interruption level and a time to live. `catalog.mjs` lists them; its header has the rules for a new event.
- **Triggers** run after the route has answered (`after()`), never throw and log no content (health data).
- **Once only**: the idempotency key is unique per user, so a webhook sent twice or a sync pushed again sends one
  notice. A workout or weigh-in older than 12 hours sends nothing (backfills, late uploads).

| Type | Category | When | Title | Opens |
| --- | --- | --- | --- | --- |
| `workout.completed` | workouts | A Lift session synced with `finishedAt` set; a new Strava activity (not a strength one within an hour of a Lift session) | "Workout completed!", "Run completed!" | `lift://session/<id>` or `lift://activity/<stravaId>` |
| `weigh_in.recorded` | body | A vitals push with the Lift token (the scale bridge, Apple Health) that holds a weight from today or yesterday. Garmin's batch never notifies. | "Weigh-in: 83.2 kg" | `lift://weigh-in/<YYYY-MM-DD>` |
| `system.test` | system | `POST /api/app/push/test` | "Coach test" | `lift://today` |

## The APNs payload

```json
{
  "aps": { "alert": { "title": "Run completed!", "body": "10.2 km · 52 min · 5:07 /km · TSS 64" },
           "sound": "default", "thread-id": "workouts", "interruption-level": "active" },
  "link": "lift://activity/16234567890",
  "notificationId": "7d0c2f0e-2a3b-4c5d-9e8f-0a1b2c3d4e5f",
  "type": "workout.completed"
}
```

- The keys next to `aps` are strings and carry routing only: `link` (always), `notificationId`, `type`. Content
  stays in the alert text, so the app never needs the payload to show anything.
- Headers: `apns-push-type: alert`, `apns-priority` 10 (5 for a passive notice), `apns-collapse-id` (a newer
  notice for the same workout or day replaces the older one), `apns-expiration` from the event's time to live.

## Links

The same links work from a notice, from Safari, from Shortcuts and from the share extension. `AppLink.swift` parses
them; the tab and route are in `DeepLinkNavigator`.

| Link | Tab | Screen |
| --- | --- | --- |
| `lift://session/<uuid>` | Lift | The session (`GET /api/app/lift/sessions/{id}`, the local session without sync) |
| `lift://activity/<stravaId>` | Activities | The activity (`GET /api/app/activities/{id}`) |
| `lift://weigh-in/<YYYY-MM-DD>` | Today | The weigh-in (`GET /api/app/weigh-ins/{date}`, lift/APP-API.md) |
| `lift://today` | Today | The tab's root |

A tap that arrives before the window exists (a cold start) is parked and opened as soon as the tab bar is up.

## Endpoints

`Authorization: Bearer <LIFT_SYNC_TOKEN>` like every `/api/app` route; JSON bodies up to 16 KB; `400 {"error"}` on a
bad body.

### `POST /api/app/push/devices`

```json
{ "token": "a1b2…(hex)", "environment": "production", "topic": "com.pbernasconi.lift",
  "installId": "5E0F…", "appVersion": "1.0 (17)", "deviceName": "iPhone", "notificationsAuthorized": true }
```

→ `{ "deviceId": "<uuid>" }`. Safe to repeat. A token already known is refreshed and turned back on; a new token
from the same `installId` turns the install's old token off. `environment` is the APNs host the build's signing
uses: `sandbox` for an Xcode debug build, `production` for TestFlight and the App Store (the app reads
`aps-environment` from its provisioning profile). A `topic` other than `APNS_TOPIC` (a Simulator or Xcode build
with the placeholder `com.example.lift`) is refused with `422`: this key can never push to it.

`GET /api/app/push/test` reads the push state without sending anything: the devices (on or off, and why) and the
last notices with status and APNs codes. `push-test.yml` with `status` prints it.

### `DELETE /api/app/push/devices`

`{ "token": "…" }` → `{ "removed": true }`. When sync is disconnected.

### `POST /api/app/push/opened`

`{ "notificationId": "<uuid>" }` → `{ "opened": true }`. A tap; Coach keeps the first open time.

### `GET /api/app/push/preferences`, `PUT /api/app/push/preferences`

```json
{ "categories": [ { "id": "workouts", "label": "Workouts", "description": "…", "enabled": true },
                  { "id": "body", "label": "Weigh-ins", "description": "…", "enabled": true } ] }
```

`PUT { "categories": { "body": false } }` switches a category and answers with the list. `system` cannot be
switched off.

### `POST /api/app/push/test`

Sends `system.test` to every active device and answers with what happened:
`{ "notificationId", "status": "sent" | "partial" | "failed" | "no_devices", "accepted", "devices" }`.

`{ "replay": "lift" | "strava" | "weigh_in" }` sends the real notice instead, built from the latest finished Lift
session, Strava activity or weigh-in, with its deep link (`"status": "no_data"` when there is none). A replay has its
own idempotency key, so it never blocks the real notice. The "Push test" workflow (`push-test.yml`) runs these.

## Server setup

| Variable | What |
| --- | --- |
| `APNS_KEY_P8` | The APNs auth key (.p8) as text; `\n` escapes are accepted |
| `APNS_KEY_ID` | The key's id (10 characters) |
| `APNS_TEAM_ID` | The Apple developer team id |
| `APNS_TOPIC` | Default topic when a device sent none: `com.pbernasconi.lift` |

Without them every delivery is recorded as failed with code `NO_CREDENTIALS` and nothing else changes. One key
works for both APNs hosts; each device is sent to the host its `environment` names.

## Delivery rules (apns.mjs, notifier.mjs)

- Token auth: an ES256 JWT, reused for 50 minutes, minted again when APNs says `ExpiredProviderToken`.
- `410 Unregistered` turns the device off, unless it registered again after APNs' timestamp.
- `TopicDisallowed` and `DeviceTokenNotForTopic` turn the device off: its bundle id (a debug build's placeholder,
  say) can't get pushes from this key. It comes back on if it registers again.
  `BadDeviceToken` is tried once on the other host (a build signed for the other environment), then turned off.
- `429` and `5xx` are retried up to 3 times (1 s, 4 s; `Retry-After` when sent, at most 10 s).
- A notice's status: `sent` (every device took it), `partial`, `failed`, `no_devices`, `muted`.

## Tables

`push_devices`, `notifications`, `notification_deliveries`, `notification_preferences`
(`src/db/notifications-schema.ts`, migration `0012_push_notifications`).
