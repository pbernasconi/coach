# Reliability

On 2026-10-19 one timestamp ('…+00' with 'Z' added) returned 500 on every page for about 10 minutes, and nothing
noticed. These guards exist so a bad value, a bad deploy or a bad migration cannot do that again.

| Guard | Where | Catches |
| --- | --- | --- |
| One time reader | `src/lib/db-time.mjs` + ESLint rule | Database times in an unexpected shape |
| Section isolation | `src/lib/safe.ts`, `SectionError`, `error.tsx` | One failed loader blanking a page |
| PR checks (required) | `.github/workflows/web.yml` | Type, lint, test, build, schema drift, loader errors on real Postgres |
| Staged deploys + rollback | `.github/workflows/deploy.yml`, `web.yml` ("web build"), `scripts/smoke.mjs`, `/api/health` | A deploy that breaks a page |
| Scheduled check | `.github/workflows/deploy-check.yml` | Data that breaks a page; a broken preview |
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
- **A new environment variable** a page needs at build time (`NEXT_PUBLIC_*`) must not be marked Sensitive in
  Vercel: staged builds run in CI and receive Sensitive values only at runtime.

## Deploys

Vercel builds nothing from Git (`vercel.json`): the Hobby plan allows 100 deployments a day, so each pull request
push makes one (its staged build) and a merge makes none. A production deploy is a promote of a build that already
exists, so a merge is live in seconds:

1. **On the pull request**, "web build" builds the production output (`vercel build --prod`, the PR merged into
   main), uploads it as a staged production deployment with no domain, and checks it on the production data
   (`/api/health?skip=migrations`). A pull request with new migrations skips that check: its loaders read tables
   production does not have yet, so the check runs at the merge, after the migrations. The job summary links
   the build.
2. **At the merge**, `deploy.yml` finds the staged build whose tree equals the merge commit's tree (when main moved
   since, it builds one), applies new migrations, checks the build again, and promotes it (an alias swap).
3. Then it renders every page in `PAGES` on coach.paolobernasconi.com as the owner. On a failure it promotes the
   build before it again and opens an `outage` issue assigned to the owner. The next merge deploys as usual;
   nothing stays pinned.

To redeploy main by hand, run the Deploy workflow (Actions → Deploy → Run workflow).

**Previews are on demand:** add the label `preview` to a pull request. `preview.yml` deploys it with the Preview
environment (the Neon development branch, Clerk's development sign-in), checks it, and comments the link; each
later push to that pull request redeploys it. At the daily limit, staging is skipped with a warning and the merge
builds instead.

## The checks

`scripts/smoke.mjs` calls `/api/health` (Bearer `HEALTH_TOKEN`: every loader, `/api/home`, and the migrations)
and renders each page in `PAGES` as the owner. The `x-coach-health` header grants that, for GET only.

- **Staged build, and before a promote**: `/api/health` and `/sign-in` on the deployment URL.
- **After a promote**: every page on production (`--pages --expect-deployment <id>`).
- **Preview deploy**: `/api/health` and `/sign-in` on the preview URL (`deploy-check.yml`).
- **Every 30 minutes**: production, every page. A failure here opens an issue and does not roll back: without a
  new deploy, the cause is data, and the old build reads the same data.

Run it yourself: `HEALTH_TOKEN=… npm run smoke -- https://coach.paolobernasconi.com --pages`.

## Secrets

| Secret | In | Used by |
| --- | --- | --- |
| `HEALTH_TOKEN` | Vercel (Production, Preview), GitHub | `/api/health`, page rendering as the owner |
| `VERCEL_BYPASS_SECRET` | GitHub (Vercel automation bypass) | The check of protected `*.vercel.app` preview URLs |
| `VERCEL_TOKEN` | GitHub (team token "coach GitHub deploy check (rollback)", expires 2027-10-19) | Staging, promote, rollback |
| `PROD_DATABASE_URL` | GitHub | Migrations at the merge (`deploy.yml`) |
