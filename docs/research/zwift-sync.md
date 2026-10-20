# Coach → Zwift on the iPad, automatically

Research date: 2026-10-20 (all pages read on this date unless noted). Every claim has a source. **Unconfirmed** means no primary source was found. This file continues `docs/research/structured-workouts.md` (sections 5 and 6) and does not repeat it.

No Zwift account was used. No request was sent to Zwift. Sources are docs, forum posts by the people who built the integrations, open-source code (cloned read-only into a scratchpad), and the local Zwift folder and logs on this Mac (read-only).

## Summary

1. **Recommendation: Coach → intervals.icu API → Zwift "Training Connections" → iPad.** This is the only fully automatic path that is official on the Zwift side. It is a third party, but Paolo already has the account and Coach already writes `.zwo`. Coach sends the same `.zwo` with `POST /events/bulk?upsertOnUid=true` and a stable `uid` per Coach activity.
2. intervals.icu uploads a **rolling week** of planned workouts to Zwift and deletes the old ones every day. On the iPad, today's workout is on the home screen; the week is under Workouts → Custom → "Intervals.icu" (section 3b).
3. **Zwift has no public or personal workout API.** The partner "Training Connections API" exists, but onboarding is by a Google Form, and platform builders report no answer for 10 months (section 2). An individual cannot get access.
4. **Zwift's private API** for custom workouts is a generic file store, `/api/zfiles` (protobuf `ZFileProto`, folder `customworkouts`, plus the `workouts.files` manifest). It is known only from the zoffline server clone. Using it from Coach needs Paolo's Zwift password, breaks Zwift's Terms of Service (clauses viii, xi, xiii), and has no stable contract. **Do not build it** (section 1).
5. **TrainingPeaks cannot be a bridge:** no personal API, and its only workout import is a manual `.zwo` upload into the Workout Library (section 3a).
6. **Fallback:** keep `scripts/zwift-workouts.mjs` (local `.zwo` folder). It works only after Zwift on the Mac starts and uploads the files (section 4).
7. **Risks to test first:** the FTP in intervals.icu must equal the Zwift FTP; edits can need a full restart of the Zwift app on the iPad; the Zwift API rejects some `.zwo` that the game accepts (section 3b).
8. **Update 2026-10-20 (section 6):** TrainingPeaks **is** a possible cloud bridge through its private web API (`tpapi.trainingpeaks.com`, cookie → 1 h bearer). It breaks the TrainingPeaks Terms of Use, needs Premium for dates after tomorrow, and needs a cookie or password refresh. intervals.icu stays the first choice; TrainingPeaks is the fallback. Zwift web has no workout upload.

---

## 1. Zwift's own (private) API for custom workouts

### 1.1 What this Mac shows (local, read-only)

- The manifest `~/Documents/Zwift/Workouts/6739093/workouts.files` is XML: `<custom_file_directory>` with one `<custom_file>` per workout (`name`, `time` = Unix seconds, `guid`, `checksum`, `deleted`) and an empty `<deleted_files/>`. It lists 5 files from 2025. The 4 `Coach - *.zwo` files written on 2026-10-20 are **not** in it. So Zwift has not seen them.
- The game log shows the sync at login: `---CloudSync::FindCloudFileID workouts.files`, then `path …/Workouts/6739093/workouts.files size 1077`, then `CloudSync ---UploadToCloud OK workouts.files` (`~/Documents/Zwift/Logs/Log.txt`, lines 736–870, last game run 2025-06-02). The same lines are in `Log (old 1).txt` (738–856) and `Log (old 2).txt` (703–813).
- The same log shows `Process Upcoming Workingout from 0, workout count: 0` and `… from 1 …` (Log.txt, lines 790–791). This is probably the fetch of partner-scheduled workouts. **Unconfirmed.**
- The checksum is a one-byte value (0–255). zoffline computes it as `(-sum(bytes)) % 256` (`workouts_manifest.py:20-21`). I tested this on the 5 local files: the result is **exactly 30 lower** than the manifest value for every file (146 vs 176, 55 vs 85, 121 vs 151, 98 vs 128, 101 vs 131). So the zoffline formula is close but not exact. The real algorithm is **unconfirmed**.
- The local `guid` values are small integers (7320–31473). zoffline makes its own guid from SHA-1 of the file name (`workouts_manifest.py:24-26`). How the real game assigns a guid is **unconfirmed**.

### 1.2 Endpoints, from the zoffline server clone

Source: `github.com/zoffline/zwift-offline`, commit `f5400f7` (2026-06-02), file `zwift_offline.py`. zoffline re-implements the Zwift server for the real game client. So its routes show what the game calls. It does not prove how the real server behaves.

| Call | Method, path | Body / reply | Source |
| --- | --- | --- | --- |
| Upload a file | `POST /api/zfiles` | Game: protobuf `ZFileProto {id, folder, filename, file (bytes), timestamp}`. Companion app (header `Source: zwift-companion`): JSON `{folder, name, content (base64)}`. Reply: `ZFileProto` (or JSON if `Accept: application/json`). The `.zwo` XML goes as raw bytes inside the protobuf. | `zwift_offline.py:1923-1965`; `protobuf/zfiles.proto:1-13` |
| List files | `GET /api/zfiles/list?folder=<folder>` | Reply: protobuf `ZFilesProto {repeated ZFileProto}` (no file bytes) | `zwift_offline.py:1968-1976` |
| Download a file | `GET /api/zfiles/{id}/download` | Raw file | `zwift_offline.py:1979-1987` |
| Delete a file | `DELETE /api/zfiles/{id}` | 200 | `zwift_offline.py:1990-2002` |
| Scheduled (partner) workouts | `GET /api/workout/schedule/list` | zoffline returns `[]` (a stub) | `zwift_offline.py:1466-1468` |
| Auth discovery | `GET /api/auth` | `{"realm":"zwift","url":"https://secure.zwift.com/auth/"}` | `zwift_offline.py:1621-1623` |

- **Folder name:** zoffline stores workouts and the manifest in folder `customworkouts` (`zwift_offline.py:977, 1026-1027, 1081`). It added a server-side manifest on 2026-05-31 (commit `50bfa24`, "Maintain server side workouts manifest"). That the real server uses the same folder name is **unconfirmed**.
- **How the iPad gets them:** the game uploads the `.zwo` files and `workouts.files` to the cloud store. Other devices read the store at login. Zwift support: "Imported workouts are available on all devices after restarting Zwift. Files larger than 64 KB are only available on the computer used for import." ([Custom Workouts](https://support.zwift.com/en_us/custom-workouts-ryGOTVEPs.md), updated 2026-09-28). The support page documents `.zwo` import on Mac and PC only. A user confirms the same flow: export `.zwo` on a laptop, "start zwift on the laptop to sync it so it's available in Zwift on my iPad" ([intervals.icu forum 81764, post 175](https://forum.intervals.icu/t/intervals-icu-and-zwift-integration-is-live/81764/175), 2026-02-03).
- **Exact order of calls** (does the iPad read the manifest first, then download each file?): **unconfirmed**.

### 1.3 Auth

- Token endpoint: `POST https://secure.zwift.com/auth/realms/zwift/protocol/openid-connect/token`, form body `client_id=Zwift_Mobile_Link`, `username`, `password`, `grant_type=password` (Keycloak password grant). Reply has `access_token`, `refresh_token`, `expires_in` (zoffline `scripts/get_game_info.py:13-28, 41`). An older path, `/auth/realms/zwift/tokens/access/codes`, is in `zwift-client` (`zwift/auth.py:39-41`, last commit 2018-04-09) and zoffline `online_sync.py:35-50`.
- Refresh: `grant_type=refresh_token` with the refresh token (`zwift-mobile-api/src/getAccessToken.js:8-13`; `zwift-client/zwift/auth.py:28-31`).
- **Token lifetime: unconfirmed.** The clients read `expires_in` and `refresh_expires_in` from the reply and do not hard-code values (`zwift-client/zwift/auth.py:55-56`). The values in zoffline (`expires_in: 1000021600`) are fake (`zwift_offline.py:4640`).
- The API host is `https://us-or-rly101.zwift.com` with `Authorization: Bearer <token>` (`scripts/get_game_info.py:53-59`).
- MFA, captcha or device checks on the password grant: **unconfirmed**.

### 1.4 Terms of Service, risk and breakage history

- Zwift ToS (Last Updated June 02, 2026, [zwift.com/terms](https://www.zwift.com/terms)) forbids: "viii. Reverse engineer any aspect of our Platform…"; "xi. Use any bots, scripts, automated programs, or other similar methods to interact with the Zwift Platform…"; "xiii. Develop or use any applications that interact with our Platform without our prior written authorization…". A Coach script that calls `/api/zfiles` with Paolo's password does all three.
- **Breakage history:**
  - July 2018: `zwift-mobile-api` moved to "Zwift's new Developer API". It "requires a special developer account, and won't work with regular rider accounts like before". "Zwift is not able to offer developer accounts to hobby developers" (`zwift-mobile-api/README.md:1-6`).
  - 2022: a Zwift backend engineer announced mandatory encryption of game ↔ server and game ↔ Companion traffic; "server clones" and "ZC clones" "will stop working" when it is enforced ([zwift-mobile-api issue #32](https://github.com/Ogadai/zwift-mobile-api/issues/32), 2022-06-25).
  - 2019: a user asked for "the ability to upload a workout via the API (instead of just having it in a folder to get sync)". There is no answer ([issue #24](https://github.com/Ogadai/zwift-mobile-api/issues/24)).
  - No open-source project that uploads custom workouts to the **real** Zwift server was found. A GitHub code search for `api/zfiles` finds only zoffline and its forks (searched 2026-10-20).
- **Verdict:** possible in theory, but there is no public client to copy. It needs a stored password, breaks the ToS, puts Paolo's Zwift account at risk, and can break at any game update. Not recommended.

## 2. Zwift's scheduled-workout integrations ("Training Connections")

- **What it is:** a partner API. Zwift's April 2024 roadmap: "Zwift's new training API will allow … Zwifter's to automatically pull workouts from other apps … a select number of partners … other partners will be able to sign up later this summer" (manda_F, Zwift Staff, [forum 629564](https://forums.zwift.com/t/this-season-on-zwift-april-2024/629564), 2024-04-30).
- **How it shows on the device** (TriDot launch, shooj, Community Forum Manager, [forum 632654](https://forums.zwift.com/t/tridot-integration-now-available-august-2024/632654), 2024-07-31): "Cycling workouts pushed over and scheduled for the current day will show up in the 'For You' carousel on your Zwift home screen as well as in the Custom Workouts folder." "Your TriDot workout will show up in the For You carousel on/within the hour of the scheduled time." Completed rides go back to the partner.
- **Partners today:** Zwift lists about 35 "Platforms That Send Scheduled Workouts to Zwift", including TrainingPeaks, TrainerRoad, Intervals.icu, Xert, Tredict, TrainerDay, Wahoo SYSTM, JOIN.cc. "Workout availability depends on the platform and may be limited to upcoming days." "Keep your FTP the same in Zwift and your third-party platform." Users connect in Companion (Settings → Connections) or at `zwift.com/settings/connections` ([Zwift and Third-party Platforms](https://support.zwift.com/en_us/zwift-and-third-party-platforms-SypU0LdVr.md), updated 2026-10-16).
- **Body format:** `.zwo` XML, checked against an XSD. David Tinker (intervals.icu): "The Zwift API is much fussier about zwo files than the Zwift app" ([forum 66650, post 24](https://forum.intervals.icu/t/zwift-integration-could-now-be-a-reality-soon/66650/24), 2024-12-08). A 2026 error text: "Error validating the workout file: … cvc-complex-type.4: Attribute 'PowerLow' must appear on element 'Warmup'" ([forum 81764, post 192](https://forum.intervals.icu/t/intervals-icu-and-zwift-integration-is-live/81764/192), 2026-09-09). Zwift "doesn't allow overlapping workout days" without different start and end times ([66650, post 44](https://forum.intervals.icu/t/zwift-integration-could-now-be-a-reality-soon/66650/44)). The API does not accept `show_avg` ([81764, post 51](https://forum.intervals.icu/t/intervals-icu-and-zwift-integration-is-live/81764/51)).
- **Public docs:** none found. `developer.zwift.com` did not resolve (previous research). `developers@zwift.com` sends the auto-reply "we're currently not monitoring this address" (platform builder, [forum 671308](https://forums.zwift.com/t/training-connections-api-how-does-a-coaching-platform-actually-apply-in-2026/671308), 2026-09-23).
- **How to apply:** a Google Form, posted by Zwift staff in 2024 "which will reach the team working on the Training API" ([632654, post 7](https://forums.zwift.com/t/tridot-integration-now-available-august-2024/632654/7), 2024-10-23). A forum moderator pointed to the same form in December 2025 and September 2026 and also suggested "pushing workouts to intervals.icu and leveraging their Zwift API access" (Paul_Southworth, Watopia Wayfinder moderator, [forum 661496, posts 3–4](https://forums.zwift.com/t/integrating-an-ai-coaching-agent-with-zwift-api-access-for-structured-workouts/661496), 2025-12-18). The NUA team filled the form in December 2025 and had no reply by 2026-10-14 (same thread, posts 7 and 11).
- **Can an individual get access?** No sign of it. The program is for training platforms. intervals.icu itself had to "wait for the public release of the API" in 2024 ([66650, post 5](https://forum.intervals.icu/t/zwift-integration-could-now-be-a-reality-soon/66650/5)). There is no public release, docs, or self-serve keys today.

## 3. Bridges Paolo already has

### 3a. TrainingPeaks → Zwift

- **API:** "The TrainingPeaks API is currently available for approved developers only." "At this time access to the API is not available for personal use." Page "Updated September 12, 2026, Published February 8, 2017" ([TrainingPeaks blog](https://www.trainingpeaks.com/blog/an-update-on-trainingpeaks-partner-api/)). Confirmed.
- **File import:** "Coaches and athletes can import planned .zwo files into their TrainingPeaks Workout Library … Click the ⋮ icon next to your preferred Workout Library folder, Choose 'Import Workout' … .zwo is the only compatible file type at this time" ([Import Planned Workouts](https://help.trainingpeaks.com/hc/en-us/articles/32432105650573), updated 2026-08-24). This is a manual web-UI step into the library, not onto a date.
- **Drag and drop:** uploads completed device files; "each workout will automatically populate on the corresponding date … based on the date information embedded within each file" (help article 204072034, updated 2026-08-24). This is for completed activities. Planned structured workouts by this path: **unconfirmed** (probably not).
- **Calendar sync:** `.ics` export only, "5 days of history and 14 days of future workouts" (help article 204072184). It is read-only for Coach.
- **Email-in of planned workouts:** none found. The only email feature found is "daily emails of your planned workouts" (help article 204073464), which is outbound.
- **TP → Zwift:** only structured workouts with duration and %Threshold Power; HR-based workouts "are not compatible with Zwift"; "Zwift only syncs today's workouts"; titles are required ([Connecting Zwift And TrainingPeaks](https://help.trainingpeaks.com/hc/en-us/articles/360020392591), updated 2026-08-24). Zwift support adds: "Completed TrainingPeaks workouts are removed from the Home Screen" ([Custom Workouts](https://support.zwift.com/en_us/custom-workouts-ryGOTVEPs.md)).
- **Verdict:** Coach cannot write to TrainingPeaks without an unofficial web API. TrainingPeaks is not a path.

### 3b. intervals.icu → Zwift

How it works (David Tinker, founder, [forum 81764](https://forum.intervals.icu/t/intervals-icu-and-zwift-integration-is-live/81764), first post 2024-12-04, edited to 2026-05-11):
- Connect once in intervals.icu `/settings` → Zwift → "Connect" (OAuth on Zwift). The user can choose to "only upload particular workouts (e.g. Virtual Ride's but not Runs)".
- "Workouts for the next week are uploaded. Zwift shows workouts for today on the home page." The week is under "Workouts → Custom and select 'Intervals.icu'".
- Rolling window: old workouts are removed; "That happens every day so its a 'rolling week' of stuff" (post 17, 2024-12-10). "Intervals.icu deletes 'old' workouts that it has uploaded so you should always have the next week of stuff" (post 109, 2025-01-31).
- Workouts go as % of FTP: "if your FTP on Intervals.icu is different to your FTP on Zwift then the workout power will be different. You can specify cadence targets but not heart rate" (post 12). HR-based workouts are not uploaded (post 36). Text events are uploaded to Zwift ([forum 96016](https://forum.intervals.icu/t/96016), 2025-03-30).
- Failed uploads get a **RETRY** button in intervals.icu (post 162, 2025-12-18). They also appear in the event's `push_errors` (API schema below).
- Completed Zwift rides come back to intervals.icu automatically (post 1).

How fast a change reaches the iPad:
- intervals.icu side: the trigger for re-upload after an edit (at once, or on the daily run) is **unconfirmed** for Zwift. For Garmin, David wrote "Workouts are automatically updated whenever you make changes" ([forum 1521](https://forum.intervals.icu/t/upload-planned-workouts-to-garmin-connect/1521)). One user saw edits arrive before he logged in (81764, post 114, 2025-01-31). Another saw edits not arrive (post 133, 2025-02-13).
- Zwift side: an edited workout showed the old steps on Apple TV. Zwift said this was "a side effect of ATV and the user not actually logging out", fixed in game 1.83. David: "this does imply that you might need to restart the app … to see changes even though the Intervals.icu folder appears to have updated" (post 118, 2025-01-31). For the iPad, plan to force-quit and reopen Zwift before a ride. iPad behaviour is **unconfirmed**.

The API calls Coach would use (OpenAPI spec at [intervals.icu/api/v1/docs](https://intervals.icu/api/v1/docs), read 2026-10-20). Auth: Basic, user `API_KEY`, password = personal API key (previous research, section 6).

| Need | Call | Notes from the spec |
| --- | --- | --- |
| Create or update the window | `POST /api/v1/athlete/{id}/events/bulk?upsertOnUid=true` | "Update events with matching uid instead of creating new ones". Unlike `upsert=true` (`external_id`), the spec gives **no** "same OAuth application" limit for `uid`. Accepts "zwo, mrc, erg and fit files (use 'file_contents' or 'file_contents_base64')". |
| Create one | `POST /api/v1/athlete/{id}/events?upsertOnUid=true` | Same body |
| Change one | `PUT /api/v1/athlete/{id}/events/{eventId}` | |
| Delete one | `DELETE /api/v1/athlete/{id}/events/{eventId}` | |
| Delete several | `PUT /api/v1/athlete/{id}/events/bulk-delete` | By `id`, or by `external_id` only for the same OAuth app |
| Read back | `GET /api/v1/athlete/{id}/events?oldest=…&newest=…&category=WORKOUT` | Returns `uid`, `updated`, `push_errors[] {service, message, date}`, `workout_doc` |
| Read as Zwift sees it | `GET /api/v1/athlete/{id}/events/{eventId}/download.zwo` | intervals.icu's own `.zwo` |
| Check the connection | `GET /api/v1/athlete/{id}` | Fields `zwift_user_id`, `zwift_upload_workouts`; `AthleteConnections.zwift_connected` |

- Body per event: `category: "WORKOUT"`, `type: "VirtualRide"`, `start_date_local`, `name`, `uid: "coach:<activity id>"`, and `file_contents: <the .zwo from src/lib/workouts/zwo.mjs>`.
- **Unconfirmed:** that `upsertOnUid` works with a personal API key (the spec suggests yes; test it). Whether intervals.icu keeps the uploaded `.zwo` byte-for-byte or re-generates it from `workout_doc` (it probably re-generates: David changes FreeRide/SteadyState output, post 22). Whether there is a "success" field for Zwift; only `push_errors` was found.
- **Cost:** Zwift upload is not listed as a paid feature (previous research, section 6). Price **unconfirmed**.

### 3c. Other services with a personal API that push to Zwift

- **Tredict:** a listed Zwift partner. It has a "Personal API" for "individual Tredict users" ([FAQ](https://www.tredict.com/faq/personal-api---connect-your-own-scripts-or-personal-applications)). Tokens deactivate after two weeks without a visit to the web UI (same page). The workout API places workouts inside **plans** (`POST /api/oauth/v2/plan`, `/plan/training`); "there is no dedicated endpoint" to put a workout on a calendar date outside a plan, and no step-edit or delete call is documented ([skills/workouts.md](https://www.tredict.com/skills/workouts.md)). Zwift shows "current ones plus those scheduled for the next week" ([Tredict Zwift FAQ](https://www.tredict.com/faq/zwift---automatically-synchronise-planned-and-completed-workouts/)). Weaker than intervals.icu for Coach. Subscription needs: **unconfirmed**.
- **TrainerDay:** listed partner. Its API has one public method, "get workouts"; a personal-calendar API needs a paid account, OAuth, and an email request to support ([trainerday.com/api](https://trainerday.com/api)). Not self-serve.
- Others in the Zwift list (Xert, Runalyze, 2PEAK, etc.) were **not checked** for a personal write API.

## 4. Reliability comparison

| | A. intervals.icu bridge (recommended) | B. Local `.zwo` folder (today) | C. Private Zwift `/api/zfiles` | D. Other partner (Tredict) | E. Own Training API access |
| --- | --- | --- | --- | --- | --- |
| Official on the Zwift side | Yes (partner API) | Yes (documented import) | No | Yes | Yes |
| Fully automatic to iPad | Yes | No: needs Zwift on the Mac to start | Yes, in theory | Partly (plan must be applied) | Yes |
| Setup | API key + athlete id in Coach env; connect Zwift once in intervals.icu `/settings`; tick only Virtual Ride upload | Already built (`scripts/zwift-workouts.mjs`, launchd) | Store Zwift password; re-implement protobuf and manifest | Personal token; plan model | Partner approval: no realistic path |
| Auth that can expire | intervals.icu API key (no expiry found); Zwift OAuth held by intervals.icu (one user had bad Zwift tokens and re-connected: 81764, post 147) | None | Password grant + refresh; lifetime unconfirmed | Token off after 2 weeks idle | — |
| Updates | Coach upserts on `uid`; intervals.icu re-uploads (timing unconfirmed) | Rewrite file; Mac Zwift must start | Re-upload file + manifest | `changeDate` only | — |
| Deletions | Coach deletes the event; intervals.icu drops old items daily | Delete file; manifest `deleted` flag set by the game | Delete + manifest | No delete documented | — |
| When the iPad sees it | Today's workout on home screen; week in Custom → Intervals.icu; restart the app to be safe | After the Mac game runs, then iPad restart | At iPad restart (assumed) | Next week window | — |
| Window | Next 7 days | Any | Any | Next week | — |
| Failure modes | FTP mismatch; Zwift XSD rejects a file (`push_errors`); HR targets not supported; stale app state; intervals.icu outage | Mac asleep or Zwift not opened (true since 2025) | Account ban; game update changes protocol or encryption; checksum mismatch (section 1.1) | Plan model mismatch | — |
| Breakage risk | Low to medium (one vendor, active; fixes in days, e.g. post 161) | Low, but not automatic | High | Medium | — |
| Can Coach verify? | Yes: read events back (`uid`, `updated`, `push_errors`), and the completed ride comes back from Zwift | Only the local file | `GET /api/zfiles/list` (unofficial) | Partly | — |

## 5. Recommendation

**Use intervals.icu as the bridge (path A).** It is the only fully automatic path that is official on the Zwift side. It is a third party. Zwift's own moderator suggests the same route to builders who cannot get partner access (section 2).

Next steps to build it in Coach:
1. Paolo connects Zwift in intervals.icu `/settings`. He enables workout upload for Virtual Ride only, so runs stay on the Garmin path.
2. Paolo sets the same FTP in Zwift, intervals.icu and Coach.
3. Add `INTERVALS_ATHLETE_ID` and `INTERVALS_API_KEY` to the Vercel env (Basic auth, user `API_KEY`).
4. Add a sync target `intervals` next to `zwift` in `src/lib/workouts/sync.mjs`. Reuse `planSync` and the `workout_syncs` table. Store the intervals.icu event id as `remote_id`.
5. Write `src/lib/workouts/intervals-api.mjs`: `upsertEvents` (`POST /events/bulk?upsertOnUid=true`, `uid = coach:<activity id>`, `file_contents` = the `.zwo` from `zwo.mjs`), `deleteEvent`, `listEvents`.
6. Run it from a Vercel cron (for example every 30 minutes) and after `/plan` and `/check-in`. Window: today + 7 days. Reconcile: delete Coach-owned events (`uid` starts with `coach:`) that have no Coach activity.
7. Read back after each run. Store `push_errors` in `workout_syncs.last_error` and show them in Coach.
8. Add fixture tests that check every `.zwo` against Zwift's stricter rules. For example, `Warmup`, `Cooldown` and `Ramp` always need `PowerLow` and `PowerHigh`.
9. Do a one-week test: one new workout, one edit, one move, and one delete. After each, check the iPad (force-quit and reopen Zwift). Record how long each change takes.
10. Confirm the completed ride comes back to intervals.icu. Optionally, Coach can mark the plan item "done" from that ride.

**Fallback:** keep `scripts/zwift-workouts.mjs` and the launchd job, with target `zwift` turned off by default. If intervals.icu fails, turn it on and open Zwift on the Mac once. The game then uploads the files, and the iPad gets them at its next start (section 1.2).

**Do not build:** a client for Zwift's private `/api/zfiles` (ToS, password, no stable contract). Do not wait for direct Training Connections access.

## Sources

Local (read-only, 2026-10-20):
- `~/Documents/Zwift/Workouts/6739093/workouts.files` and the 5 `.zwo` files in that folder
- `~/Documents/Zwift/Logs/Log.txt` (lines 736–870), `Log (old 1).txt` (738–856), `Log (old 2).txt` (703–813)
- Coach: `scripts/zwift-workouts.mjs`, `src/lib/workouts/sync.mjs`, `docs/research/structured-workouts.md`

Open-source code (cloned 2026-10-20):
- zoffline/zwift-offline @ `f5400f7` (2026-06-02): `zwift_offline.py` lines 355-360, 869-897, 960-1027, 1081, 1466, 1621-1623, 1923-2002, 4625-4686; `protobuf/zfiles.proto`; `workouts_manifest.py`; `intervals_workouts.py`; `online_sync.py:35-50`; `scripts/get_game_info.py:13-59` — https://github.com/zoffline/zwift-offline
- Ogadai/zwift-mobile-api @ `63e56cd` (2023-02-06): `README.md:1-6`, `src/getAccessToken.js`; issues #24, #30, #32 — https://github.com/Ogadai/zwift-mobile-api
- jsmits/zwift-client @ `02effd3` (2018-04-09): `zwift/auth.py` — https://github.com/jsmits/zwift-client

Zwift:
- https://support.zwift.com/en_us/custom-workouts-ryGOTVEPs.md (updated 2026-09-28)
- https://support.zwift.com/en_us/zwift-and-third-party-platforms-SypU0LdVr.md (updated 2026-10-16)
- https://www.zwift.com/terms (ToS, Last Updated June 02, 2026)
- https://forums.zwift.com/t/this-season-on-zwift-april-2024/629564
- https://forums.zwift.com/t/tridot-integration-now-available-august-2024/632654
- https://forums.zwift.com/t/integrating-an-ai-coaching-agent-with-zwift-api-access-for-structured-workouts/661496
- https://forums.zwift.com/t/training-connections-api-how-does-a-coaching-platform-actually-apply-in-2026/671308
- https://forums.zwift.com/t/workout-uploads/670217 (community posts, not staff)

intervals.icu:
- https://intervals.icu/api/v1/docs (OpenAPI JSON, read 2026-10-20)
- https://forum.intervals.icu/t/intervals-icu-and-zwift-integration-is-live/81764 (posts 1, 12, 17, 36, 44, 51, 109, 114, 118, 133, 147, 161–162, 175, 192)
- https://forum.intervals.icu/t/zwift-integration-could-now-be-a-reality-soon/66650 (posts 5, 24, 44)
- https://forum.intervals.icu/t/96016 (text events)
- https://forum.intervals.icu/t/upload-planned-workouts-to-garmin-connect/1521

TrainingPeaks:
- https://www.trainingpeaks.com/blog/an-update-on-trainingpeaks-partner-api/ (updated 2026-09-12)
- https://help.trainingpeaks.com/hc/en-us/articles/32432105650573 (Import Planned Workouts, updated 2026-08-24)
- https://help.trainingpeaks.com/hc/en-us/articles/360020392591 (Connecting Zwift And TrainingPeaks, updated 2026-08-24)
- TrainingPeaks help articles 204072034 (drag and drop), 204072184 (calendar sync), 204073464 (daily emails), read via the Zendesk help-center API

Other partners:
- https://www.tredict.com/faq/personal-api---connect-your-own-scripts-or-personal-applications
- https://www.tredict.com/skills/workouts.md
- https://www.tredict.com/faq/zwift---automatically-synchronise-planned-and-completed-workouts/
- https://trainerday.com/api

---

## 6. Cloud paths through web apps (2026-10-20)

Read date for every source in this section: 2026-10-20. No login was made. No request wrote to TrainingPeaks or Zwift. I sent only anonymous `GET` requests: the TrainingPeaks login page, the public `app.trainingpeaks.com` bundles (build `release-20261020-5fe1737`), and `GET /users/v3/token` without a cookie (reply: `401`). Open-source code was cloned read-only into a scratchpad.

Section 3a said "TrainingPeaks is not a path". That is true for the **official** API. This section shows that the **private web API** of app.trainingpeaks.com is a working path, with costs.

### 6.1 The TrainingPeaks web API (used by app.trainingpeaks.com)

**Hosts.** The web app reads `API_ROOT: 'https://tpapi.trainingpeaks.com'` and `CMS_ROOT: 'https://home.trainingpeaks.com'` (login) from `https://app.trainingpeaks.com/release-20261020-5fe1737/environment.js`. tp2intervals uses the same host (`boot/src/main/resources/application.yaml:3`).

**Auth flow (confirmed in 2 places):**
1. A browser login at `https://home.trainingpeaks.com/login` sets the cookie `Production_tpAuth` (tp2intervals `README.md:81-84`; trainingpeaks-mcp `src/tp_mcp/auth/validator.py:53-56`).
2. `GET https://tpapi.trainingpeaks.com/users/v3/token` with only that cookie returns `{"success": true, "token": {"access_token", "expires", ...}}`. The web app does this itself: `this._tokenUrl = apiRoot + "/users/v3/token"`, `xhrFields: {withCredentials: true}`, and it treats `success = false` or HTTP 401 as "logged out" (bundle `modules-1a25c13e.js`, function `_fetchToken`).
3. All other calls use `Authorization: Bearer <access_token>` (tp2intervals `TrainingPeaksApiClientConfig.kt:14-16`).
4. `GET /users/v3/user` returns the user id, `personId` (the athlete id), and the account flags `isAthlete`, `isPremium` (tp2intervals `user/TrainingPeaksUserDTO.kt:5-17`; trainingpeaks-mcp `validator.py:77-92`).

**Lifetimes:**
- Bearer token: about 1 hour. trainingpeaks-mcp reads `expires_in` and defaults to 3600 s (`src/tp_mcp/client/http.py:306`); its README says "short-lived OAuth access token (expires in 1 hour)" (`README.md:435`). To refresh, call `/users/v3/token` again with the cookie (the web app does the same).
- Cookie: **unconfirmed.** trainingpeaks-mcp: "typically after several weeks" (`README.md:441`). nagelflorian/trainingpeaks-mcp-server: "will expire when you log out or after an extended period of inactivity" (`README.md:54`). Nobody publishes an exact value.
- Cookie refresh: one Go client calls `GET https://home.trainingpeaks.com/refresh` with the cookie every 9 minutes and stores the new `Production_tpAuth` from `Set-Cookie` (kotovaleksandr/trainingpeaks-api `tpclient.go:16-17, 104-131`, `main.go:13, 35-46`). The public web bundle does not call this path. That it extends the session is **unconfirmed**.
- Failure shape: a dead cookie can return **HTTP 200** with `{"success": false, "token": null}`, not 401 (trainingpeaks-mcp [issue #181](https://github.com/JamsusMaximus/trainingpeaks-mcp/issues/181), 2026-09-30). The reporter later saw the same cookie work again, so some rejections are transient.

**Login protection (from the anonymous `GET /login`):**
- The form posts to `https://home.trainingpeaks.com/login` with `__RequestVerificationToken` (ASP.NET anti-forgery), `Username`, `Password`, `CaptchaToken`, `Attempts` and `SelectedMfaMethod`.
- It loads **Google reCAPTCHA v3** (`recaptcha/api.js?render=6LdCI94UAAAAAO5P5IEAytamTFyvC1azABMZWjlA`) and runs `grecaptcha.execute` on page load. v3 is invisible and score-based.
- The field `SelectedMfaMethod` shows that MFA exists. When TrainingPeaks asks for it is **unconfirmed** (no help article found).
- No Cloudflare. The login page and `tpapi` reply from IIS on EC2 (`x-server: EC2AMAZ-…`, `server: Microsoft-IIS/10.0`). The app is S3 + CloudFront.

**Workout endpoints** (base `https://tpapi.trainingpeaks.com`, bearer auth):

| Need | Call | Source |
| --- | --- | --- |
| List a date range | `GET /fitness/v6/athletes/{athleteId}/workouts/{YYYY-MM-DD}/{YYYY-MM-DD}` | tp2intervals `TrainingPeaksApiClient.kt:23-28`; trainingpeaks-mcp `tools/workouts.py:206` |
| Read one | `GET /fitness/v6/athletes/{athleteId}/workouts/{workoutId}` (and `/details`) | trainingpeaks-mcp `workouts.py:295, 313` |
| Create on a date | `POST /fitness/v6/athletes/{athleteId}/workouts` | tp2intervals `TrainingPeaksApiClient.kt:56-60`; trainingpeaks-mcp `workouts.py:523-524` |
| Update | `GET` the workout, change fields, `PUT /fitness/v6/athletes/{athleteId}/workouts/{workoutId}` with the whole object | trainingpeaks-mcp `workouts.py:646-713` |
| Delete | `DELETE /fitness/v6/athletes/{athleteId}/workouts/{workoutId}` | tp2intervals `TrainingPeaksApiClient.kt:62-66`; trainingpeaks-mcp `workouts.py:757-758` |
| Sport types | `GET /fitness/v6/workouttypes`; bike = `workoutTypeFamilyId: 2`, `workoutTypeValueId: 2` | trainingpeaks-mcp `workouts.py:130-146`; tp2intervals `TPTrainingTypeMapper.kt:9-10` |

Create body (trainingpeaks-mcp `workouts.py:485-519`; tp2intervals `CreateTPWorkoutRequestDTO.kt:7-18`):
- `athleteId`, `workoutDay: "2026-10-21T00:00:00"`, `workoutTypeFamilyId: 2`, `workoutTypeValueId: 2`, `title`, `description`, `totalTimePlanned` (hours), `tssPlanned`, `ifPlanned`.
- `structure`: a **JSON string** (not an object). Shape (trainingpeaks-mcp `tools/structure.py:82-200`; tp2intervals `ToTPStructureConverter.kt`, `TPTargetMapper.kt:8`):
  - top level: `structure: [...]`, `primaryLengthMetric: "duration"`, `primaryIntensityMetric: "percentOfFtp"`, `primaryIntensityTargetOrRange: "range"`, optional `polyline` (preview only).
  - each block: `type: "step"` with `length {value: 1, unit: "repetition"}`, or `type: "repetition"` with `length {value: <reps>, unit: "repetition"}`; plus `steps: [...]`.
  - each step: `name`, `type: "step"`, `length {value: <seconds>, unit: "second"}`, `targets: [{minValue: 88, maxValue: 94}]` (percent of FTP), optional cadence target `{minValue, maxValue, unit: "roundOrStridePerMinute"}`, `intensityClass` (`warmUp`, `active`, `rest`, `coolDown`, `other`; `tools/structure.py:19`), `openDuration: false`.
- The reply is the created workout with its `workoutId`. TrainingPeaks has **no** client id or upsert key. Coach must store the `workoutId` itself.
- The workout object has a field `syncedTo`. The web app shows "synced to Garmin" when `syncedTo` contains `"Garmin"` (bundle `modules-ec3328c5.js`, `_getGarminSyncStatusForWorkout`; field default in `modules-cf37ed01.js`). Whether Zwift ever appears in `syncedTo` is **unconfirmed**.

**Open-source clients and how they log in:**

| Project (last commit) | Language | Auth | Writes planned workouts? | Notes |
| --- | --- | --- | --- | --- |
| [freekode/tp2intervals](https://github.com/freekode/tp2intervals) (`5ffdc66`, 2026-04-12) | Kotlin | Paste `Production_tpAuth` | Yes: create, delete (no update) | Dedupe by a tag in the description. [Issue #114](https://github.com/freekode/tp2intervals/issues/114) (2026-02-19): a 3-minute schedule made about 180 duplicates in TrainingPeaks when the tag did not match. |
| [JamsusMaximus/trainingpeaks-mcp](https://github.com/JamsusMaximus/trainingpeaks-mcp) (`a412a84`, 2026-08-03) | Python | Cookie from browser, keyring, or env `TP_AUTH_COOKIE` | Yes: create, update, delete, structure | Best reference for the `structure` format. 60+ issues; many are wrong field names found by trial ([#60](https://github.com/JamsusMaximus/trainingpeaks-mcp/issues/60) `userTags`, [#81](https://github.com/JamsusMaximus/trainingpeaks-mcp/issues/81), [#172](https://github.com/JamsusMaximus/trainingpeaks-mcp/issues/172) `intensityClass`). |
| [Mitnitsky/tp-intervals-syncer](https://github.com/Mitnitsky/tp-intervals-syncer) (`9ccc254`, 2026-10-17) | TypeScript | **Username + password**, headless Chromium (Playwright) in GitHub Actions | No (reads TrainingPeaks) | `src/trainingpeaks.ts:6-7, 50-112`: open `/login`, close the cookie banner, fill the form, then poll `/users/v3/token` inside the page. Runs daily on `ubuntu-latest` (`.github/workflows/sync.yml:25`). Last 87 scheduled/manual runs: **83 success, 4 failure** (`gh run list`, read 2026-10-20). |
| [kotovaleksandr/trainingpeaks-api](https://github.com/kotovaleksandr/trainingpeaks-api) (`ad2cf97`, 2026-03-19) | Go | Pasted cookie + `/refresh` every 9 min | No | See cookie refresh above. |
| [pablo-albaladejo/kaiord](https://github.com/pablo-albaladejo/kaiord) (`1bcf7b6`, 2026-10-20) | JS | Browser extension uses the logged-in session | Yes: `POST /fitness/v6/athletes/{id}/workouts` (`packages/trainingpeaks-bridge/background.js:93, 190-209`) | Its research notes say the API returns 429 and clients wait about 150 ms between calls (`docs/connectors-research/trainingpeaks.md:52`). **Unconfirmed** by me. |

No n8n node or Home Assistant integration that **writes** TrainingPeaks workouts was found (GitHub code search for `tpapi.trainingpeaks.com`, 2026-10-20). That search found about 25 repositories; the list above is the relevant subset.

### 6.2 Account level: Basic or Premium

- "Plan future workouts" has an X only in the **Premium** column ([Basic vs Premium Athlete Accounts](https://help.trainingpeaks.com/hc/en-us/articles/204074014), updated 2026-08-24; I read the raw HTML table).
- "Planning features can only be added one day ahead in basic accounts" ([How do I add a workout…](https://help.trainingpeaks.com/hc/en-us/articles/204072244), updated 2026-08-24).
- tp2intervals shows a warning for dates after tomorrow: "Sync to futurte date will work only for TrainingPeaks Premium users" (`ui/src/app/components/copy-calendar-to-calendar/copy-calendar-to-calendar.component.html:38`). The author first blocked those dates, then changed it to a warning because the premium check "doesn't work" ([issue #103](https://github.com/freekode/tp2intervals/issues/103), 2025-04-14; release v0.12.2).
- The web bundle has a Premium upsell list with "Plan workouts in the future" (`modules-10317173.js` and others).
- **So:** a Basic account can plan **today and tomorrow** only. Whether `tpapi` rejects a `POST` for a later date on Basic, or the web UI only hides it, is **unconfirmed**.
- TP → Zwift sync: the TrainingPeaks and Zwift pages do **not** say it needs Premium ([360020392591](https://help.trainingpeaks.com/hc/en-us/articles/360020392591), updated 2026-08-24; [Zwift Custom Workouts](https://support.zwift.com/en_us/custom-workouts-ryGOTVEPs.md), updated 2026-09-28). That Basic accounts get the sync is **unconfirmed** but likely.
- Coach can read the account level from `GET /users/v3/user` (`isPremium`).
- Paolo's account level: **unknown**. He must check it.

### 6.3 TrainingPeaks → Zwift behaviour

- What syncs: "structured bike workouts that are based on a target Duration, your %Threshold Power". "Workouts based on heart rate … are not compatible with Zwift". "All workouts must have titles" ([360020392591](https://help.trainingpeaks.com/hc/en-us/articles/360020392591), updated 2026-08-24). Zwift adds: titles must be "unique … without special characters", and bike workouts must "Use % FTP and duration" ([Custom Workouts](https://support.zwift.com/en_us/custom-workouts-ryGOTVEPs.md) and [Completing Third-Party Workouts](https://support.zwift.com/en_us/completing-third-party-workouts-in-zwift-HkQF6L_NS.md), both updated 2026-09-28). Bike "Duration and RPE" is also listed ([115000325647](https://help.trainingpeaks.com/hc/en-us/articles/115000325647), updated 2026-08-24).
- Window: TrainingPeaks help still says "Zwift only syncs today's workouts" (360020392591). This text is **old**. Zwift game 1.66: "TrainingPeaks workouts now include the next seven days of workouts, which are available in the TrainingPeaks custom workouts folder" (shooj, Zwift staff, [forum 630366](https://forums.zwift.com/t/game-update-v-1-66-may-2024/630366), 2024-05-28). Today's workout is in the **FOR YOU** carousel "as long as it hasn't been completed" (Juan_Lopez10, Zwift staff, [forum 631407](https://forums.zwift.com/t/trainingpeaks-sync-showing-multiple-day-training-plans/631407), 2024-06-18).
- Repeats: "Completed TrainingPeaks workouts are removed from the Home Screen. To repeat a previous workout, rename the workout in TrainingPeaks" (Zwift, Custom Workouts). So Coach must put the date in every title, for example `Coach 2026-10-21 VO2 5x4`. Do not use `/`, `:` or `%`.
- Time zone: "make sure the time zone in your third-party platform matches the local time zone on your device" (Completing Third-Party Workouts, Troubleshooting).
- Edits and deletions: no TrainingPeaks or Zwift page says how fast an edit or a delete reaches Zwift. **Unconfirmed.** Plan to restart the Zwift app on the iPad before a ride (same as section 3b).
- Verification: TrainingPeaks has no documented Zwift sync status. `syncedTo` is documented only for Garmin (6.1). The reliable check is the completed Zwift ride coming back to TrainingPeaks (and to Strava, which Coach already reads).
- Known outages: TrainingPeaks maintenance and daylight-saving changes broke the sync for a time in earlier years (for example [forum 627196](https://forums.zwift.com/t/looks-like-the-connection-to-training-peaks-is-broken-today-march-2024/627196), March 2024). Community posts, not staff, except where marked.

### 6.4 TrainingPeaks → Garmin (brief)

- TrainingPeaks sends structured workouts to the Garmin Connect calendar "15 days into the future" on a rolling basis. "Any edits … immediately sync to Garmin Connect". A delete removes it from Garmin "immediately" ([115000325647](https://help.trainingpeaks.com/hc/en-us/articles/115000325647) and [204070864](https://help.trainingpeaks.com/hc/en-us/articles/204070864), updated 2026-08-24).
- "A Garmin Connect icon on the workout Quick View … indicates that the workout has been synced" (115000325647). This is the `syncedTo` field (6.1).
- Effect on Coach: if Paolo has the TP → Garmin planned-workout sync turned on, Coach's indoor rides in TrainingPeaks also appear on his Garmin calendar. Coach already pushes runs to Garmin directly (`scripts/garmin/workouts.py`). Turn the TP → Garmin planned sync off, or accept the bike workouts on the watch.

### 6.5 Zwift web

- zwift.com has **no** web workout builder, upload, or "My workouts" page. Zwift documents creation only in the game ("From the Home Screen, select WORKOUTS") and `.zwo` import only on "Mac/PC" ([Custom Workouts](https://support.zwift.com/en_us/custom-workouts-ryGOTVEPs.md), updated 2026-09-28).
- `https://www.zwift.com/workouts` returns 404. `my.zwift.com` redirects to `/feed`. The sitemap (`https://www.zwift.com/sitemap.xml`) has only news and video pages about workouts.
- A forum feature request to manage workouts on the web has stayed open since 2019-03-21 with no staff answer ([forum 53115](https://forums.zwift.com/t/managing-workouts-settings-customization-via-web-and-not-only-via-zwift-app/53115)).
- The only web feature that matters is `zwift.com/settings/connections` (OAuth to partners).
- So "Zwift from the cloud" means the private API of section 1. That verdict does not change.

### 6.6 Risk

**TrainingPeaks Terms of Use** ("Last Updated July 28, 2026", [trainingpeaks.com/terms-of-use](https://www.trainingpeaks.com/terms-of-use), a PDF):
- §18 Ownership Rights, license: "does not include the right to use any data mining, robots or similar automated means or methods to access any content on the Site."
- §18 Site Restrictions: "You will not … (c) use automated scripts to collect information from or otherwise interact with the Technology; … (f) reverse engineer … or otherwise attempt to derive … method of operation".
- §23 Your Obligations: "Access the Sites or Services by means of automated process, spiders, bots, or similar device".
- §13: "You may not utilize any unauthorized third-party technologies or services to obtain premium services or metrics without a subscription".
- A Coach job that calls `tpapi` breaks §18(c), §23 and probably §18(f). If it plans dates after tomorrow on a Basic account, it also breaks §13. The penalty is account termination (§14). No case of a banned account was found.

**Bot protection from GitHub Actions:**
- `tpapi`: no Cloudflare and no captcha found. Only the bearer token is checked. Rate limit 429 is reported by one project (6.1, unconfirmed).
- Login: reCAPTCHA v3 plus a possible MFA step. A headless login from GitHub Actions IPs works today for one project: 83 of 87 runs succeeded between 2026-08-12 and 2026-10-20 (Mitnitsky/tp-intervals-syncer). The 4 failures were not checked. reCAPTCHA v3 can lower the score of datacenter IPs at any time. **Unconfirmed** for Paolo's account.
- Breakage history: the API paths `fitness/v6` and `users/v3` are the same in all clients from 2024 (tp2intervals) to 2026 (trainingpeaks-mcp). The breakages found were field names and auth-reply shapes, not moved endpoints (issues above).

### 6.7 Comparison of the cloud paths

| | A. intervals.icu API (section 5) | T1. TrainingPeaks web API, pasted cookie | T2. TrainingPeaks web API, headless login | Z. Zwift private API (section 1) | W. Zwift web |
| --- | --- | --- | --- | --- | --- |
| Official on the write side | Yes (personal API key) | No (ToS §18, §23) | No (ToS §18, §23) | No (ToS viii, xi, xiii) | — |
| Official on the Zwift side | Yes (partner) | Yes (TrainingPeaks is a partner) | Yes | No | — |
| Runs in | Vercel cron | GitHub Actions or Vercel | GitHub Actions (needs Chromium) | Anywhere | Not possible |
| Secret | API key, no expiry found | `Production_tpAuth`, lasts "several weeks" (unconfirmed) | TrainingPeaks password; reCAPTCHA v3; MFA possible | Zwift password | — |
| Paolo's work | Once | Paste a new cookie every few weeks | Once, unless MFA or captcha blocks | Once | — |
| Window on the iPad | Next 7 days | Next 7 days with Premium; today + tomorrow with Basic | Same as T1 | Any | — |
| Idempotency | `upsertOnUid` | Coach stores `workoutId`; no upsert | Same as T1 | Coach stores file id | — |
| Verification | `push_errors`, ride comes back | No Zwift status; ride comes back | Same as T1 | `/api/zfiles/list` | — |
| Breakage risk | Low to medium | Medium (private API, but stable paths since 2024) | Medium to high (login page, captcha) | High | — |
| Account risk | None found | TrainingPeaks account | TrainingPeaks account | Zwift account | — |

### 6.8 Recommendation

1. **Keep path A (intervals.icu) as the primary path.** It is 100% cloud from Vercel, uses an official personal API key, and breaks no terms. Build it as written in section 5.
2. **Use T1 (TrainingPeaks web API with a pasted cookie) only as the fallback,** for example if intervals.icu stops its Zwift upload. Do not build T2 unless T1 cookies die too often. T2 stores a password and depends on reCAPTCHA.

Build steps for T1, if Paolo wants it:
1. Paolo checks his account level in TrainingPeaks. With Basic, the window is today + tomorrow; with Premium, today + 6 days.
2. Paolo logs in to app.trainingpeaks.com once and copies the `Production_tpAuth` cookie (DevTools → Application → Cookies).
3. Store the cookie in Coach, encrypted, with the same AES-256-GCM pattern as `scripts/garmin/tokencrypt.py` (key in a GitHub secret, never in Coach).
4. Add `scripts/trainingpeaks/` and a workflow next to `.github/workflows/garmin.yml`: hourly, `concurrency` group, `permissions: {}`. A Vercel cron also works, because no browser is needed.
5. Each run:
   1. `GET /users/v3/token` with the cookie. If the reply is 401 or `success: false`, stop, store "cookie expired", and show it in Coach.
   2. `GET /users/v3/user` once for `athleteId` and `isPremium`.
   3. `GET /fitness/v6/athletes/{id}/workouts/{start}/{end}` for the window.
   4. For each Coach indoor ride: `POST` if `workout_syncs.remote_id` is empty; else `GET` + `PUT`. Write `coach:<activity id>` as the first line of `description`, so a lost `remote_id` can be found again and no duplicate is made.
   5. `DELETE` Coach-owned workouts (marker in `description`) that have no Coach activity. Never touch other workouts.
   6. Write title `Coach <YYYY-MM-DD> <title>` with letters, digits, spaces and `-` only. Write `structure` from the same steps that `src/lib/workouts/zwo.mjs` uses, with `percentOfFtp` targets.
   7. Wait at least 150 ms between calls.
6. Turn off TP → Garmin planned sync, or accept the bike workouts on the watch (6.4).
7. Verify: read the workout back after each write. Check the iPad once for a new workout, an edit, a move and a delete. Confirm that the completed Zwift ride comes back to TrainingPeaks and Strava.
8. Optional test before the build: call `GET https://home.trainingpeaks.com/refresh` with the cookie once a day and see if the cookie lives longer (6.1, unconfirmed).

What Paolo must do once (T1): check the account level; paste the cookie; connect Zwift to TrainingPeaks (already done); set the same FTP in Zwift and TrainingPeaks; then paste a new cookie when Coach says it expired.

**Fallback for everything:** the local `.zwo` folder (`scripts/zwift-workouts.mjs`, section 4). It is not cloud-only.

### Sources for section 6

TrainingPeaks (read via the Zendesk help-center API and the public site, 2026-10-20):
- https://help.trainingpeaks.com/hc/en-us/articles/204074014 (Basic vs Premium, updated 2026-08-24)
- https://help.trainingpeaks.com/hc/en-us/articles/204072244 (add a workout, updated 2026-08-24)
- https://help.trainingpeaks.com/hc/en-us/articles/360020392591 (Zwift, updated 2026-08-24)
- https://help.trainingpeaks.com/hc/en-us/articles/115000325647 (structured workout sync, updated 2026-08-24)
- https://help.trainingpeaks.com/hc/en-us/articles/204070864 (Garmin AutoSync FAQ, updated 2026-08-24)
- https://www.trainingpeaks.com/terms-of-use (PDF, Last Updated July 28, 2026; §13, §14, §18, §23)
- https://home.trainingpeaks.com/login (anonymous GET: form fields, reCAPTCHA v3)
- https://app.trainingpeaks.com/release-20261020-5fe1737/environment.js and the public bundles `modules-1a25c13e.js` (token), `modules-ec3328c5.js` and `modules-cf37ed01.js` (`syncedTo`), `modules-10317173.js` (upsell)

Zwift:
- https://support.zwift.com/en_us/custom-workouts-ryGOTVEPs.md (updated 2026-09-28)
- https://support.zwift.com/en_us/completing-third-party-workouts-in-zwift-HkQF6L_NS.md (updated 2026-09-28)
- https://forums.zwift.com/t/game-update-v-1-66-may-2024/630366 (staff, 2024-05-28)
- https://forums.zwift.com/t/trainingpeaks-sync-showing-multiple-day-training-plans/631407 (staff, 2024-06-17/18)
- https://forums.zwift.com/t/managing-workouts-settings-customization-via-web-and-not-only-via-zwift-app/53115
- https://forums.zwift.com/t/looks-like-the-connection-to-training-peaks-is-broken-today-march-2024/627196
- https://www.zwift.com/sitemap.xml, https://www.zwift.com/workouts (404)

Open-source code (cloned 2026-10-20):
- freekode/tp2intervals @ `5ffdc66`: `TrainingPeaksApiClient.kt`, `TrainingPeaksApiClientConfig.kt`, `token/*.kt`, `workout/CreateTPWorkoutRequestDTO.kt`, `workout/TPTrainingTypeMapper.kt`, `workout/structure/*.kt`, `user/TrainingPeaksUserDTO.kt` (all under `boot/src/main/kotlin/org/freekode/tp2intervals/infrastructure/platform/trainingpeaks/`), `README.md:81-84`, `CHANGELOG.md:5, 26`, UI line above; issues #103, #114, #122
- JamsusMaximus/trainingpeaks-mcp @ `a412a84`: `src/tp_mcp/auth/validator.py`, `src/tp_mcp/client/http.py`, `src/tp_mcp/tools/workouts.py`, `src/tp_mcp/tools/structure.py`, `README.md:435-441`; issues #60, #81, #85, #167, #172, #181
- Mitnitsky/tp-intervals-syncer @ `9ccc254`: `src/trainingpeaks.ts`, `.github/workflows/sync.yml`, `README.md`; run history via `gh run list`
- kotovaleksandr/trainingpeaks-api @ `ad2cf97`: `tpclient.go`, `main.go`
- nagelflorian/trainingpeaks-mcp-server @ `f1ec1f3`: `README.md:54-56`
- pablo-albaladejo/kaiord @ `1bcf7b6`: `packages/trainingpeaks-bridge/background.js`, `docs/connectors-research/trainingpeaks.md`
