# Deferred: things that need you

Work that is blocked on something only you can do or decide. Each item says what is needed and what is
already done around it. The build keeps going around these; nothing here blocks the next phase.

## Needs your accounts or devices

- **Apple developer details (TestFlight).** Needed: the bundle ID you want (placeholder `com.example.lift`),
  your Team ID, an App Store Connect app record, and an App Store Connect API key (issuer ID, key ID, `.p8`)
  saved as GitHub secrets `ASC_ISSUER_ID`, `ASC_KEY_ID` and `ASC_KEY_P8`. Until then CI builds and tests on
  the simulator only.
- **Real-device check.** Haptics (Trellis found `.sensoryFeedback` silent on an iOS 26 device), Liquid
  Glass rendering, and the rest-timer Live Activity can only be confirmed on your iPhone.

- **Turn on sync (server).** The sync API and dashboard are built and tested, but not deployed against Neon.
  1. Generate a token (`openssl rand -base64 48`) and set `LIFT_SYNC_TOKEN` in Vercel (Production).
  2. Create the tables once: `psql "$DATABASE_URL" -f drizzle/0009_lift_sync.sql`.
  3. Redeploy; `GET /api/lift/sync/pull` with the token should return `{"changes":[],"cursor":"0","hasMore":false}`.
  4. Enter the same token in the app's Settings (Sync) once that screen ships.

## Decisions made with a default (change any of them)

- **Tabs:** Week, History, Exercises, Settings.
- **Units:** kg by default; lb available in Settings.
- **Plates and bar:** made-up defaults until you list your gym's plates and bars.

## Product decisions to make

- **"Change workout" in the lift sheet.** Left out for now: swapping only the title would leave the old
  exercises in place. A real swap needs workout templates (which exercises a plan day holds) so the session's
  exercises can be replaced and undone. Tell me how you plan workouts (fixed A/B days? a program?) and I'll
  build templates.
- **"Add workout" on a day.** Waits on the same templates.
