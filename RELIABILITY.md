# Reliability

On 2026-10-19 one timestamp ('…+00' with 'Z' added) returned 500 on every page for about 10 minutes, and nothing
noticed. These guards exist so a bad value, a bad deploy or a bad migration cannot do that again.

| Guard | Where | Catches |
| --- | --- | --- |
| One time reader | `src/lib/db-time.mjs` + ESLint rule | Database times in an unexpected shape |
| Section isolation | `src/lib/safe.ts`, `SectionError`, `error.tsx` | One failed loader blanking a page |
| PR checks (required) | `.github/workflows/web.yml` | Type, lint, test, build, schema drift, loader errors on real Postgres |
| Staged deploys + rollback | `.github/workflows/deploy.yml`, `web.yml` ("web build"), `scripts/smoke.mjs`, `/api/health` | A deploy that breaks a page |
| Scheduled check | `.github/workflows/deploy-check.yml` | Data that breaks a page |
| Migrations on deploy | `scripts/db/migrate.mjs` (DATABASE.md) | Code that ships before its schema |

## Rules for new code

- **Database times**: read them with `toDate`, `toIso` or `toDay` from `src/lib/db-time.mjs`. Postgres sends a
  time as a `Date` or as text, depending on the driver.
- **A new page section**: load it with `load()` from `src/lib/safe.ts` and render `<SectionError label=… />` when
  it fails; an optional part (a banner) uses `safe()` with a fallback.
- **A large read** (more than a few KB, or one that runs on every page): read it through `cached()` from
  `src/lib/data-cache.ts`, with the tag of its data, and clear that tag (`clearCache`) in every writer of the
  data. Neon's plan has monthly quotas (20 GB out of the database, 100 CU-hours of compute); see "Data cache" below.
- **A new loader**: add it to `runChecks()` in `src/lib/health.ts`. `/api/health`, the CI integration test and the
  deploy check all run that list.
- **A new page**: add it to `PAGES` in `scripts/smoke.mjs`, and put `data-smoke="<name>"` on the root element of
  **every** return branch, empty states included. A branch without it reads as a failed page and rolls back a
  good deploy (2026-10-19, `/lift` with no sessions).
- **A new environment variable** a page needs at build time (`NEXT_PUBLIC_*`) must not be marked Sensitive in
  Vercel: the builds run in CI and receive Sensitive values only at runtime.

## Deploys

Vercel builds nothing from Git (`vercel.json`). The Hobby plan has two daily limits, and the workflows stay far
below them:

- **100 deployments a day.** Only a merge that changes the web app makes one (`deploy.yml` has the same paths filter
  as "web build": not `lift/`, Markdown, or other workflows). Pull requests upload nothing, except with the label
  `preview`.
- **5,000 file uploads a day.** Every `vercel deploy` passes `--archive=tgz`: a build (about 630 files, 16 MB) is a
  few archive files, not each changed file.

A merge goes live in about 3 to 4 minutes, and only after a check on the production data:

1. **On the pull request**, "web build" builds the production output (`vercel build --prod`, the PR merged into
   main), so a build that Vercel would reject fails the pull request. It uploads nothing.
2. **At the merge**, `deploy.yml` builds it as a production deployment with no domain. It applies new migrations, checks the build on the production data (`/api/health` and `/sign-in`), and only then
   promotes it (an alias swap). A failed check stops the deploy: production does not change. Merges in quick
   succession share one deploy (the concurrency group keeps one run waiting, the newest).
3. Then it renders every page in `PAGES` on coach.paolobernasconi.com as the owner. On a failure it promotes the
   build before it again and opens an `outage` issue assigned to the owner. The next merge deploys as usual;
   nothing stays pinned.

At a daily limit the deploy stops before the promote, production stays on the build before it, and the `outage`
issue says so. To redeploy main by hand, run the Deploy workflow (Actions → Deploy → Run workflow).

There is no staging before the merge (removed 2026-10-20): the check before the promote is the gate, and each staged
build used one of the 100 deployments a day. **Page speed** is a manual run on production (Actions → Perf).

**Previews are on demand:** add the label `preview` to a pull request. `preview.yml` deploys it with the Preview
environment (the Neon development branch, Clerk's development sign-in), checks it, and comments the link; each
later push to that pull request redeploys it.

## The checks

`scripts/smoke.mjs` calls `/api/health` (Bearer `HEALTH_TOKEN`: every loader, `/api/home`, and the migrations)
and renders each page in `PAGES` as the owner. The `x-coach-health` header grants that, for GET only.

- **Before a promote** (`deploy.yml`): `/api/health` and `/sign-in` on the deployment URL.
- **After a promote**: every page on production (`--pages --expect-deployment <id>`).
- **Preview deploy**: `/api/health` and `/sign-in` on the preview URL (`preview.yml`).
- **Every hour, after the Sync workflow** (`workflow_run`, while the database is awake): production, every page. A failure here opens an issue and does not roll back: without a
  new deploy, the cause is data, and the old build reads the same data.

Run it yourself: `HEALTH_TOKEN=… npm run smoke -- https://coach.paolobernasconi.com --pages`.

## Secrets

| Secret | In | Used by |
| --- | --- | --- |
| `HEALTH_TOKEN` | Vercel (Production, Preview), GitHub | `/api/health`, page rendering as the owner |
| `VERCEL_BYPASS_SECRET` | GitHub (Vercel automation bypass) | The check of protected `*.vercel.app` preview URLs |
| `VERCEL_TOKEN` | GitHub (team token "coach GitHub deploy check (rollback)", expires 2027-10-19) | Build, promote, rollback |
| `PROD_DATABASE_URL` | GitHub | Migrations at the merge (`deploy.yml`) |
| `NEON_API_KEY` | GitHub (Neon key "coach-usage-check", this project only) | The daily usage check (`neon-usage.yml`) |

## Data cache

The large reads (the Lift rows, the lab catalog and pages, the Garmin and Apple Health samples) go through
Vercel's Data Cache (`src/lib/data-cache.ts`). Each page load and nav prefetch read them again before, and with
the checks and the Perf runs that was 4.3 GB of Neon's 5 GB free allowance in 20 days (2026-10). A cached read
also does not wake the database, so cached pages are faster.

| Tag | Data | Cleared by |
| --- | --- | --- |
| `lift` | `lift_rows` (8 entries, split by id, each below the 2 MB entry limit) | Each applied Lift sync change |
| `vitals` | `health_samples`, `garmin_raw` | The vitals push, the Garmin raw push |
| `labs` | `lab_biomarkers`, `lab_categories`, `lab_results`, `lab_planned_draws`, `clinician_notes` | `POST /api/vitals/function` (the Function sync) and `POST /api/cron/cache?tag=labs` |
| `status` | The banner's connection status (`loadStatusCached`, 5 minutes) | Saves in Settings |

A write that clears no tag (a script on the database) shows within an hour. `/api/health` reads through the same
cache as the pages: the data it checks is the data the pages show. The cache key holds the loader's code, so a
deploy that changes a query reads fresh data. Outside Next (the CI integration test, scripts) the cache is off.

Perf runs on demand only: add the label `perf` to a pull request.

## Neon compute

Neon suspends the database after 5 idle minutes, and each wake-up costs at least those 5 minutes at 0.25 CU. Four
wake-ups an hour (the old schedules) were about 70 of the 100 CU-hours a month. So only one schedule touches the
database each hour: `sync.yml` at :17 (GitHub delays runs at :00 the most). The deploy check and the Garmin job start
when it ends (`workflow_run`), while the database is still awake; the Garmin job syncs the data when it is 2 hours
old, else only the workouts. Its backstop crons (11:17, 14:17, 17:17 UTC) use the same minute. A new scheduled job that reads the database must also start from Sync, not from its own cron.

The quotas are hard: 100 CU-hours and 20 GB of transfer a month (Launch plan). At one, Neon stops production until
the next month. `neon-usage.yml` reads the usage from the Neon API every day (it does not wake the database) and
opens a `neon-usage` issue at 50% or 80% of a quota, or when the month's pace would pass one. Each deploy renders
every page on production, so a day with many merges also uses Neon.
