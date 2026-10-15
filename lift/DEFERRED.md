# Deferred: things that need you

Work that is blocked on something only you can do or decide. Each item says what is needed and what is
already done around it. The build keeps going around these; nothing here blocks the next phase.

## Needs your accounts or devices

- **Apple developer details (TestFlight).** The upload pipeline is built (`.github/workflows/testflight.yml`)
  and skips itself until these exist. In GitHub → Settings → Secrets and variables → Actions (repository level,
  or the `testflight` environment):
  - Variables: `APPLE_TEAM_ID` (your Team ID, Membership page) and `LIFT_BUNDLE_ID` (e.g. `com.yourname.lift`).
  - In the developer portal (Certificates, Identifiers & Profiles), with `<id>` your `LIFT_BUNDLE_ID`:
    1. Identifiers → App Groups → register `group.<id>` (e.g. `group.com.yourname.lift`).
    2. Identifiers → App IDs → register three explicit App IDs: `<id>` (the app), `<id>.widgets` (the rest Live
       Activity) and `<id>.share` (the Share extension). On each, turn on **App Groups** and assign `group.<id>`.
       Live Activities need no capability of their own.
    Automatic signing (`CODE_SIGN_STYLE=Automatic` with the API key) then makes the three profiles. It can usually
    register missing App IDs itself, but registering the App Group and assigning it by hand avoids a failed first
    archive. Without the group, the Lock Screen +30s and Skip still work but the Share extension cannot hand notes
    to the app.
  - Secrets: `ASC_KEY_ID`, `ASC_ISSUER_ID` and `ASC_KEY_P8` (the contents of the `.p8`), from App Store Connect →
    Users and Access → Integrations → App Store Connect API, role App Manager.
  - Create the app record in App Store Connect with that bundle ID.
  Every push to `main` that touches the app then archives with automatic signing and uploads a build numbered by
  the CI run. Optional variable `LIFT_SYNC_BASE_URL` (https origin of the coach web app) turns sync on in
  those builds.
- **Real-device check.** Haptics (an earlier app found `.sensoryFeedback` silent on an iOS 26 device), Liquid
  Glass rendering, the rest-timer Live Activity with its +30s and Skip buttons, and sharing a note from Apple Notes
  to Lift can only be confirmed on your iPhone (CI builds them for the simulator without signing, so the App Group
  is not provisioned there).

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

- **Gym visual licence (only if Lift ever goes public).** The exercise animations come from
  [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset); the media is © Gym visual and
  loads at runtime, never bundled. Lift is personal, so the screens show no credit. Before any public App Store
  release, get a licence from Gym visual and restore a credit, or switch to Everkinetic line art (CC BY-SA 4.0; a
  mapping for 21 of 30 exercises is in commit 48f512b, `lift/ios/ExerciseArt/`).
- **Two approximate animations.** Hip thrust shows a floor glute bridge and Plank shows a weighted front plank;
  the dataset has no exact match.

## Decisions made with a default (change any of them)

- **Tabs:** Week, History, Exercises, Settings.
- **Units:** kg by default; lb available in Settings.
- **Plates and bar:** made-up defaults until you list your gym's plates and bars.
- **Planning:** fixed day templates (such as Upper A and Lower A), each an ordered list of exercises with sets, a
  rep target or range, an optional load and rest. Templates live on the Exercises tab (next to All exercises); Week
  plans a day from one, changes a planned day to another, or copies this week's template days to next week. A
  session planned from a template starts at the last session's load, plus one increment once every set hit the
  top of the range. No multi-week program (periodisation) yet.

## Smaller gaps (no input needed; noted so nothing is lost)

- The Share extension cannot open Lift by itself: iOS refuses `NSExtensionContext.open` from share extensions, and
  Lift does not use the private workarounds. After Send it says "Open Lift"; Lift then opens the note in Import
  (it checks the shared inbox whenever it comes to the front). If a later iOS allows the open, it happens at once.
- Importer: a free-text line under a workout title that is not followed by sets (for example "Felt strong") is
  still read as an exercise header without sets and listed as an issue on the review step, not kept as the
  session's note. Notes the importer does read (warm-up, next-time lines, set notes) are all kept now.
