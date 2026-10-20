import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { databaseDriver } from './driver.mjs';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;
const usePg = databaseDriver(process.env) === 'pg';
const pool = usePg ? new Pool({ connectionString, max: 5 }) : null;

type Sql = NeonQueryFunction<false, false>;
const neonSql = usePg ? null : neon(connectionString);

/**
 * Raw SQL over node-postgres, with the two calls the app uses from Neon's client: the tagged template and
 * `sql.query(text, params)`. Both resolve to the rows. Only for DATABASE_DRIVER=pg (local Postgres and the CI
 * integration test).
 */
function pgSql(p: Pool): Sql {
  const run = async (text: string, params: unknown[] = []) => (await p.query(text, params)).rows;
  const tag = (strings: TemplateStringsArray, ...values: unknown[]) =>
    run(strings.reduce((text, part, i) => text + part + (i < values.length ? `$${i + 1}` : ''), ''), values);
  return Object.assign(tag, { query: run }) as unknown as Sql;
}

// Neon's HTTP client in production (DATABASE_DRIVER unset); node-postgres for a local Postgres. Code here may only
// use the tagged template and `sql.query` from it.
export const sql: Sql = pool ? pgSql(pool) : neonSql!;

/**
 * Neon's HTTP driver unless DATABASE_DRIVER=pg (local Postgres only; see ./driver.mjs). The node-postgres
 * database is typed as the Neon one: the code here uses only the API both share (the query builder, and
 * `execute` resolving to an object with `rows`).
 */
export const db: NeonHttpDatabase<typeof schema> = pool
  ? (drizzleNodePg(pool, { schema }) as unknown as NeonHttpDatabase<typeof schema>)
  : drizzle(neonSql!, { schema });
