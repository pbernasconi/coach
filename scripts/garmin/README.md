# Garmin sync

Pulls data from Garmin Connect (the health pages and the performance pages) and posts it to Coach:

- the mapped daily metrics to `/api/vitals/sync` with `source: "garmin"` (table `health_samples`, which the pages use);
- every raw Garmin response, without the account ids, to `/api/vitals/garmin/raw` (table `garmin_raw`, the archive, so Coach can map more metrics later without fetching again).

The job uses the unofficial Garmin Connect API through the [`garminconnect`](https://github.com/cyberjunky/python-garminconnect) library (pinned in `requirements.txt`). Garmin can change or block this API at any time. When it breaks, the job fails, Coach keeps the data it already has, and the app shows a warning.

The workflow `.github/workflows/garmin.yml` syncs the data after each hourly Sync run once the last data sync is 2 hours old (`--fresh-hours 2`), and on a backstop schedule at 11:17, 14:17 and 17:17 UTC. GitHub starts scheduled runs hours late or skips them (the 11:00 run started at 15:44 on 2026-10-21), so no single run is relied on. You can also start it by hand with a `days` input.

## How it works

| File | Job |
| --- | --- |
| `sync.py` | The run: read the state from Coach, log in to Garmin, fetch, post, report. |
| `mapping.py` | Garmin responses → Coach samples. Pure functions. |
| `tokencrypt.py` | AES-256-GCM for the tokens. |
| `coach_api.py` | `GET/PUT /api/vitals/garmin`, `POST /api/vitals/sync` and `POST /api/vitals/garmin/raw` (batches under 3.5 MB), with retries on network errors, 429 and 5xx. |
| `login.py` | The one-time key setup and the Garmin login (MFA). |

The Garmin login tokens are stored in Coach, in the table `garmin_connections`, encrypted with AES-256-GCM. The key is the GitHub secret `GARMIN_TOKEN_KEY`, and a copy is in `~/.garminconnect/token_key` on your Mac. Coach stores only the ciphertext and cannot read the tokens.

Each run does these steps:

1. Read the state from Coach: the encrypted tokens, `synced_through` and `status`.
2. Decrypt the tokens. If Coach has no tokens (or cannot decrypt them), use the seed in the GitHub secret `GARMIN_TOKENS`.
3. Log in to Garmin with the tokens. The access token lasts about 24 hours; the library refreshes it from the refresh token when it is near expiry.
4. If the tokens changed (a seed, or a refresh), store them in Coach at once, before any data call. The job checks again after each Garmin call.
5. Fetch the window: max(3 days, the days since `synced_through` + 1), with at most 45 days of catch-up. So missed runs fill themselves in. `--days N` asks for at least N days.
6. Fetch and post in chunks of 7 days: the samples and the raw payloads of each chunk go to Coach before the next chunk starts. Then the once-a-run sources.
7. Continue an unfinished backfill (see [Backfill](#backfill)).
8. Report: on success `status: ok`, `synced_through` = today, and the tokens again. On a Garmin auth failure `status: auth_failed`. On other failures `status: error` with a short message; `synced_through` stays, so the next run fetches those days again.

A chunk is a success when every Coach batch is stored and at most 20% of its Garmin calls failed. The run is a success when every chunk of its window is. For a core source (summary, HRV, sleep, readiness, max metrics, weight), HTTP 404 means "no data for that day" and is not a failure. An optional source that answers any 4xx is skipped for the rest of the run, logged once, and not counted as a failure: some accounts and devices do not have it.

## Sources

| Kind (`garmin_raw.kind`) | Method (garminconnect 0.3.19) | When | Mapped metrics |
| --- | --- | --- | --- |
| `summary` | `get_user_summary(day)` | each day | RHR, stress, Body Battery, steps, energy, SpO2, intensity minutes, floors |
| `hrv` | `get_hrv_data(day)` | each day | HRV night, week, status, baseline |
| `sleep` | `get_sleep_data(day)` | each day | sleep stages, score, respiration, sleep HR, sleep stress, times awake, skin temperature |
| `readiness` | `get_training_readiness(day)` | each day | readiness and its factors. The morning readiness is the `AFTER_WAKEUP_RESET` entry of the same call, so there is no separate call for `get_morning_training_readiness`. |
| `max_metrics` | `get_max_metrics(day)` | each day | VO2max. Also holds heat and altitude acclimation, so there is no `get_heat_altitude_acclimation` call. |
| `heart_rates` | `get_heart_rates(day)` | each day | (raw only: the HR timeline) |
| `stress` | `get_stress_data(day)` | each day | (raw only: the stress and Body Battery timelines) |
| `training_status` | `get_training_status(day)` | each day | training status, acute and chronic load, ratio, 4-week load focus. Also holds the load balance and VO2max feedback, so there is no `get_training_four_week_load_balance` call. |
| `endurance_score` | `get_endurance_score(day)` | each day | endurance score |
| `hill_score` | `get_hill_score(day)` | each day | hill score |
| `race_predictions` | `get_race_predictions(day, day, "daily")` | each day | 5K, 10K, half, marathon |
| `body_battery_events` | `get_body_battery_events(day)` | each day | (raw only: sleep, activity and recovery events) |
| `body_composition` | `get_body_composition(first, last)` | each chunk | weight, body fat |
| `fitness_age` | `get_fitness_age_details(day)` | last day of each chunk | fitness age |
| `lactate_threshold` | `get_lactate_threshold()` | each run | LT heart rate and pace, on the day Garmin measured them |
| `lactate_threshold_history` | `get_lactate_threshold(latest=False, …, "daily")` | each backfill run, at most a year per call | LT heart rate and pace history |
| `cycling_ftp` | `get_cycling_ftp()` | each run | FTP, on the day it was set |
| `personal_records` | `get_personal_record()` | each run | (raw only) |
| `power_curve` | `get_power_curve(day − 89, day, "cycling")` | each run | (raw only) |
| `stamina_curve`, `running_economy` | `get_stamina_curve(day)`, `get_running_economy(day)` | each run | (raw only; empty for Paolo's account, so not stored) |
| `running_tolerance` | `get_running_tolerance(day − 27, day, "daily")` | each run | (raw only; empty for Paolo's account) |
| `hr_zones`, `power_zones` | `get_heart_rate_zones_v2()`, `get_power_zones()` | each run | (raw only) |

The redaction (`mapping.redact`) removes keys such as `userProfilePK`, `userId`, `userDailySummaryId`, `displayName`, `fullName` and email fields at any depth. It also removes any value that equals the account's profile id, display name or full name, so a renamed key does not leak. Device ids and activity ids stay.

`fixtures/raw_<kind>.json` holds one payload per kind with the exact shape of a real Garmin response but synthetic values (the repo is public): the day is 2030-01-15, the times are moved, the measured numbers are changed (the sleep stages still add up to the totals), device and activity ids and names are fake, and every list is cut to 60 items (about 1 hour). The older fixtures (`user_summary.json`, `sleep.json`, …) are synthetic too.

Only one run goes at a time: the workflow has `concurrency: garmin`, so a new run waits for the old one. A run on your Mac is not part of that group. If a Mac run and a workflow run both refresh the tokens, the second can fail auth. Before it reports `auth_failed`, a run reads Coach again and tries newer tokens if another run stored them.

## Planned runs on the watch

`workouts.py` puts Coach's planned runs on the Garmin Connect calendar as structured workouts (steps with heart
rate targets), so the watch shows them with step alerts after its next sync. Coach builds Garmin's workout JSON
(`src/lib/workouts/garmin.mjs`) and says what to do for the next two weeks (`GET /api/workouts/garmin`: create,
update or delete). The job does it with `upload_workout`, `update_workout`, `schedule_workout`,
`unschedule_workout` and `delete_workout`, reads each workout back with `get_workout_by_id` and compares the steps
(the library once stored heart rate as power without an error), then reports (`POST /api/workouts/garmin`, table
`workout_syncs`). A workout made in Garmin Connect by hand is never touched; Coach's are named `Coach · …`.

It runs after each data sync, and after each hourly Sync run. plan-apply.yml
starts it after an accept: `gh workflow run garmin.yml --repo pbernasconi/coach -f workouts_only=true`. A
local run: `COACH_URL=… CRON_SECRET=… .venv/bin/python sync.py --workouts-only [--dry-run]`.

## Activities from the watch

`activities.py` stores the watch's own record of the last 48 hours of workouts in Coach (`garmin_activities`):
the list item, the activity's summary page and a few of its time series (heart rate, running dynamics, power,
respiration, performance condition, stamina, Body Battery) at 600 points. That is 1 call for the list and 2 per new
activity. The Strava webhook starts a run with `activities` (`python sync.py --activities`) right after a workout,
in its own concurrency group, and every other run catches up after the workouts. Coach shows the values on the
activity page (`src/lib/activity/watch.mjs`).

## Metrics

| Coach metric | Garmin source | Notes |
| --- | --- | --- |
| `hrv_night_avg_ms` | `get_hrv_data` → `hrvSummary.lastNightAvg` | Garmin HRV is RMSSD-based, not SDNN. |
| `hrv_weekly_avg_ms` | `hrvSummary.weeklyAvg` | 7-day average. |
| `hrv_status` | `hrvSummary.status` | 0 none, 1 poor, 2 low, 3 unbalanced, 4 balanced. |
| `resting_hr_bpm` | `get_user_summary` → `restingHeartRate` | |
| `resting_hr_7d_avg_bpm` | `lastSevenDaysAvgRestingHeartRate` | |
| `stress_avg` | `averageStressLevel` | Negative values mean "not enough data" and are skipped. |
| `body_battery_high` / `body_battery_low` | `bodyBatteryHighestValue` / `bodyBatteryLowestValue` | |
| `steps` | `totalSteps` | |
| `active_energy_kcal` | `activeKilocalories` | |
| `spo2_pct` | `averageSpo2`, else sleep `averageSpO2Value` | Daily average, else overnight average. |
| `sleep_total_min` | `get_sleep_data` → `dailySleepDTO.sleepTimeSeconds` | Time asleep. Awake time is not included. |
| `sleep_deep_min` / `sleep_rem_min` / `sleep_awake_min` | `deepSleepSeconds` / `remSleepSeconds` / `awakeSleepSeconds` | |
| `sleep_core_min` | `lightSleepSeconds` | Garmin "light" sleep. |
| `sleep_score` | `sleepScores.overall.value` | |
| `respiratory_rate` | `averageRespirationValue` | Overnight average. |
| `training_readiness` | `get_training_readiness` → `score` | The morning entry (`AFTER_WAKEUP_RESET`), else the first entry. |
| `vo2max` | `get_max_metrics` → `generic.vo2MaxPreciseValue` | Running VO2max only. |
| `vo2max_cycling` | `get_max_metrics` → `cycling.vo2MaxPreciseValue` | Cycling VO2max. |
| `weight_kg` / `body_fat_pct` | `get_body_composition` → `dateWeightList` | Garmin sends grams. The last weigh-in of a day wins. |
| `intensity_minutes_moderate` / `_vigorous`, `floors_climbed` | summary `moderateIntensityMinutes`, `vigorousIntensityMinutes`, `floorsAscended` | |
| `hrv_baseline_low_ms` / `_high_ms` | `hrvSummary.baseline.balancedLow` / `balancedUpper` | |
| `sleep_avg_hr_bpm`, `sleep_avg_stress`, `sleep_awake_count` | `dailySleepDTO.avgHeartRate`, `avgSleepStress`, `awakeCount` | |
| `wrist_temp_delta_c` | sleep `avgSkinTempDeviationC` | Watches with the skin temperature sensor. |
| `readiness_sleep_factor`, `readiness_hrv_factor`, `readiness_recovery_time_h`, `readiness_acute_load` | the morning readiness: `sleepScoreFactorPercent`, `hrvFactorPercent`, `recoveryTime` (minutes, sent as hours), `acuteLoad` | |
| `training_status` | `trainingStatusFeedbackPhrase` of the primary device | Coach's code: 0 no status, 1 detraining, 2 recovery, 3 maintaining, 4 unproductive, 5 productive, 6 peaking, 7 overreaching, 8 strained, 9 paused (`trainingPaused`). Values up to 7 days old count for the day. |
| `training_load_acute` / `_chronic` / `_ratio` | `acuteTrainingLoadDTO.dailyTrainingLoadAcute` / `dailyTrainingLoadChronic` / `dailyAcuteChronicWorkloadRatio` | |
| `load_focus_anaerobic` / `_high_aerobic` / `_low_aerobic` | `metricsTrainingLoadBalanceDTOMap.*.monthlyLoadAnaerobic` / `AerobicHigh` / `AerobicLow` | 4-week load. |
| `endurance_score`, `hill_score` | `overallScore` | |
| `race_pred_5k_s` … `race_pred_marathon_s` | `time5K`, `time10K`, `timeHalfMarathon`, `timeMarathon` | Seconds. |
| `lactate_threshold_hr_bpm`, `lactate_threshold_pace_s_per_km` | `speed_and_heart_rate.heartRate`, `speed` | Garmin's speed is in units of 10 m/s: pace = 1000 / (speed × 10). |
| `cycling_ftp_w` | `functionalThresholdPower` | |
| `fitness_age` | `fitnessAge` | |
| `wear_min` | `get_heart_rates` → `heartRateValues` | Minutes with a heart rate (points × their 2-minute spacing). 0 when the day has none: the watch was not worn. Garmin still sends `includesWellnessData: true` and phone steps on such days, so only the heart rate tells. No row: the day was not synced. |

Garmin files a night of sleep and HRV under the date you wake up. The job uses the date of your Garmin profile time zone for "today". The mapping is in `mapping.py`. It is a pure function with tests in `test_mapping.py`.

Each run makes 12 Garmin calls per day, 2 per week of days (weight, fitness age) and 9 once a run, with 1 second between calls. That is about 16 seconds per day. A 3-day run takes about 1.5 minutes, a 45-day catch-up about 13 minutes, and the 550-day backfill about 2.5 hours.

The raw archive is about 270 KB of JSON per day (sleep alone is 180 KB, mostly the per-minute movement and SpO2). Postgres compresses it to about 50 KB per day, so the 550-day backfill is about 30 MB of the Neon free tier's 0.5 GB.

## Set up (one time)

1. Create the virtual environment:

   ```sh
   cd ~/work/personal/coach/scripts/garmin
   python3 -m venv .venv
   .venv/bin/pip install -r requirements.txt
   ```

2. Make the key. The script stores it as the GitHub secret `GARMIN_TOKEN_KEY` and in `~/.garminconnect/token_key` (mode 0600):

   ```sh
   .venv/bin/python login.py --new-key
   ```

3. Wait for the next workflow run, or start one: `gh workflow run garmin.yml --repo pbernasconi/coach`. The run moves the tokens from the old secret `GARMIN_TOKENS` into Coach. You do not have to log in to Garmin again.

4. Look at `/health` in Coach. It shows "Garmin: synced … ago". If the banner says that the Garmin login has expired, the old `GARMIN_TOKENS` secret was stale. Then do one of these:
   - Move the tokens from your Mac (no MFA): `CRON_SECRET=... .venv/bin/python login.py --from-local`
   - Or log in again: `CRON_SECRET=... .venv/bin/python login.py`

The repo must also have the secret `CRON_SECRET`. The `Sync` workflow uses the same secret. `login.py` asks for `CRON_SECRET` if the environment does not have it, and it does not store it.

## Log in again

Do this when `/health`, Settings or the banner says that the Garmin login has expired:

```sh
cd ~/work/personal/coach/scripts/garmin
CRON_SECRET=... .venv/bin/python login.py
```

The script asks for your email, password and MFA code. It does not store the password. It encrypts the tokens with your key and stores them in Coach. The next run uses them and fills in the missed days (up to 45). Add `--keep-local` to also save the tokens to `~/.garminconnect` for local dry runs. `--github-secret` also sets the plain-JSON secret `GARMIN_TOKENS` (the old path, only a seed now).

Do not run `login.py --new-key` again. A new key makes the tokens in Coach unreadable. The script refuses while `~/.garminconnect/token_key` exists.

## Test without posting

```sh
.venv/bin/python sync.py --dry-run --local-tokens
```

This uses `~/.garminconnect` and does not contact Coach. It fetches and maps 3 days and prints counts for each metric and the raw bytes for each kind. It does not print values.

After `login.py --from-local`, Coach and your Mac have the same refresh token. A local dry run can then refresh it, and if Garmin stops the old refresh token, the copy in Coach stops working. In that case, use the Coach tokens for a dry run instead: `COACH_URL=https://coach.paolobernasconi.com CRON_SECRET=... .venv/bin/python sync.py --dry-run`. That posts no samples and reports no run, but it stores refreshed tokens in Coach.

## Backfill

Paolo's Garmin history starts on 2025-04-20. To fetch all of it:

```sh
gh workflow run garmin.yml --repo pbernasconi/coach -f since=2025-04-20
```

That is about 550 days, 6,600 Garmin calls and 2.5 hours. The backfill is resumable:

- `--since` stores `backfill_from` in Coach. After each week of days, the job posts that week and stores `backfill_through`.
- A manual run spends up to 300 minutes on the backfill, and a scheduled run up to 45 minutes after its own window. So if the manual run stops (timeout, Garmin errors), the next runs continue from `backfill_through` + 1. Running the same command again also resumes. A different `since` starts over.
- When the backfill reaches the normal window, the job sets `backfill_from` to `null`. Settings shows the progress.
- The backfill goes from the oldest day to the newest, after the normal window, so new data does not wait for it.
- A failed week stops the backfill for that run; the next run tries the same week again.

`--days N` makes the window of one run bigger. It is not resumable, so use `--since` for anything long. The endpoints upsert, so a backfill can run again with no duplicates.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Done. Some calls can fail; the log shows the count for each call, and Coach shows the message. |
| 1 | Every Garmin call failed, every Coach batch failed, or Coach was down. |
| 2 | Garmin auth failed. Log in again. |
| 3 | Configuration: `COACH_URL`, `CRON_SECRET` or `GARMIN_TOKEN_KEY` is missing, or the key does not match the stored tokens. |

## What breaks

- **Garmin changes an endpoint or a field name.** The metric stops in Coach and the other metrics continue. Run a dry run to see which counts are zero. Then fix `mapping.py` and its fixtures.
- **Garmin changes the login flow.** `login.py` fails. Upgrade `garminconnect` in `requirements.txt` and try again.
- **Rate limits (HTTP 429).** The job waits 60, 120 and 240 seconds, then skips that call. For a backfill, use a larger `--delay`.
- **Coach is down.** Calls to Coach are retried after 2, 5, 15 and 30 seconds. After that, the run fails, and the next run catches up.
- **Garmin blocks GitHub runner IP addresses.** Calls fail from Actions but work locally.
- **The refresh token expires or Garmin revokes it** (for example after a password change). The banner says so. Log in again.
- **`GARMIN_TOKEN_KEY` is lost or changed.** The job cannot decrypt the tokens. Make sure the secret and `~/.garminconnect/token_key` are the same, or delete the key file, run `login.py --new-key`, then `login.py`.
- **GitHub turns off schedules** after 60 days without commits. The banner shows "Garmin has not synced for …". Turn the workflow on again in the Actions tab.

## Tests

```sh
cd scripts/garmin
.venv/bin/python -m unittest
```

`test_mapping.py` uses the JSON files in `fixtures/`. `test_sync.py` covers the encryption, the window, the Coach client and the full run with a fake Coach and a fake Garmin. The tests that need `garminconnect`, `cryptography` or `requests` are skipped when the package is not installed. `src/lib/vitals/garmin-contract.test.mjs` (`npm test`) checks that the units match the server.
