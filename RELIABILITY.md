# Reliability

On 2026-10-19 one timestamp ('…+00' with 'Z' added) returned 500 on every page for about 10 minutes, and nothing
noticed. These guards exist so a bad value, a bad deploy or a bad migration cannot do that again.

| Guard | Where | Catches |
| --- | --- | --- |
| One time reader | `src/lib/db-time.mjs` + ESLint rule | Database times in an unexpected shape |
| Section isolation | `src/lib/safe.ts`, `SectionError`, `error.tsx` | One failed loader blanking a page |
| PR checks (required) | `.github/workflows/web.yml` | Type, lint, test, build, schema drift, loader errors on real Postgres |
| Deploy check + rollback | `.github/workflows/deploy-check.yml`, `scripts/smoke.mjs`, `/api/health` | A deploy or data that breaks a page |
| Migrations on deploy | `scripts/db/migrate.mjs` (DATABASE.md) | Code that ships before its schema |

## Rules for new code

- **Database times**: read them with `toDate`, `toIso` or `toDay` from `src/lib/db-time.mjs`. Postgres sends a
  time as a `Date` or as text, depending on the driver.
- **A new page section**: load it with `load()` from `src/lib/safe.ts` and render `<SectionError label=… />` when
  it fails; an optional part (a banner) uses `safe()` with a fallback.
- **A new loader**: add it to `runChecks()` in `src/lib/health.ts`. `/api/health`, the CI integration test and the
  deploy check all run that list.
- **A new page**: add it to `PAGES` in `scripts/smoke.mjs`, and put `data-smoke="<name>"` on the root element of
  **every** return branch, empty states included. A branch without it reads as a failed page and rolls back a
  good deploy (2026-10-19, `/lift` with no sessions).

## The deploy check

`scripts/smoke.mjs` calls `/api/health` (Bearer `HEALTH_TOKEN`: every loader, `/api/home`, and the migrations)
and renders each page in `PAGES` as the owner. The `x-coach-health` header grants that, for GET only.

- **Preview deploy**: `/api/health` and `/sign-in` on the preview URL. The result shows on the PR commit.
- **Production deploy**: waits until coach.paolobernasconi.com serves the new commit, then runs everything. On
  a failure it rolls back to the deploy that served before and opens an `outage` issue assigned to the owner.
- **Every 30 minutes**: the same production check. A failure here opens an issue and does not roll back: without
  a new deploy, the cause is data, and the old deploy reads the same data.

Run it yourself: `HEALTH_TOKEN=… npm run smoke -- https://coach.paolobernasconi.com --pages`.

## After a rollback

Vercel holds new deploys back from production after a rollback. When the fix is on main and its preview check
passes, run `vercel promote <deployment-url>` (or undo the rollback in the Vercel dashboard); the deploy check
of that deploy then runs on production. A check that finds production pinned opens an issue and does not
roll back.

## Secrets

| Secret | In | Used by |
| --- | --- | --- |
| `HEALTH_TOKEN` | Vercel (Production, Preview), GitHub | `/api/health`, page rendering as the owner |
| `VERCEL_BYPASS_SECRET` | GitHub (Vercel automation bypass) | The check of protected `*.vercel.app` preview URLs |
| `VERCEL_TOKEN` | GitHub (team token "coach GitHub deploy check (rollback)", expires 2027-10-19) | Rollback |
