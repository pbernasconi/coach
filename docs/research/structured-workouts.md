# Structured workouts: Coach → Garmin watch (runs) and Zwift (indoor bike)

Research date: 2026-10-20. Every claim has a source. "Unconfirmed" means that no primary source was found.

> **Decision (2026-10-20):** Paolo chose no service in between. Coach sends runs to Garmin Connect itself, through
> the existing Garmin job (section 2, "Fallback A"), and writes indoor rides as `.zwo` files on the Mac (section 5,
> "Fallback B"). intervals.icu is not used. Tested the same day: 6 runs uploaded, scheduled and read back with the
> same steps; 4 rides written to the Zwift folder.

## Summary

1. **Recommendation:** Coach stays the source of truth. Coach stores each planned workout as a step list (JSON, section 7). Coach sends the steps to **intervals.icu** with Paolo's personal API key. intervals.icu then pushes the workouts to **Zwift** (an official Zwift integration) and to **Garmin Connect** (its Garmin integration). This gives one bridge, no reverse engineering and no MFA flow.
2. **Before we build it:** do a one-day test. Make one HR-target run and one %FTP ride in intervals.icu by hand. Check that the run shows on the watch with its HR targets and that the ride shows in Zwift. Users report missing HR targets on Garmin in some cases (section 6).
3. **Fallback for Garmin:** the existing Garmin job (`garminconnect` 0.3.19) can already create, update, schedule and delete workouts. Its stored token has the `CONNECT_WRITE` scope. This path is unofficial and has broken several times in 2026 (section 2).
4. **Fallback for Zwift:** a small Mac script writes `.zwo` files to `~/Documents/Zwift/Workouts/<zwift id>/`. Zwift reads them after a restart.
5. **Do not use:** the official Garmin Training API (business partners only) or the TrainingPeaks API (no personal use). Zwift has no public API.
6. **Lossy cases:** Zwift has no HR or pace targets for rides. Garmin and FIT have no ramp steps. intervals.icu has no nested repeats (VO2 B must be unrolled).

---

## 1. Garmin, official: Connect Developer Program, Training API

| Item | Finding | Source |
| --- | --- | --- |
| What it does | "Publish workouts and training plans to the Garmin Connect calendar." Users sync the device, then "start a workout and follow the steps on the wearable or cycling computer." | [Training API](https://developer.garmin.com/gc-developer-program/training-api/) |
| Device support | "New devices with course and workout features are supported automatically." | same |
| Who can join | The program "is only for business use." Read 2026-10-20. | [Program FAQ](https://developer.garmin.com/gc-developer-program/program-faq/) |
| Personal use | A private person cannot use it for personal use ("Un particulier ne peut pas s'en servir pour son usage personnel"). Secondary source. | [runningworkout.fr](https://www.runningworkout.fr/api-garmin) |
| Cost | "No licensing or maintenance fees." Some metrics can need a license fee for commercial use. Read 2026-10-20. | [Program FAQ](https://developer.garmin.com/gc-developer-program/program-faq/) |
| Approval | Garmin answers in two business days. A typical integration takes 1–4 weeks. After approval: production with throttled access. | [Program FAQ](https://developer.garmin.com/gc-developer-program/program-faq/), [Training API](https://developer.garmin.com/gc-developer-program/training-api/) |
| Auth | "All APIs in the Developer Program use OAUTH 2.0." | [Program FAQ](https://developer.garmin.com/gc-developer-program/program-faq/) |
| Workout model | The spec is in the partner portal. It is not public. A developer forum post about Training API V2 shows these fields: `WorkoutStep` / `WorkoutRepeatStep`, `intensity` (`WARMUP`, `ACTIVE`, `RECOVERY`, `COOLDOWN`), `durationType` (`TIME`, `OPEN`), `targetType` (`POWER`, `OPEN`), `targetValueLow` / `targetValueHigh`, `repeatType: REPEAT_UNTIL_STEPS_CMPLT`, `repeatValue`. **Unconfirmed** as a full list: HR, pace and cadence target names and the limits. | [Garmin forum 431359](https://forums.garmin.com/developer/connect-iq/f/discussion/431359/no-interval-details-in-workouts) |
| Two calls | Create the workout in the library, then schedule it on a date. Without a schedule it does not show on the day. Secondary source. | [runningworkout.fr](https://www.runningworkout.fr/api-garmin) |
| On the watch | Workouts on the Connect calendar go to the device. "All scheduled workouts appear in the training calendar list by date." "When you send scheduled workouts from Garmin Connect, they overwrite the existing training calendar." | [Forerunner 645 manual, Training Calendar](https://www8.garmin.com/manuals/webhelp/forerunner645/EN-US/GUID-F5EB9C7C-A74E-4A26-BFB5-1E6DA4399067.html) |

**Verdict:** this is the correct API for a product. It is closed to Coach, because Coach is a personal app with one user.

## 2. Garmin, unofficial: Connect web `workout-service`

The source is the library version that Coach installs: `scripts/garmin/.venv/lib/python3.14/site-packages/garminconnect/` (upstream: [cyberjunky/python-garminconnect](https://github.com/cyberjunky/python-garminconnect)).

### Endpoints (garminconnect 0.3.19)

| Action | HTTP | Method in the library | File |
| --- | --- | --- | --- |
| Create workout | `POST /workout-service/workout` | `upload_workout(json)` | `api/workouts.py:103` |
| Replace workout (keeps id and its schedules) | `PUT /workout-service/workout/{id}` | `update_workout(id, json)` | `api/workouts.py:123` |
| Delete workout | `DELETE /workout-service/workout/{id}` | `delete_workout(id)` | `api/workouts.py:88` |
| Download as FIT | `GET /workout-service/workout/FIT/{id}` | `download_workout(id)` | `api/workouts.py:95` |
| Schedule on a date | `POST /workout-service/schedule/{workoutId}` body `{"date":"YYYY-MM-DD"}` | `schedule_workout(id, date)` | `api/workouts.py:388` |
| Unschedule | `DELETE /workout-service/schedule/{scheduledId}` | `unschedule_workout(id)` | `api/workouts.py:403` |
| List scheduled | `GET /workout-service/schedule/workoutScheduleByPeriod?startDate&endDate` | `get_scheduled_workouts_by_period` | `api/workouts.py:412` |
| Push one workout to a device | `POST` device message, `messageUrl: workout-service/workout/FIT/{id}` | `push_workout_to_device` | `api/devices.py:82` |
| Push all scheduled to devices | `PUT /workout-service/schedule/sendtodevices` | `send_scheduled_workouts_to_devices` | `api/devices.py:245` |

`garth` is not in use any more. The `garth` author deprecated it on 2026-03-27: "Garmin recently changed their auth flow, breaking the mobile auth approach" ([garth discussion 222](https://github.com/matin/garth/discussions/222)). `garminconnect` 0.3.x has its own auth client (comment in `scripts/garmin/requirements.txt`).

### Payload shape (run, HR target, repeats)

The IDs are from `garminconnect/workout.py:36-97`. The library says that they come from `GET /workout-service/workout/types`.

- Sport: `running` = 1, `cycling` = 2.
- Step types: `warmup` 1, `cooldown` 2, `interval` 3, `recovery` 4, `rest` 5, `repeat` 6.
- End conditions: `lap.button` 1, `time` 2 (seconds), `distance` 3 (meters), `iterations` 7.
- Targets: `no.target` 1, `power.zone` 2, `cadence` 3, `heart.rate.zone` 4, `speed.zone` 5, `pace.zone` 6.
- A custom range goes in `targetValueOne` / `targetValueTwo` on the step: bpm for HR, watts for power, m/s for pace (the slower pace is the lower value). A Garmin zone goes in `zoneNumber` (`workout.py:329-420`).
- A second target goes in `secondaryTargetType` and `secondaryTargetValueOne/Two` (`workout.py:144-166`).
- A repeat is a `RepeatGroupDTO` with `numberOfIterations` and child `workoutSteps`. The model allows a `RepeatGroup` inside a `RepeatGroup` (`workout.py:168-186`, `686-710`).

Threshold A as a run (10' warm-up, 6 × [5' at 175–182 bpm, 2' easy], 15' top Z2):

```json
{
  "workoutName": "Coach · Threshold A (run) · 2026-10-28",
  "description": "coach:<activityId>:<hash>",
  "sportType": {"sportTypeId": 1, "sportTypeKey": "running"},
  "estimatedDurationInSecs": 3600,
  "workoutSegments": [{
    "segmentOrder": 1,
    "sportType": {"sportTypeId": 1, "sportTypeKey": "running"},
    "workoutSteps": [
      {"type": "ExecutableStepDTO", "stepOrder": 1,
       "stepType": {"stepTypeId": 1, "stepTypeKey": "warmup"},
       "endCondition": {"conditionTypeId": 2, "conditionTypeKey": "time"}, "endConditionValue": 600,
       "targetType": {"workoutTargetTypeId": 4, "workoutTargetTypeKey": "heart.rate.zone"},
       "targetValueOne": 122, "targetValueTwo": 145},
      {"type": "RepeatGroupDTO", "stepOrder": 2,
       "stepType": {"stepTypeId": 6, "stepTypeKey": "repeat"},
       "numberOfIterations": 6,
       "endCondition": {"conditionTypeId": 7, "conditionTypeKey": "iterations"}, "endConditionValue": 6,
       "workoutSteps": [
         {"type": "ExecutableStepDTO", "stepOrder": 3,
          "stepType": {"stepTypeId": 3, "stepTypeKey": "interval"},
          "endCondition": {"conditionTypeId": 2, "conditionTypeKey": "time"}, "endConditionValue": 300,
          "targetType": {"workoutTargetTypeId": 4, "workoutTargetTypeKey": "heart.rate.zone"},
          "targetValueOne": 175, "targetValueTwo": 182,
          "description": "Start reasonable, finish with a few left"},
         {"type": "ExecutableStepDTO", "stepOrder": 4,
          "stepType": {"stepTypeId": 4, "stepTypeKey": "recovery"},
          "endCondition": {"conditionTypeId": 2, "conditionTypeKey": "time"}, "endConditionValue": 120,
          "targetType": {"workoutTargetTypeId": 1, "workoutTargetTypeKey": "no.target"}}
       ]},
      {"type": "ExecutableStepDTO", "stepOrder": 5,
       "stepType": {"stepTypeId": 2, "stepTypeKey": "cooldown"},
       "endCondition": {"conditionTypeId": 2, "conditionTypeKey": "time"}, "endConditionValue": 900,
       "targetType": {"workoutTargetTypeId": 4, "workoutTargetTypeKey": "heart.rate.zone"},
       "targetValueOne": 145, "targetValueTwo": 153}
    ]
  }]
}
```

For pace instead of HR, use `{"workoutTargetTypeId": 6, "workoutTargetTypeKey": "pace.zone"}` with m/s values (`pace_to_mps`, `workout.py:445`). This example has not been sent to Garmin. Do a test upload first.

### Risks

| Risk | Evidence |
| --- | --- |
| Auth flow changes | 2026-03-17: logins broke for all `garminconnect` users ([#332](https://github.com/cyberjunky/python-garminconnect/issues/332)). This caused the `garth` deprecation. |
| Cloudflare / bot checks | 2026-09-28: valid tokens got 403 on every call with plain `requests`; `curl_cffi` worked ([#444](https://github.com/cyberjunky/python-garminconnect/issues/444)). Coach pins `curl_cffi` for this reason (`requirements.txt`). |
| Login rate limits | 429 on the SSO login ([#337](https://github.com/cyberjunky/python-garminconnect/issues/337), [#453](https://github.com/cyberjunky/python-garminconnect/issues/453)). |
| MFA | Login needs the MFA code; MFA bugs: [#386](https://github.com/cyberjunky/python-garminconnect/issues/386), [#416](https://github.com/cyberjunky/python-garminconnect/issues/416), [#312](https://github.com/cyberjunky/python-garminconnect/issues/312). |
| Wrong IDs that fail silently | `TargetType.HEART_RATE` was 2, which Garmin stores as power ([#333](https://github.com/cyberjunky/python-garminconnect/issues/333), fixed 2026-04-02). `ConditionType` IDs were wrong; the upload returned 200 but stored the wrong end condition ([#370](https://github.com/cyberjunky/python-garminconnect/issues/370), fixed 2026-06-15). **Lesson:** read the workout back after each upload and compare. |
| Token lifetime | The access token lasts about 24 h and the library refreshes it ([README](../../scripts/garmin/README.md), and the `exp − iat` of the local token is 24.6 h). Refresh is 15 min before expiry (`client/tokens.py:95-115`). The refresh-token lifetime is **unconfirmed**. |
| Terms of use | No primary clause was found that names scripts or robots. **Unconfirmed.** The unofficial API has no contract. Garmin can block it at any time ([README](../../scripts/garmin/README.md) "What breaks"). |

## 3. What the repo already does for Garmin

- **Library and auth:** `garminconnect==0.3.19` with `curl_cffi` (`scripts/garmin/requirements.txt`). The tokens are Garmin "DI" OAuth2 tokens from the mobile-app client IDs (`client/constants.py:66-74` in the installed library). The first login is `login.py` on the Mac: email, password (not stored) and MFA code (`scripts/garmin/login.py`).
- **Where the tokens are:** in Coach, table `garmin_connections` (`src/db/health-schema.ts:82-103`), encrypted with AES-256-GCM (`scripts/garmin/tokencrypt.py`). The key is the GitHub secret `GARMIN_TOKEN_KEY` and `~/.garminconnect/token_key`. `GARMIN_TOKENS` is a seed only. There is a local copy in `~/.garminconnect/garmin_tokens.json` ([README](../../scripts/garmin/README.md)).
- **Where it runs:** `.github/workflows/garmin.yml`, at 11:00 and 17:00 UTC, with `concurrency: garmin`. `sync.py` reads the tokens from Coach, refreshes them, and stores new tokens at once (`TokenKeeper`, `sync.py:160-193`).
- **Does it read or write?** Today it only reads. It does not call any workout endpoint.
- **Can the same session push workouts?** Yes, probably. The installed library has all the calls in section 2. The local DI token has the scopes `CONNECT_READ` and `CONNECT_WRITE` (I decoded only the scope claim; I printed no token). A real write is not tested.
- **Care point:** a push job must use the same token row and the same `concurrency: garmin` group. If two jobs refresh the same refresh token, one of them can fail auth (README, "Only one run goes at a time").

## 4. FIT workout files

Source: the Garmin FIT SDK, [Workout File](https://developer.garmin.com/fit/file-types/workout/) and [Encoding FIT Workout Files](https://developer.garmin.com/fit/cookbook/encoding-workout-files/). The page text loads with JavaScript. I read the article HTML at `developer.garmin.com/fit/articles/...`.

- **Structure:** `file_id` (type 5), then one `workout` (`wkt_name`, `sport`, `num_valid_steps`), then `workout_step` messages in order.
- **Step fields:** `message_index`, `wkt_step_name`, `duration_type`, `duration_value`, `target_type`, `target_value`, `custom_target_value_low/high`, `intensity`, `notes`, `equipment`.
- **Intensity:** 0 active, 1 rest, 2 warmup, 3 cooldown, 4 recovery, 5 interval, 6 other.
- **Duration:** time in ms (`duration_time` in s), distance in cm (`duration_distance` in m), `open` = "continue until lap button press".
- **Repeat:** a step after the block with `duration_type = repeat_until_steps_cmplt (6)`, `duration_value` = the index to repeat from, `target_value` = the count.
- **Custom targets:** HR and power are absolute or relative. Relative HR is 0–100 % of **max HR** (not LTHR). Relative power is 0–1000 % of FTP. Absolute values add an offset: bpm + 100, watts + 1000. Speed is m/s × 1000. Cadence has no offset.
- **No ramp** duration or target exists in the step model.
- **Sport:** Garmin devices accept only some sport/sub-sport pairs. Running = running + omitted sub-sport. Cycling = cycling + omitted.
- **To a watch over USB:** put the file in `Garmin/NewFiles` (the cookbook steps). Some devices limit the step count, so use repeat steps.
- **Garmin Connect import:** Garmin Connect imports activities and courses, not workout FIT files. The source is community posts in the Garmin forum, not a Garmin doc ([forum 294287](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-web/294287/export-import-garmin-workouts), [forum 379276](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-web/379276/fit-upload-problems)). **Unconfirmed** by a Garmin doc.

**Verdict:** FIT is a good file format for one device over USB and for tests. It is not a good bridge for us: it does not get to the Garmin Connect calendar, and a USB copy is manual. intervals.icu accepts FIT and can export FIT (section 6). Garmin can also export a stored workout as FIT (`download_workout`). So we can compare files, but we do not need to write FIT ourselves.

## 5. Zwift

### The `.zwo` format

Zwift has no public spec. The best reference is [h4l/zwift-workout-file-reference](https://github.com/h4l/zwift-workout-file-reference/blob/master/zwift_workout_file_tag_reference.md). Its author made it "by analysing all of the workouts included with Zwift" and calls it "a work in progress."

- **Root:** `<workout_file>` with `<author>`, `<name>`, `<description>`, `<sportType>` (`bike`/`run`), `<tags>`, optional `<ftpOverride>`, and `<workout>`.
- **Blocks:** `<Warmup>`, `<Cooldown>` and `<Ramp>` (`Duration`, `PowerLow`, `PowerHigh`); `<SteadyState>` (`Duration`, `Power`); `<IntervalsT>` (`Repeat`, `OnDuration`, `OffDuration`, `OnPower`, `OffPower`); `<FreeRide>` (ERG off); `<MaxEffort>`.
- **Power** is a fraction of FTP (`0.95` = 95 %). `Duration` is in seconds.
- **Cadence:** `Cadence`, `CadenceLow`/`CadenceHigh`, `CadenceResting`.
- **Text:** `<textevent timeoffset="60" message="…"/>` inside a block.
- **HR targets:** none in the schema. Run files have a `pace` attribute with an undocumented meaning.
- Community reports: `IntervalsT` shows only one `textevent` per interval ([intervals.icu forum](https://forum.intervals.icu/t/zwo-workout-import-textevent/89392)).

### Where Zwift on macOS reads files

- Zwift support: copy the file to "Documents > Zwift > Workouts > your Zwift ID folder (numeric)". "Imported workouts are available on all devices after restarting Zwift." "Files larger than 64 KB are only available on the computer used for import." ([Zwift support, Custom Workouts](https://support.zwift.com/en_us/custom-workouts-ryGOTVEPs.md), read 2026-10-20).
- On this Mac, `~/Documents/Zwift/Workouts/` exists and holds one numeric ID folder. `/Applications/Zwift.app` is installed.
- **Unconfirmed:** whether a new file shows in a running Zwift without a restart. Plan for a restart.

### How calendars get workouts into Zwift

- Zwift support lists "Platforms That Send Scheduled Workouts to Zwift": TrainingPeaks, TrainerRoad, Intervals.icu, Xert and more. Garmin Connect is not a workout source ([Zwift and Third-party Platforms](https://support.zwift.com/en_us/zwift-and-third-party-platforms-SypU0LdVr.md)).
- TrainingPeaks workouts for Zwift must "use % FTP and duration for cycling workouts" ([Custom Workouts](https://support.zwift.com/en_us/custom-workouts-ryGOTVEPs.md)).
- A Zwift staff post (2024-12-11) announced the intervals.icu connection ([Zwift forum](https://forums.zwift.com/t/intervals-icu-and-best-bike-split-now-connected-with-zwift/641651)).
- **Public API:** none found. `developer.zwift.com` does not resolve (checked 2026-10-20). Partner access is described as a "Training Connections API" for approved providers ([Zwift Insider](https://zwiftinsider.com/tsoz-closer-look-training-connections), secondary). No public sign-up was found.
- **HR targets:** for intervals.icu → Zwift, David Tinker wrote "You can specify cadence targets but not heart rate" ([intervals.icu forum, post 12](https://forum.intervals.icu/t/intervals-icu-and-zwift-integration-is-live/81764)). Zwift uses power only for ride workouts.

## 6. Aggregators as a bridge

### intervals.icu

- **API access:** a personal API key from `/settings`. Use Basic auth with the user name `API_KEY` ([API access thread](https://forum.intervals.icu/t/api-access-to-intervals-icu/609)). The OpenAPI docs are at [intervals.icu/api/v1/docs](https://intervals.icu/api/v1/docs).
- **Create a planned workout:** `POST /api/v1/athlete/{id}/events`. It "accepts workouts in native Intervals.icu format ('description' field) as well as zwo, mrc, erg and fit files (use 'file_contents' or 'file_contents_base64')."
- **Bulk and idempotency:** `POST /api/v1/athlete/{id}/events/bulk?upsert=true` matches on `external_id` "created by the same OAuth application". `PUT /events/bulk-delete` deletes by `id` or `external_id`. **Unconfirmed:** whether `external_id` upsert works with an API key and not an OAuth app. If not, store the intervals.icu event `id` in Coach and use `PUT/DELETE /events/{eventId}`.
- **Other fields:** `category: WORKOUT`, `start_date_local`, `type` (e.g. `Run`, `VirtualRide`), `target` (`AUTO`/`POWER`/`HR`/`PACE`), `push_errors[]` (`service`, `message`, `date`), and `workout_doc` (the parsed steps). `GET /events/{id}/download{ext}` converts to `zwo`/`mrc`/`erg`/`fit`. Source: [OpenAPI docs](https://intervals.icu/api/v1/docs).
- **To Garmin:** "Intervals.icu will upload your next week of planned workouts." "Workouts are automatically updated whenever you make changes to your plan." The one-week window protects against Garmin API rate limits (David Tinker, [forum 1521](https://forum.intervals.icu/t/upload-planned-workouts-to-garmin-connect/1521), first post 2020-08-19). A "Press lap" option "only works on workouts pushed to Garmin devices via Garmin Connect integration" ([Workout builder, 2020-06-16](https://forum.intervals.icu/t/workout-builder/1163)).
- **Garmin API type:** David Tinker mentions `durationType: OPEN`, which is a Training API field name. So intervals.icu probably uses the official Training API. **Unconfirmed.**
- **Garmin problems reported:** some users saw HR targets missing on Connect and the device, and some saw workouts stop arriving ([forum 1521](https://forum.intervals.icu/t/upload-planned-workouts-to-garmin-connect/1521), [forum 130704](https://forum.intervals.icu/t/garmin-planned-workout-sync/130704)). Treat this as a real risk for HR-only runs.
- **To Zwift:** "Workouts for the next week are uploaded", a rolling week, every day. They show on the Zwift home screen and under Workouts → Custom → "Intervals.icu". Workouts are "% of FTP or % of threshold pace", so the FTP in intervals.icu must equal the FTP in Zwift (David Tinker, [forum 81764](https://forum.intervals.icu/t/intervals-icu-and-zwift-integration-is-live/81764), 2024-12-04). A user saw HR-zone workouts not sync to Zwift; %FTP worked ([forum 97528](https://forum.intervals.icu/t/solved-planned-workouts-not-syncing-to-zwift/97528)).
- **Text syntax:** `%FTP` (`95-105%`), watts (`200-240w`), `% LTHR`, `% HR` (of max), `Z2 HR`, pace (`4:00/km Pace`), `ramp 50%-75%`, cadence (`90rpm`), repeats (`6x`), and distance (`mtr`, `km`). "Nested repeats are not supported." ([Syntax quick guide](https://forum.intervals.icu/t/workout-builder-syntax-quick-guide/123701), community post, 2026-03-03). Absolute bpm syntax: **unconfirmed**.
- **Cost:** Garmin and Zwift upload are not gated in the subscription thread ([forum 25311](https://forum.intervals.icu/t/subscription-benefits/25311)). The price was not confirmed from a primary source.

### TrainingPeaks

"The API is available for approved developers only … At this time access to the API is not available for personal use." ([TrainingPeaks blog](https://www.trainingpeaks.com/blog/an-update-on-trainingpeaks-partner-api/), updated 2026-09-12, read 2026-10-20; [Partners API wiki](https://github.com/TrainingPeaks/PartnersAPI/wiki)). TrainingPeaks is not an option for Coach.

## 7. Step data model

Coach stores the steps as written ("% of LTHR", "Z4 top"). Each writer resolves the targets with the anchors from `src/lib/plan/zones.mjs` (FTP 265 W, LTHR 168) at sync time. The writer stores the anchors that it used, so a later change to FTP or LTHR shows which workouts are stale.

```jsonc
{
  "version": 1,
  "sport": "run",                       // run | ride
  "name": "Threshold A (run)",
  "notes": "Start reasonable, end with a few left in the tank.",
  "steps": [
    { "kind": "warmup", "duration": { "type": "time", "s": 600 },
      "target": { "type": "hr", "unit": "bpm", "low": 122, "high": 145 } },
    { "kind": "repeat", "count": 6, "steps": [
      { "kind": "work", "duration": { "type": "time", "s": 300 },
        "target": { "type": "hr", "unit": "pct_lthr", "low": 104, "high": 108 },
        "notes": "Top of Z4" },
      { "kind": "recovery", "duration": { "type": "time", "s": 120 }, "target": { "type": "open" } }
    ]},
    { "kind": "work", "duration": { "type": "time", "s": 900 },
      "target": { "type": "zone", "system": "hr", "zone": "Z2top" } },
    { "kind": "cooldown", "duration": { "type": "lap" }, "target": { "type": "open" } }
  ]
}
```

- `kind`: `warmup | work | recovery | rest | cooldown | repeat`.
- `duration`: `{type: "time", s}` | `{type: "distance", m}` | `{type: "lap"}`.
- `target`: `open` | `power` (`pct_ftp` or `watts`, low/high) | `hr` (`bpm` or `pct_lthr`) | `pace` (`s_per_km`, low = fast, high = slow) | `zone` (`hr` or `power`, a Coach zone name).
- Optional: `ramp: true` on a power target (low → high), `cadence: {low, high}`, and `notes`.

### Mapping

| Coach | (a) Garmin `workout-service` JSON | (b) Zwift `.zwo` | (c) FIT `workout_step` | (d) intervals.icu text |
| --- | --- | --- | --- | --- |
| `warmup` | `stepTypeId 1` | `<Warmup>` (a ramp) or `<SteadyState>` | `intensity 2` | heading `Warmup` |
| `work` | `interval` 3 | `<SteadyState>` | `active 0` or `interval 5` | step line |
| `recovery` / `rest` | 4 / 5 | `<SteadyState>` at low power | 4 / 1 | step line |
| `cooldown` | 2 | `<Cooldown>` | 3 | heading `Cooldown` |
| `repeat` (2 steady children) | `RepeatGroupDTO`, `numberOfIterations` | `<IntervalsT Repeat OnDuration OffDuration OnPower OffPower>` | trailing step, `duration_type 6` | `6x` line |
| `repeat` (other children) | `RepeatGroupDTO` | **unroll** to single blocks | trailing repeat step | `Nx` line |
| nested repeat (VO2 B 3 × [6 × 30/30]) | groups in a group: model allows it; device support **unconfirmed** | unroll | allowed by index refs; device support **unconfirmed** | **not supported**: write 3 blocks of `6x` with 5' between |
| time | `time` 2, seconds | `Duration` s | `duration_time` (ms raw) | `5m`, `30s` |
| distance | `distance` 3, meters | runs only; **lossy** for rides | `duration_distance` (cm raw) | `1km`, `400mtr` |
| lap button | `lap.button` 1 | **lossy:** `<FreeRide>` needs a `Duration` | `duration_type open` | "Press lap" option (Garmin only) |
| power % FTP | convert to watts (`power.zone` 2). Native % support **unconfirmed** | `Power` = fraction | value 0–1000 = % FTP | `95-105%` |
| power watts | `targetValueOne/Two` watts | watts ÷ FTP | watts + 1000 | `250-260w` |
| HR bpm | `heart.rate.zone` 4, bpm range | **lossy:** no HR. Map to the Coach zone power or use `FreeRide` + `textevent` | bpm + 100 | **unconfirmed**; use `% LTHR` |
| HR % LTHR | convert to bpm | as for HR bpm | convert to bpm (FIT % is of max HR) | `104-108% LTHR` |
| pace | `pace.zone` 6, m/s | **lossy** for rides; undocumented for runs | `speed`, m/s × 1000 | `4:00/km Pace` |
| zone | resolve to a range. Garmin `zoneNumber` uses Garmin's own zones, which can differ from Coach | resolve to power | resolve to a custom range | resolve to a range |
| ramp | **lossy:** no ramp. Split into 1-min steps or use one range | `<Ramp>`, `<Warmup>`, `<Cooldown>` | **lossy:** no ramp | `10m ramp 50%-75%` |
| cadence | secondary target `cadence` 3 | `Cadence`, `CadenceLow/High` | a second target is **unconfirmed**; FIT has one `target_type` per step | `90rpm` |
| notes | step `description` | `<textevent>` | `notes`, `wkt_step_name` | text before the duration |
| range on a steady step | low/high | **lossy:** ERG holds one value; use the middle | low/high | `low-high` |

## 8. Recommendation

### Architecture

1. **Coach (source of truth).** Add a `steps` JSONB column to `training_plan_activities` with a migration (see `DATABASE.md`). Keep `description` as the human text. Write pure functions `steps → intervals.icu text`, `steps → .zwo` and (later) `steps → Garmin JSON`, with fixture tests in the style of `scripts/garmin/test_mapping.py`.
2. **Bridge: intervals.icu.** A route or cron in Coach upserts the next 14 days of run and indoor-ride workouts as intervals.icu events (`type: Run` or `VirtualRide`, `category: WORKOUT`). intervals.icu sends a rolling week to Garmin Connect (runs) and Zwift (rides).
3. **Sync table.** Add `workout_syncs (activity_id, target, remote_id, content_hash, anchors, status, last_error, synced_at)`.
4. **Fallback A, Garmin direct.** If the test in Summary item 2 fails for HR targets, add a `push_workouts` step to the existing `garmin.yml` job. Use the same token row and the same concurrency group. Call `upload_workout`/`update_workout` and `schedule_workout`/`unschedule_workout`.
5. **Fallback B, Zwift local.** A launchd script on the Mac fetches `/api/plan/zwo?days=7` and writes `Coach/*.zwo` into the Zwift ID folder. Then restart Zwift.

### Idempotency

- One remote object per Coach activity. Store the remote id and a hash of the resolved steps plus date.
- **Changed steps:** intervals.icu `PUT /events/{id}`. Garmin direct: `update_workout` keeps the id and the schedule.
- **Moved date:** intervals.icu `PUT` with the new `start_date_local`. Garmin direct: unschedule, then schedule.
- **Skipped or deleted:** intervals.icu `DELETE /events/{id}`. Garmin direct: unschedule, then `delete_workout`.
- **Reconcile** on each run: list the remote window (intervals.icu `GET /events?oldest&newest`; Garmin `get_scheduled_workouts_by_period`). Remove Coach-owned items that have no Coach activity. Mark items with the `coach:` prefix in the name or description so the job never touches workouts that Paolo made by hand.

### Failure modes

| Failure | Effect | Detection |
| --- | --- | --- |
| intervals.icu → Garmin fails | Run not on the watch | `push_errors` on the event; Coach shows it |
| HR targets dropped on Garmin | Steps with no alerts | Read back (Garmin direct) or check the watch in the test |
| FTP differs (Zwift vs intervals.icu vs Coach) | Wrong watts in ERG | Compare FTP on each sync; warn |
| Garmin unofficial auth breaks | Fallback A stops | Same `auth_failed` banner as the vitals job |
| Mac asleep or Zwift not restarted | Fallback B file missing | Script writes a heartbeat to Coach |
| Plan changed after the device synced | Old workout on the watch | Show "synced at" against "edited at" in Coach |

### How to check a sync

1. After each push, read the remote object back. Compare the step count, the durations and the targets with the Coach steps. Store the result in `workout_syncs.status`.
2. intervals.icu: an empty `push_errors` on the event. `GET /events/{id}/download.fit` can be compared with the Coach steps.
3. Garmin direct: `get_workout_by_id` and `get_scheduled_workouts_by_period` show the stored workout and date. This catches the silent ID bugs from section 2.
4. The device: no API confirms that the watch has the workout. **Unconfirmed.** After the watch syncs, check the watch by hand in the first weeks.

### Open questions for Paolo

1. Do you have an intervals.icu account? Is it linked to Garmin Connect or Zwift now?
2. Do you have a TrainingPeaks account linked to Garmin or Zwift? Such a link can send duplicate workouts.
3. Which watch model do you use? Do you also use a Garmin Edge for outdoor rides?
4. For runs, do you want HR targets only (as in `PLAN-STRUCTURE.md`), or HR plus a pace range?
5. Do you accept a third party (intervals.icu) that holds your Garmin and Zwift links?
6. Is the FTP in Zwift 265 W now?
7. How should HR-only ride steps work in Zwift: map them to power, or use free ride with a text cue?

## Sources

Repo:
- `src/db/schema.ts` (`training_plan_activities`), `src/db/health-schema.ts` (`garmin_connections`)
- `src/lib/plan/zones.mjs`, `plans/PLAN-STRUCTURE.md`, `plans/2026-10-26.json`
- `scripts/garmin/README.md`, `login.py`, `sync.py`, `tokencrypt.py`, `coach_api.py`, `requirements.txt`
- `.github/workflows/garmin.yml`
- Installed `garminconnect` 0.3.19: `scripts/garmin/.venv/lib/python3.14/site-packages/garminconnect/{workout.py, api/workouts.py, api/devices.py, api/base.py, client/constants.py, client/tokens.py}`

Garmin:
- https://developer.garmin.com/gc-developer-program/training-api/
- https://developer.garmin.com/gc-developer-program/program-faq/
- https://developer.garmin.com/gc-developer-program/overview/
- https://forums.garmin.com/developer/connect-iq/f/discussion/431359/no-interval-details-in-workouts
- https://www8.garmin.com/manuals/webhelp/forerunner645/EN-US/GUID-F5EB9C7C-A74E-4A26-BFB5-1E6DA4399067.html
- https://developer.garmin.com/fit/file-types/workout/ (article HTML: https://developer.garmin.com/fit/articles/file-types/workout.html)
- https://developer.garmin.com/fit/cookbook/encoding-workout-files/ (article HTML: https://developer.garmin.com/fit/articles/cookbook/encoding_workout_files.html)
- https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-web/294287/export-import-garmin-workouts (community)
- https://www.runningworkout.fr/api-garmin (secondary)

Unofficial libraries:
- https://github.com/cyberjunky/python-garminconnect, issues #332, #333, #337, #370, #386, #416, #312, #444, #453
- https://github.com/matin/garth, https://github.com/matin/garth/discussions/222

Zwift:
- https://support.zwift.com/en_us/custom-workouts-ryGOTVEPs.md
- https://support.zwift.com/en_us/zwift-and-third-party-platforms-SypU0LdVr.md
- https://forums.zwift.com/t/intervals-icu-and-best-bike-split-now-connected-with-zwift/641651
- https://github.com/h4l/zwift-workout-file-reference/blob/master/zwift_workout_file_tag_reference.md
- https://zwiftinsider.com/tsoz-closer-look-training-connections (secondary)

intervals.icu:
- https://intervals.icu/api/v1/docs
- https://forum.intervals.icu/t/api-access-to-intervals-icu/609
- https://forum.intervals.icu/t/upload-planned-workouts-to-garmin-connect/1521
- https://forum.intervals.icu/t/garmin-planned-workout-sync/130704
- https://forum.intervals.icu/t/intervals-icu-and-zwift-integration-is-live/81764
- https://forum.intervals.icu/t/solved-planned-workouts-not-syncing-to-zwift/97528
- https://forum.intervals.icu/t/workout-builder/1163
- https://forum.intervals.icu/t/workout-builder-syntax-quick-guide/123701
- https://forum.intervals.icu/t/subscription-benefits/25311
- https://forum.intervals.icu/t/zwo-workout-import-textevent/89392

TrainingPeaks:
- https://www.trainingpeaks.com/blog/an-update-on-trainingpeaks-partner-api/
- https://github.com/TrainingPeaks/PartnersAPI/wiki
