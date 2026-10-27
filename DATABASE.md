# Database

Neon Postgres 17, project `falling-mud-04838480`. Branch `production` serves the app; branch `development` is a
copy for trying schema and data changes. The schema lives in `src/db/*schema*.ts`; `drizzle/` holds its
migrations, and the migrations are the only way the schema changes.

## Change the schema

1. Edit `src/db/*schema*.ts` (a new schema file also goes into `drizzle.config.ts`).
2. Run `npm run db:generate`. It writes `drizzle/NNNN_<name>.sql` and a snapshot. Read the SQL.
3. Keep the migration **additive**: new tables, new nullable columns, new columns with a default, new indexes.
   The old deploy keeps serving while the new one builds, so it must work on the new schema. Drop or rename in
   a later PR, after no deployed code reads the old shape.
4. Commit `drizzle/` with the schema change. CI fails a PR whose schema and migrations differ ("web checks").
5. Merge. The Deploy workflow (`deploy.yml`) runs `scripts/db/migrate.mjs` before it promotes the new build, so
   production has the new schema before the new code is live. A failed migration stops the deploy, and the old
   build keeps serving.

`/api/health` fails its `migrations` check when production is missing a migration of the deployed code.

## Run migrations yourself

`npm run db:migrate` applies `drizzle/` to `DATABASE_URL`. Use it for a local Postgres or a Neon branch. Set
`DATABASE_URL` to the database you mean: `.env.local` points at production.

## A database made with db:push

Production and its branches were made with `drizzle-kit push` until 2026-10-19, so they had no migration
records. `drizzle/0000_baseline.sql` is that schema, generated from `src/db` and checked column by column
against production. A database like that needs its baseline recorded once:

```bash
DATABASE_URL=… node scripts/db/adopt-baseline.mjs        # checks the database against the baseline
DATABASE_URL=… node scripts/db/adopt-baseline.mjs --yes  # then records 0000_baseline as applied
```

Production was adopted on 2026-10-19. `db migrate` refuses a database with tables and no records, and names
this step. A branch with tables that no migration made (hand-made tables) is easier to reset from production
than to adopt.

`drizzle-kit push` writes the schema straight to a database and leaves no migration behind, so the next
migration fails there. The `db:push` script is gone for that reason; use the steps above.

## What Claude costs

Every Claude API call Coach makes writes one row to `ai_usage` (`src/db/usage-schema.ts`, written by
`src/lib/ai-usage/store.ts`): the feature (`chat`, `chat_warmup`, `planner`, `planner_eval`), the model and effort,
the tokens (input, output, cache read, cache write), `cost_usd` priced by `src/lib/planner/cost.mjs`, how long it took,
whether it worked, and `ref_id`, the `coach_messages` or `plan_runs` row it belongs to. The chat's $10 and the
planner's $25 monthly caps add up this table. Rows from before 2026-10-27 were copied from those two tables.

`node --env-file=.env.local scripts/ai-spend.mjs` prints this month by feature and model, the last 14 days and the
last 6 months. One query answers most questions:

```sql
SELECT date_trunc('month', created_at) AS month, feature, model, COUNT(*) AS calls, SUM(cost_usd) AS usd
FROM ai_usage GROUP BY 1, 2, 3 ORDER BY 1 DESC, usd DESC;
```

A new Claude call adds its feature to `FEATURES` (`src/lib/ai-usage/usage.mjs`) and to the table's check in a
migration, and calls `recordAiUsage` once per answer.
