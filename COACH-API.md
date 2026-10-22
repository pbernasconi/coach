# Coach API

The one contract between Coach (this repo's Next.js app, https://coach.paolobernasconi.com) and its clients: the
web pages, the Lift iPhone app (`lift/`) and the Dia start page (`pbernasconi/dia-home`). The Neon database behind
Coach is the only source of truth; every client reads or writes through these routes.

| Route | Auth | Used by | What |
| --- | --- | --- | --- |
| `GET /api/home?tz=` | `Bearer HOME_TOKEN` | Dia start page | Today, the week plan, activities, Lift, form, targets, calendar events, sync warnings |
| `POST /api/lift/sync/push` | `Bearer LIFT_SYNC_TOKEN` | Lift | Outbox changes (lift/SYNC.md) |
| `GET /api/lift/sync/pull?cursor=&limit=` | `Bearer LIFT_SYNC_TOKEN` | Lift | Changes since a cursor (lift/SYNC.md) |
| `POST/DELETE /api/app/push/devices`, `POST /api/app/push/opened`, `GET/PUT /api/app/push/preferences`, `POST /api/app/push/test` | `Bearer LIFT_SYNC_TOKEN` | Lift | Push notifications: the device token, taps, the category switches, a test push (lift/PUSH.md) |
| `PUT /api/app/feedback` | `Bearer LIFT_SYNC_TOKEN` | Lift | How a workout felt: feel, RPE, comment (workout_feedback; lift/APP-API.md, "Feedback") |
| `POST /api/lift/enroll` | one-time code | Lift | `{ code }` → `{ token }`; codes come from Settings → Lift (`lift://sync?code=…`, 15 min, single use) |
| `GET/POST /api/webhooks/strava` | Strava verify token / athlete id | Strava | Subscription check; a new or edited activity is stored in full at once (detail, streams, weather, TSS: `src/lib/strava-sync/ingest.mjs`), then the workout notice; delete |
| `GET /api/cron/strava` | `Bearer CRON_SECRET` | Vercel cron (daily), GitHub Actions (every 3 h) | Strava sync, the backup for the webhook; fills in 15 older activities without detail, streams or weather |
| `GET /api/cron/calendar` | `Bearer CRON_SECRET` | GitHub Actions (every 30 min) | Google Calendar sync (every calendar in Settings) |
| `GET /api/auth/strava/callback`, `/api/auth/google/callback` | Clerk session | Settings | OAuth connections |
| Web pages (`/`, `/plan`, `/lift`, `/settings`) | Clerk session (owner by verified email) | Paolo | Performance, the plan (`/plan?week=YYYY-MM-DD` week board, `/plan?view=month&month=YYYY-MM` month calendar), Lift history, settings |

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
| Preferences, targets, calendars to sync | Settings page | `users.settings` (optional `location: { name, lat, lon }` for the /plan weather; default San Francisco) |
| Weather on /plan | Open-Meteo forecast, cached 3 h | not stored |

Change this file first when a route or a field changes.

## `GET /api/workouts/garmin`, `POST /api/workouts/garmin`

The Garmin job's side of the planned runs (`scripts/garmin/workouts.py`). Bearer `CRON_SECRET`. GET returns
`{ from, to, ops: [{ op: 'create' | 'update' | 'delete', activityId, hash, date, workout, remote }] }` for the next
14 days: `workout` is Garmin workout JSON (`src/lib/workouts/garmin.mjs`), `remote` is what Garmin has now
(`{ workoutId, scheduleId, date }`). POST takes `{ results: [{ activityId, op, ok, error?, hash, remote }] }` (at most
200) and stores them in `workout_syncs`. Indoor rides go to Zwift from the Mac (`scripts/zwift-workouts.mjs`), not
through an API.

## Health

Daily vitals and lab results. They are shown on `/health`, and `scripts/health-profile.mjs` adds them to profile.md.
- **Garmin Connect**: a Python job in GitHub Actions (the `garminconnect` library) pushes one value per day and
  metric with `source: "garmin"`.
- **Apple Health**: the Lift app can push in the same way later.
- **Bathroom scale**: an ESP32 bridge (`devices/scale-bridge/`) reads the Renpho Elis 1 over Bluetooth and posts
  `weight_kg` and `body_fat_pct` with the Lift token and `source: "Renpho Elis 1 (scale bridge)"`.
- **Lab results**: they come from Function Health. The "Function Health sync" workflow (by hand, after new results)
  runs `scripts/function-sync.mjs`, which posts to `POST /api/vitals/function`. `/labs` (`scripts/labs-import.mjs`)
  still imports a PDF.
- **DEXA scans**: from BodySpec, see "BodySpec (DEXA)" below.

The code is in `src/lib/vitals/` and the tables are in `drizzle/0015_health.sql` (`health_samples`, `lab_results`). A server-side job
can skip HTTP and call `upsertVitals(sql, userId, samples)` from `src/lib/vitals/sync.mjs`. It applies the same
validation and returns `{ accepted, rejected }`.

### `POST /api/vitals/sync`

`Authorization: Bearer <token>`. Two tokens are accepted, and both are compared in constant time:
- `CRON_SECRET`: the Garmin job.
- `LIFT_SYNC_TOKEN`: the Lift app (the token that `/api/lift/enroll` gives), and the scale bridge.

Both tokens write to the owner's data (the first row in `users`, the rule in `src/lib/owner.ts`).

```json
{ "samples": [{ "date": "2026-10-18", "metric": "hrv_night_avg_ms", "value": 62.0, "unit": "ms", "source": "garmin" }] }
```

- A request has at most 2000 samples and at most 1 MB. The server upserts on (user, `date`, `metric`): a day that
  is sent again replaces the stored value. When one request has the same (`date`, `metric`) twice, the last one wins.
- `date` is the local calendar day (`YYYY-MM-DD`), from 2000-01-01 to the server's UTC day + 1. Sleep and overnight
  HRV use the day that the user wakes up.
- `unit` is optional and is information only. The server never rejects a sample for its unit. It stores the canonical
  unit from the table below. The range check still rejects a value in the wrong scale (for example a 0.97 fraction for
  `spo2_pct`). The Garmin job sends the canonical units.
- `source` is text of 1 to 200 characters: `"garmin"` for the Garmin job, or the HealthKit source name from Lift.
  The server stores it with the value.
- The table below gives each `metric`, its canonical (stored) `unit`, the accepted range, and the meaning of the value.

| metric | unit | range | value for the day | Garmin |
| --- | --- | --- | --- | --- |
| `hrv_night_avg_ms` | `ms` | 1–500 | overnight average HRV, **RMSSD**, of the night that ends on `date` | yes |
| `hrv_weekly_avg_ms` | `ms` | 1–500 | Garmin's 7-day average HRV (RMSSD) | yes |
| `hrv_status` | `code` | integer 0–4 | Garmin HRV status: 0 none, 1 poor, 2 low, 3 unbalanced, 4 balanced | yes |
| `hrv_sdnn_ms` | `ms` | 1–500 | mean of the day's HRV **SDNN** samples (Apple Health) | no |
| `resting_hr_bpm` | `bpm` | 20–150 | the day's resting heart rate | yes |
| `resting_hr_7d_avg_bpm` | `bpm` | 20–150 | Garmin's 7-day average resting heart rate | yes |
| `sleep_total_min` | `min` | 0–1440 | minutes asleep (deep + light/core + REM) in the night that **ends** on `date` | yes |
| `sleep_deep_min`, `sleep_rem_min`, `sleep_core_min`, `sleep_awake_min` | `min` | 0–1440 | stage minutes of that night. Core = Garmin's light sleep. Awake = awake while in bed | yes |
| `sleep_score` | `score` | 0–100 | sleep score of that night | yes |
| `body_battery_high`, `body_battery_low` | `score` | 0–100 | the day's highest and lowest Body Battery | yes |
| `stress_avg` | `score` | 0–100 | the day's average stress. Do not send Garmin's −1/−2 "not enough data" values | yes |
| `training_readiness` | `score` | 0–100 | the morning training readiness score | yes |
| `steps` | `count` | 0–200000 | sum | yes |
| `active_energy_kcal` | `kcal` | 0–20000 | sum | yes |
| `weight_kg` | `kg` | 20–400 | the last weight of the day | yes |
| `body_fat_pct` | `%` | 1–80 | the last of the day, as a percent (send a 0.18 fraction as 18) | yes |
| `vo2max` | `mL/kg/min` | 10–100 | the newest **running** estimate on that day (Garmin `generic`; Apple Health) | yes |
| `vo2max_cycling` | `mL/kg/min` | 10–100 | the newest **cycling** estimate on that day (Garmin `cycling`) | yes |
| `respiratory_rate` | `breaths/min` | 4–60 | the mean (the sleeping rate when there is one) | yes |
| `spo2_pct` | `%` | 50–100 | the mean, as a percent (send 0.97 as 97) | yes |
| `wrist_temp_delta_c` | `degC` | −5–5 | sleeping wrist temperature minus the watch's baseline (Apple Health; Garmin `avgSkinTempDeviationC`) | yes |
| `sleep_avg_hr_bpm` | `bpm` | 20–200 | average heart rate in that night's sleep | yes |
| `sleep_avg_stress` | `score` | 0–100 | average stress in that night's sleep | yes |
| `sleep_awake_count` | `count` | integer 0–200 | times awake in that night | yes |
| `hrv_baseline_low_ms`, `hrv_baseline_high_ms` | `ms` | 1–500 | Garmin's balanced HRV range for the user (RMSSD) | yes |
| `readiness_sleep_factor`, `readiness_hrv_factor` | `%` | 0–100 | the sleep and HRV factors of the morning training readiness | yes |
| `readiness_recovery_time_h` | `h` | 0–200 | the recovery time at the morning readiness | yes |
| `readiness_acute_load` | `load` | 0–5000 | the acute load at the morning readiness | yes |
| `intensity_minutes_moderate`, `intensity_minutes_vigorous` | `min` | integer 0–1440 | the day's intensity minutes | yes |
| `floors_climbed` | `floors` | 0–2000 | floors climbed (Garmin: 3 m each) | yes |
| `training_load_acute`, `training_load_chronic` | `load` | 0–5000 | Garmin's acute (7-day) and chronic (28-day) training load as of the day | yes |
| `training_load_ratio` | `ratio` | 0–10 | acute:chronic workload ratio | yes |
| `load_focus_anaerobic`, `load_focus_high_aerobic`, `load_focus_low_aerobic` | `load` | 0–20000 | the 4-week load in each focus | yes |
| `training_status` | `code` | integer 0–9 | 0 no status, 1 detraining, 2 recovery, 3 maintaining, 4 unproductive, 5 productive, 6 peaking, 7 overreaching, 8 strained, 9 paused. Coach's code, made from Garmin's `trainingStatusFeedbackPhrase` (`TRAINING_STATUS` in `metrics.mjs`) | yes |
| `endurance_score` | `score` | integer 0–15000 | Garmin endurance score | yes |
| `hill_score` | `score` | integer 0–100 | Garmin hill score | yes |
| `race_pred_5k_s`, `race_pred_10k_s`, `race_pred_half_s`, `race_pred_marathon_s` | `s` | 300–86400 | Garmin's predicted race time | yes |
| `lactate_threshold_hr_bpm` | `bpm` | 60–230 | running lactate threshold heart rate, on the day Garmin measured it | yes |
| `lactate_threshold_pace_s_per_km` | `s/km` | 120–900 | running lactate threshold pace, on the day Garmin measured it | yes |
| `cycling_ftp_w` | `W` | 20–700 | cycling FTP, on the day it was set | yes |
| `fitness_age` | `years` | 10–120 | Garmin fitness age on that day | yes |

`/health` shows HRV from `hrv_night_avg_ms` (labelled RMSSD) when the data has it, and else from `hrv_sdnn_ms`
(labelled SDNN). The page never mixes the two measures in one baseline.

Response `200`: `{ "accepted": 1, "rejected": [{ "index": 3, "reason": "value out of range for spo2_pct (50 to 100)" }] }`.
- `accepted` is the number of samples that the server stored.
- `index` is the sample's position in `samples`.
- A rejected sample cannot succeed when sent again, so the client drops it.

Errors:
- `400`: the body is not JSON, `samples` is not an array, or there are more than 2000 samples.
- `401`: the token is wrong or missing.
- `413`: the body is over 1 MB.
- `5xx`: the client sends the same batch again later. This is safe because the upsert is idempotent.

### `GET /api/vitals/sync?since=YYYY-MM-DD`

The tokens are the same as for POST. `since` is optional. When it is given, only days on or after `since` count.

```json
{ "latestDate": { "hrv_night_avg_ms": "2026-10-18", "sleep_score": "2026-10-18", "steps": null, "…": "every metric" } }
```

A client starts each metric again from its `latestDate`, and includes that day, because the newest day is often incomplete.
When `latestDate` is `null`, the client uses its own first-sync window (for example 120 days back).

The proxy (`src/proxy.ts`) lets `/api/vitals/sync` through without Clerk, the same as the other routes with a bearer token.

### Lab results

`lab_results` has one row for each (user, `source`, biomarker, `collected_on`).
- The format of the import file is at the top of `src/lib/vitals/labs.mjs`.
- `scripts/labs-import.mjs --file <json> [--dry-run]` upserts the file and prints counts only.
- The status is `optimal`, `in_range`, `out_of_range` or `unknown`. The source's own status is used when it gives
  one. Otherwise the status comes from the optimal and reference ranges.

The Function Health connector is at `https://services.functionhealth.com/ai-chat/mcp` (OAuth). Its v1.0 docs list
only summary counts (`overall-summary`, `category-summary`) and meal plans (`get-action-plans`), with no values for
each draw. `/labs` uses the connector when it returns values. Otherwise `/labs` reads Function's PDF reports.

### `POST /api/vitals/function`

`Authorization: Bearer <CRON_SECRET>`. One Function Health sync, from `scripts/function-sync.mjs`:
`{ file, notes, catalog, contents, raw, planned, plannedOk }` (the shapes are in `src/lib/vitals/function-store.mjs`),
or `{ error }` to record a failed run. Coach upserts the results, replaces the notes of each test order, upserts the
catalog, and replaces the planned draw. A catalog with less than 80 % of the stored biomarkers is partial: Coach
deletes no biomarker or category then. The run is recorded in `users.settings.functionSync` (Settings shows it), and
the `labs` cache is cleared. Returns `{ results, rejected, notes, biomarkers, partial, plannedUpdated }`.

### Garmin (direct)

`.github/workflows/garmin.yml` runs `scripts/garmin/sync.py` at 11:00 and 17:00 UTC. The job reads the unofficial Garmin Connect API (`garminconnect`, pinned) and posts to `POST /api/vitals/sync` with `Authorization: Bearer <CRON_SECRET>` and `source: "garmin"`. It sends the metrics in the table above that have a Garmin mark, with the same units (`src/lib/vitals/garmin-contract.test.mjs` checks this). Sleep and HRV use the date the user wakes up.

Each day, the job calls 12 Garmin sources (summary, HRV, sleep, readiness, max metrics, heart rate, stress, training status, endurance score, hill score, race predictions, Body Battery events), then weight and fitness age once for each week of days. Once a run, it calls 9 more (lactate threshold, cycling FTP, personal records, power curve, stamina curve, running economy, running tolerance, HR zones, power zones). An optional source that answers 4xx for this account is skipped for the rest of the run. The run logs it once, and it does not count as a failure.

The job keeps its state in Coach, in `garmin_connections` (one row for the owner):

- `tokens_ciphertext`: the Garmin login tokens, encrypted by the job with AES-256-GCM. The key is the GitHub secret `GARMIN_TOKEN_KEY` (also in `~/.garminconnect/token_key` on Paolo's Mac). Coach stores and returns only ciphertext: it cannot read the tokens.
- `synced_through`: the last day of the last successful run. A run fetches max(3 days, the days since `synced_through` + 1), with at most 45 days of catch-up. Missed runs fill themselves in.
- `status` (`ok`, `auth_failed`, `error`), `last_success_at`, `last_attempt_at`, `last_error` (a short line without secrets or health values).

#### `POST /api/vitals/garmin/raw`

`Authorization: Bearer <CRON_SECRET>`. The archive of the Garmin responses, in `garmin_raw` (one row per user, `date` and `kind`; the upsert replaces the payload). Body: `{ "items": [{ "date": "2026-10-19", "kind": "sleep", "payload": { … } }] }`, at most 500 items and 4 MB. The job sends batches of at most 3.5 MB.

- `kind` is one of `RAW_KINDS` in `src/lib/vitals/garmin.mjs`. Daily kinds use the day they describe: `summary`, `hrv`, `sleep`, `readiness`, `max_metrics`, `body_composition`, `heart_rates`, `stress`, `training_status`, `endurance_score`, `hill_score`, `race_predictions`, `body_battery_events`. Once-a-run kinds use the run's day: `lactate_threshold`, `cycling_ftp`, `fitness_age` (also one per backfill week), `personal_records`, `power_curve` (last 90 days), `stamina_curve`, `running_economy`, `running_tolerance` (last 28 days), `hr_zones`, `power_zones`. `lactate_threshold_history` uses the end of its range.
- `payload` is the Garmin response as an object or array, without the account ids, names and emails (`mapping.redact`). Empty responses are not sent. The time series stay: sleep stages and movement, overnight SpO2, respiration, HR, stress and Body Battery, the HR, stress and Body Battery timelines of the day, and the HRV readings.
- About 270 KB of JSON per day. Postgres compresses it to about 50 KB, so 550 days are about 30 MB.
- Response `200`: `{ "accepted", "rejected": [{ "index", "reason" }] }`. Errors: `400`, `401`, `413` (over 4 MB), `503` (no Coach user).

`health_samples` keeps the mapped metrics that the pages use. `garmin_raw` lets Coach map more later without fetching from Garmin again. The fixtures `scripts/garmin/fixtures/raw_<kind>.json` show each shape (redacted, lists cut to 60 items).

#### `GET/POST /api/vitals/garmin/activities`

`Authorization: Bearer <CRON_SECRET>`. The watch's own record of each workout, in `garmin_activities` (`scripts/garmin/activities.py`). The Strava webhook starts `garmin.yml` with `activities` after a new activity, so it arrives about a minute after the workout; every Garmin run also catches up on the last 48 hours.

- `GET ?since=<ISO>`: `{ "ids": [...] }`, the Garmin activity ids Coach has that started from then on (the job skips them).
- `POST { "activities": [{ "id", "startUtc", "type", "summary", "detail", "series" }] }`, at most 20 and 4 MB: `summary` is Garmin's list item, `detail` the activity's summary page, `series` `{ t: seconds[], <Garmin metric key>: values[] }` at up to 600 points. Account ids, names and emails are removed by the job. Upserted by id; clears the `activities` cache. Response `{ "accepted", "rejected": [{ "index", "reason" }], "feedback" }`.
- The activity page and `/api/app/activities/:id` match a Strava activity to the Garmin one that starts within 2 minutes (`src/lib/activity/watch.mjs`) and add the watch's stats after Strava's: training effect, Garmin load, performance condition, VO2max, running dynamics (runs), power (when Strava has none), respiration, stamina, Body Battery.
- The feel and RPE logged on the watch after a workout (`summaryDTO.directWorkoutFeel` 0–100, `directWorkoutRpe` 10–100) become that Strava activity's "How did it go?" (`workout_feedback`, `source = 'watch'`, `src/lib/activity/watch-feedback.mjs`): once per Garmin activity (`feedback_at`), never over feedback logged in Coach. It runs after this POST, after the Strava webhook and in the Strava cron.

#### `GET /api/vitals/garmin`

`Authorization: Bearer <CRON_SECRET>` (constant-time). Returns `{ "tokens_ciphertext", "synced_through", "last_success_at", "status", "backfill_from", "backfill_through" }`. Each is `null` before the job stores a row.

#### `PUT /api/vitals/garmin`

`Authorization: Bearer <CRON_SECRET>`. Body, every field optional (at least one): `{ "tokens_ciphertext", "status", "last_error", "synced_through", "backfill_from", "backfill_through", "success" }`. A field that is not sent keeps its stored value.

- `tokens_ciphertext` must be `v1.` and base64url (the job's format). Plain token JSON is refused.
- `status` sets `last_attempt_at` to now. `success: true` sets `status` to `ok`, `last_success_at` to now and, unless `last_error` is sent, clears `last_error`.
- `last_error` is cut to 300 characters. `synced_through`, `backfill_from` and `backfill_through` are `YYYY-MM-DD` or `null`.
- A backfill: `sync.py --since 2025-04-20` sets `backfill_from`. After each week of days, the job sets `backfill_through`. Every run (also the scheduled ones, for at most 45 minutes) continues from `backfill_through` + 1 up to its own window. When the backfill is done, the job sets `backfill_from` to `null`.

The job stores new tokens at once when Garmin refreshes them (before the next data call), and again in the run's last `PUT`. `/health` shows "Garmin: synced 3 h ago, through Oct 19". The banner on every page warns when `status` is `auth_failed` or the last success is older than 36 hours (`src/lib/vitals/garmin.mjs`, `src/lib/status.ts`).

- Secrets: `GARMIN_TOKEN_KEY`, `CRON_SECRET`, and `GARMIN_TOKENS` (seed only: the job uses it when Coach has no tokens yet, or cannot decrypt them).
- One-time setup: `scripts/garmin/.venv/bin/python scripts/garmin/login.py --new-key`. The next run moves the tokens from `GARMIN_TOKENS` into Coach, so a new Garmin login is not needed.
- Backfill: `gh workflow run garmin.yml -f since=2025-04-20` (about 550 days and 6,600 calls; about 2.5 hours). If the run stops, the scheduled runs continue it, or you can run the same command again.
- When the banner says the Garmin login has expired, run `login.py` (without `--new-key`). See `scripts/garmin/README.md`.

### BodySpec (DEXA)

BodySpec's API (https://app.bodyspec.com/docs, early access) gives each scan's composition (total and per region:
arms, legs, trunk, android, gynoid), visceral fat, bone density, percentiles and resting metabolic rate. The code
is `src/lib/vitals/bodyspec-api.ts` (OAuth, API, sync) and `bodyspec.mjs` (the mapping and the /health view); the
tables are `bodyspec_connections` and `dexa_scans` (`drizzle/0009_bodyspec_dexa.sql`).

- **Connect**: Settings → BodySpec → Connect (`/api/auth/bodyspec/start`). BodySpec's sign-in (Keycloak at
  auth.bodyspec.com, Google login there) has no app keys to set up: Coach registers itself as a public client for
  its callback URL on the first connect (dynamic client registration) and uses PKCE. The callback stores the tokens
  (encrypted with AES-256-GCM; key `BODYSPEC_TOKEN_KEY`, else derived from `CRON_SECRET`) and pulls every scan.
- **Sync**: `GET /api/cron/bodyspec` (Bearer `CRON_SECRET`), daily from `sync.yml` at 16:17 UTC (an hour without the Strava step), and Settings →
  Sync now. It fetches only new or changed results (`update_time`) and answers counts and dates only. The daily
  refresh keeps the sign-in alive; a refused refresh token sets `status = 'auth_failed'` and Settings asks to
  reconnect.
- **Stored**: `raw` keeps every section BodySpec sends (scan info, composition per region, visceral fat, bone
  density per site, percentiles with their reference group, RMR per formula) and the result's own record
  (`raw.result`). From it the sync writes `derived` (FFMI, ALMI, FMI, left/right lean balance…) and `report_md`, the
  scan as Markdown with the change since the scan before (`src/lib/vitals/dexa.mjs`). A new `REPORT_VERSION`
  rebuilds them on the next sync without calling BodySpec.
- **Files**: BodySpec's API has no scan images or PDF reports for users (only its partner export). Upload them on
  /health/dexa (`POST /api/dexa/files`, Clerk session, PDF or PNG/JPEG/WebP up to 4 MB). They go to `dexa_files`
  (bytes, and a PDF's text for AI questions); a date in the file name links the scan. A scan image also has a
  `view` (composite, fat, lean or bone: the form field `view`, else read from the file name, `dexa-images.mjs`); a
  new image for a scan's view takes that slot. A BodySpec PDF report links to its scan by the "Measured Date" inside
  it, and its whole-body image (page 2, the only scan image in the report) is stored as that scan's composite PNG.
  `GET /api/dexa/files/{id}` serves one to the owner. From a terminal, `node --env-file=.env.local --import tsx
  scripts/dexa-upload.ts <files>` stores files the same way and clears the cache.
- **Shown**: /health → Body composition (latest values and every scan), and /health/dexa: progress first. Body fat
  over time on the healthy ranges for the athlete's sex and age, fat and lean mass, the focus areas (belly and
  visceral fat, arm and leg lean), healthy-range bars (body fat, FFMI, ALMI, bone Z-score; sources in
  `src/lib/vitals/dexa-health.mjs`), the scan images side by side, and the scans and files.
  /health/dexa/{date} is one scan: its four images, headline changes, ranges, regions and the rest under Details
  (also `latest` or a result id).

#### `GET /api/vitals/dexa`

Bearer `CRON_SECRET`. Every scan in full for AI questions: `{ scans: [FullScan & { reportMd }], files: [{ id,
resultId, scanDate, kind, name, contentType, sizeBytes, url, text }] }` (`FullScan` is in `dexa.mjs`).
`?format=md` answers one Markdown document instead: a table of the scans, each scan's report and the PDFs' text.
`GET /api/vitals/dexa/files/{id}` (same bearer) is one file. Locally, `node --env-file=.env.local
scripts/dexa-report.mjs` prints the same Markdown from the database, and profile.md (for /plan and /check-in) has a
DEXA line.

## `POST /api/plan/proposals`

`Authorization: Bearer <CRON_SECRET>`. The cloud plan job (`scripts/plan-cloud/client.mjs`) and `plan-apply.yml`.
The table is `plan_proposals` (`src/db/plan-schema.ts`); the flow is in COACH.md, "In the cloud".

| `action` | Body | Does |
| --- | --- | --- |
| `claim` | `{ id? }` | Marks the request running and returns `{ id, request }`. No id (the Sunday run): a new weekly request for next week. |
| `submit` | `{ id, plan, summary }` | Checks the plan (`src/lib/plan/proposal.mjs`: the week, the days, the bank workouts) and stores it as `proposed`, or fails the request with the reason (422). |
| `fail` | `{ id, error }` | Marks the request failed; the Plan page shows the error. |
| `push` | `{ weeks: "YYYY-MM-DD,…" }` | Pushes those plan weeks to Google Calendar (after Lift added the planned sets). |

