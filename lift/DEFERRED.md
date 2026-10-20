# Deferred: things that need you

Work that is blocked on something only you can do or decide. Each item says what is needed and what is
already done around it. The build keeps going around these; nothing here blocks the next phase.

## Needs your accounts or devices

- **Apple developer details (TestFlight).** The upload pipeline is built (`.github/workflows/testflight.yml`)
  and skips itself until these exist. In GitHub → Settings → Secrets and variables → Actions (repository level,
  or the `testflight` environment):
  - Variables: `APPLE_TEAM_ID` (your Team ID, Membership page) and `LIFT_BUNDLE_ID` (e.g. `com.yourname.lift`).
  - Shortcut: once the secrets and variables below exist, run the **Apple setup** workflow (Actions → Apple setup →
    Run workflow). It registers the three App IDs with App Groups (and HealthKit on the app) through the App Store
    Connect API and says whether the app record exists. Use an API key with the **Admin** role for this.
  - By hand instead, in the developer portal (Certificates, Identifiers & Profiles), with `<id>` your `LIFT_BUNDLE_ID`:
    1. Identifiers → App Groups → register `group.<id>` (e.g. `group.com.yourname.lift`).
    2. Identifiers → App IDs → register three explicit App IDs: `<id>` (the app), `<id>.widgets` (the rest Live
       Activity) and `<id>.share` (the Share extension). On each, turn on **App Groups** and assign `group.<id>`.
       Live Activities need no capability of their own.
    3. On the app's App ID (`<id>` only, not the extensions), also turn on **HealthKit** (no clinical records, no
       background delivery): Lift saves each finished workout to Apple Health. The entitlement is in `ios/project.yml`;
       without the capability the archive fails to sign. CI's simulator builds are unsigned and do not need it.
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
- **App Group (sharing from Apple Notes).** The first TestFlight builds ship without the App Group entitlement, because
  `group.com.pbernasconi.lift` is not yet registered and assigned. Everything works except handing a shared note from the
  Share extension to the app (the Lock Screen +30s and Skip still work). To turn it on: developer.apple.com →
  Identifiers → + → App Groups → `group.com.pbernasconi.lift`; then on each of the three App IDs, App Groups →
  Configure → tick it → Save. Then restore the three `com.apple.security.application-groups: [$(LIFT_APP_GROUP)]`
  entitlement lines in `ios/project.yml`.
- **Real-device check.** Haptics (an earlier app found `.sensoryFeedback` silent on an iOS 26 device), Liquid
  Glass rendering, the rest-timer Live Activity with its +30s and Skip buttons, and sharing a note from Apple Notes
  to Lift can only be confirmed on your iPhone (CI builds them for the simulator without signing, so the App Group
  is not provisioned there).

- **Sync is on (done 2026-10-19).** The server runs at https://coach.paolobernasconi.com (also
  coach-paolo.vercel.app) with `LIFT_SYNC_TOKEN` set and `drizzle/0009_lift_sync.sql` applied. The repository
  variable `LIFT_SYNC_BASE_URL` puts that origin into every TestFlight build. To connect a phone: open Coach →
  Settings → Lift and tap **Open in Lift** on the iPhone (or scan the QR code with the camera). The
  `lift://sync?code=…` link carries a one-time code (15 minutes, single use), never the token: Lift trades it at
  `/api/lift/enroll` for the token, syncs, and opens Settings, where the Sync row says "Synced just now". Pasting the token by hand (Lift → Settings → Sync → Sync token) still works.
  Verified end to end on a simulator against production: push, pull and the link, then the test rows removed.

- **Gym visual licence (only if Lift ever goes public).** The exercise animations come from
  [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset); the media is © Gym visual and
  loads at runtime, never bundled. Lift is personal, so the screens show no credit. Before any public App Store
  release, get a licence from Gym visual and restore a credit, or switch to Everkinetic line art (CC BY-SA 4.0; a
  mapping for 21 of 30 exercises is in commit 48f512b, `lift/ios/ExerciseArt/`).
- **Two approximate animations.** Hip thrust shows a floor glute bridge and Plank shows a weighted front plank;
  the dataset has no exact match.

## Decisions made with a default (change any of them)

- **Tabs:** Week, History, Exercises, Settings.
- **Units:** the locale's unit (lb in the US, kg elsewhere) until you pick one in Settings; the choice is saved.
- **Planning:** fixed day templates (such as Upper A and Lower A), each an ordered list of exercises with sets, a
  rep target or range, an optional load and rest. Templates live on the Exercises tab (next to All exercises); Week
  plans a day from one, changes a planned day to another, or copies this week's template days to next week. A
  session planned from a template starts at the last session's load, plus one increment once every set hit the
  top of the range. No multi-week program (periodisation) yet.

## Smaller gaps (no input needed; noted so nothing is lost)

- The Share extension cannot open Lift by itself: iOS refuses `NSExtensionContext.open` from share extensions, and
  Lift does not use the private workarounds. After Send it says "Open Lift"; Lift then opens the note in Import
  (it checks the shared inbox whenever it comes to the front). If a later iOS allows the open, it happens at once.
