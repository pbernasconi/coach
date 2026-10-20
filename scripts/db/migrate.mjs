#!/usr/bin/env node
// Applies the migrations in drizzle/ to DATABASE_URL (DATABASE_URL_UNPOOLED when set).
//
// The Deploy workflow (.github/workflows/deploy.yml) runs it at each merge, before it promotes the new build, so
// production gets each migration before the new code goes live; if a migration fails, nothing is promoted. A
// Vercel production build also runs it (VERCEL_ENV=production; `npm run build` calls it) unless SKIP_DB_MIGRATE=1.
// Preview and CI builds skip it. To run it yourself: node scripts/db/migrate.mjs --yes
//
// Migrations must keep the old code working (add tables and columns; drop or rename only in a later deploy),
// because the old deploy serves until the new one is live. See DATABASE.md.
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

// SKIP_DB_MIGRATE=1: a staged production build (web.yml) builds before the merge; the Deploy workflow migrates at
// the merge, before it promotes the build.
const skipped = process.env.SKIP_DB_MIGRATE === '1';
const run = (process.env.VERCEL_ENV === 'production' && !skipped) || process.argv.includes('--yes');
if (!run) {
  console.log(`db migrate: skipped (${skipped ? 'SKIP_DB_MIGRATE=1' : 'not a Vercel production build; pass --yes to run it on DATABASE_URL'})`);
  process.exit(0);
}
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error('db migrate: DATABASE_URL is not set');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, max: 1 });
const applied = async () => {
  const { rows } = await pool.query(`SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS ok`);
  if (!rows[0].ok) return 0;
  return Number((await pool.query('SELECT count(*) AS n FROM drizzle.__drizzle_migrations')).rows[0].n);
};
try {
  const { rows } = await pool.query(`SELECT to_regclass('public.users') IS NOT NULL AS has_schema`);
  const before = await applied();
  // A database made with db:push has tables but no migration rows; migrating it would fail on CREATE TABLE.
  if (rows[0].has_schema && before === 0) {
    throw new Error('the database has tables but no applied migrations. Run node scripts/db/adopt-baseline.mjs first (DATABASE.md).');
  }
  await migrate(drizzle(pool), { migrationsFolder: 'drizzle' });
  const after = await applied();
  console.log(`db migrate: ${after - before} new migration(s) applied, ${after} in total`);
} catch (error) {
  console.error('db migrate failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
