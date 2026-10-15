# Deferred: things that need you

Work that is blocked on something only you can do or decide. Each item says what is needed and what is
already done around it. The build keeps going around these; nothing here blocks the next phase.

## Needs your accounts or devices

- **Apple developer details (TestFlight).** The upload pipeline is built (`.github/workflows/testflight.yml`)
  and skips itself until these exist. In GitHub → Settings → Secrets and variables → Actions (repository level,
  or the `testflight` environment):
  - Variables: `APPLE_TEAM_ID` (your Team ID, Membership page) and `LIFT_BUNDLE_ID` (e.g. `com.yourname.lift`;
    register it as an App ID, plus `<id>.widgets` for the Live Activity extension).
  - Secrets: `ASC_KEY_ID`, `ASC_ISSUER_ID` and `ASC_KEY_P8` (the contents of the `.p8`), from App Store Connect →
    Users and Access → Integrations → App Store Connect API, role App Manager.
  - Create the app record in App Store Connect with that bundle ID.
  Every push to `main` that touches the app then archives with automatic signing and uploads a build numbered by
  the CI run. Optional variable `LIFT_SYNC_BASE_URL` (https origin of the coach web app) turns sync on in
  those builds.
- **Real-device check.** Haptics (an earlier app found `.sensoryFeedback` silent on an iOS 26 device), Liquid
  Glass rendering, and the rest-timer Live Activity can only be confirmed on your iPhone.

- **Turn on sync (server).** The sync API and dashboard are built and tested, but not deployed against Neon.
  1. Generate a token (`openssl rand -base64 48`) and set `LIFT_SYNC_TOKEN` in Vercel (Production).
  2. Create the tables once: `psql "$DATABASE_URL" -f drizzle/0009_lift_sync.sql`.
  3. Redeploy; `GET /api/lift/sync/pull` with the token should return `{"changes":[],"cursor":"0","hasMore":false}`.
  4. Point the app at the server: set the `LIFT_SYNC_BASE_URL` build setting to the origin of your deployed coach
     web app (for example `https://<your-vercel-domain>`, https only, no path). It defaults to empty in
     `ios/project.yml`, which keeps sync off; the TestFlight job can pass it (`xcodebuild … LIFT_SYNC_BASE_URL=…`,
     for example from a repository variable). Xcode copies it into Info.plist as `LiftSyncBaseURL`.
  5. In the app, Settings → Sync → Sync token: paste the same token and tap Save and sync. The status row should
     read "Synced just now". Demo mode (`-demo`) never syncs.

- **Gym visual licence for exercise animations.** The exercise GIFs and thumbnails come from
  [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset), whose media is
  © Gym visual (https://gymvisual.com/). The dataset's text is MIT, but its license says cloning it grants no
  rights to the media. The app loads the GIFs at runtime from that repository (pinned commit) with the required
  attribution and does not bundle them. That is your call for personal TestFlight use; before any public App Store
  release, get a licence from Gym visual (their terms page blocked automated reading, so I could not check the
  tiers), or switch to Everkinetic line art (CC BY-SA 4.0); a hand mapping for 21 of 30 exercises is in git history
  (commit 48f512b, `lift/ios/ExerciseArt/`).
- **Two approximate animations.** Hip thrust shows a floor glute bridge and Plank shows a weighted front plank;
  the dataset has no exact match.

## Decisions made with a default (change any of them)

- **Tabs:** Week, History, Exercises, Settings.
- **Units:** kg by default; lb available in Settings.
- **Plates and bar:** made-up defaults until you list your gym's plates and bars.

## Smaller gaps (no input needed; noted so nothing is lost)

- Notes import drops session notes, warm-up notes, next-time hints and set notes (the store has no fields for them
  yet), and logged imported sets are stamped with the import time rather than the workout date.
- A Share extension for sending a note straight to Lift is not built yet (the import flow is ready for it).
- The Live Activity has no +30s or Skip buttons on the lock screen yet (needs App Intents).

## Product decisions to make

- **"Change workout" in the lift sheet.** Left out for now: swapping only the title would leave the old
  exercises in place. A real swap needs workout templates (which exercises a plan day holds) so the session's
  exercises can be replaced and undone. Tell me how you plan workouts (fixed A/B days? a program?) and I'll
  build templates.
- **"Add workout" on a day.** Waits on the same templates.
