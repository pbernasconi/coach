#!/usr/bin/env node
// One-time step for a database that was made with db:push (production and its Neon branches, 2026-10-19):
// it records drizzle/0000_baseline.sql as applied, so later migrations run on top of it.
//
// It first checks that every table and column of the baseline snapshot exists with the same type, and it
// refuses on any difference. It writes one row to drizzle.__drizzle_migrations and changes nothing else.
//   DATABASE_URL=… node scripts/db/adopt-baseline.mjs          (check only)
//   DATABASE_URL=… node scripts/db/adopt-baseline.mjs --yes    (check, then record)
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { readMigrationFiles } from 'drizzle-orm/migrator';

const write = process.argv.includes('--yes');
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const [baseline] = readMigrationFiles({ migrationsFolder: 'drizzle' });
const snapshot = JSON.parse(readFileSync('drizzle/meta/0000_snapshot.json', 'utf8'));
const TYPE = { timestamp: 'timestamp without time zone', 'timestamp with time zone': 'timestamp with time zone' };

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const { rows } = await client.query(`
    SELECT c.relname AS "table", a.attname AS "column", format_type(a.atttypid, a.atttypmod) AS type
    FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped`);
  const live = new Map(rows.map((r) => [`${r.table}.${r.column}`, r.type]));
  const problems = [];
  for (const table of Object.values(snapshot.tables)) {
    for (const column of Object.values(table.columns)) {
      const key = `${table.name}.${column.name}`;
      const want = TYPE[column.type] ?? column.type;
      if (!live.has(key)) problems.push(`missing ${key}`);
      else if (live.get(key) !== want) problems.push(`${key} is ${live.get(key)}, the baseline has ${want}`);
    }
  }
  if (problems.length) throw new Error(`the database does not match the baseline:\n- ${problems.join('\n- ')}`);
  console.log(`The database matches the baseline (${Object.keys(snapshot.tables).length} tables).`);

  await client.query('CREATE SCHEMA IF NOT EXISTS drizzle');
  await client.query(
    'CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)'
  );
  const { rows: done } = await client.query('SELECT hash FROM drizzle.__drizzle_migrations');
  if (done.some((r) => r.hash === baseline.hash)) {
    console.log('The baseline is already recorded. Nothing to do.');
  } else if (done.length) {
    throw new Error(`drizzle.__drizzle_migrations already has ${done.length} other row(s); not touching it.`);
  } else if (!write) {
    console.log('Check only. Run again with --yes to record the baseline as applied.');
  } else {
    await client.query('INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)', [baseline.hash, baseline.folderMillis]);
    console.log(`Recorded 0000_baseline as applied (created_at ${baseline.folderMillis}).`);
  }
} finally {
  await client.end();
}
