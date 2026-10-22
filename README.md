# Coach

A personal training app: an endurance and strength plan, Strava activities with TSS and fitness (CTL, ATL, TSB),
Garmin vitals, Function Health labs and the Lift iPhone app. Live at https://coach.paolobernasconi.com.

- CLAUDE.md: what is where, and the commands.
- COACH.md: the weekly planning workflow.
- COACH-API.md: the routes and the data sources.
- RELIABILITY.md: deploys, checks, the data cache and the Neon budget.
- DATABASE.md: schema changes and migrations.

## Lift sync and dashboard

The Lift iPhone app (`lift/`) syncs through two routes that follow `lift/SYNC.md`:

- `POST /api/lift/sync/push` and `GET /api/lift/sync/pull`. They're public to Clerk and check their own
  bearer token instead.
- The read-only dashboard is at `/lift`, behind the normal Clerk sign-in.

The code: `src/lib/lift-sync/` holds validation, last-writer-wins, cursors, push/pull orchestration, the
in-memory repository and the Drizzle repository. `src/lib/lift-dashboard/` holds the dashboard queries
and summaries. The tables are defined in `src/db/lift-schema.ts`; migrations create them
(DATABASE.md). The tests are in `scripts/lift-sync.test.mjs` (`npm test`).

Environment variables (set them in Vercel and in `.env.local`, and never commit real values):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string (already used by the rest of the app) |
| `LIFT_SYNC_TOKEN` | Long random secret the iPhone sends as `Authorization: Bearer <token>`. If it's unset, every sync request gets `401`. Generate one with `openssl rand -base64 48` |
| `APNS_KEY_P8`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_TOPIC` | The APNs auth key for Lift's push notifications (lift/PUSH.md). Without them nothing is sent |

Production builds apply new migrations by themselves; see DATABASE.md for a new database or a Neon branch.
