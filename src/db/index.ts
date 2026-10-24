import { neon, neonConfig, type NeonQueryFunction } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { databaseDriver } from './driver.mjs';
import * as schema from './schema';
import { timedFetch } from '@/lib/request-timing';

const connectionString = process.env.DATABASE_URL!;
const usePg = databaseDriver(process.env) === 'pg';
const pool = usePg ? new Pool({ connectionString, max: 5 }) : null;

type Sql = NeonQueryFunction<false, false>;
// Every Neon query is an HTTPS request; timing them shows a slow request's cause (src/lib/request-timing.ts).
if (!usePg) neonConfig.fetchFunction = timedFetch;
const neonSql = usePg ? null : neon(connectionString);

/**
 * Raw SQL over node-postgres, with the three calls the app uses from Neon's client: the tagged template,
 * `sql.query(text, params)` and `sql.transaction([queries])`. All resolve to the rows. As in Neon's client, a tagged
 * query runs when it is awaited, so `transaction` can run its queries on one connection, in order, between BEGIN
 * and COMMIT. Only for DATABASE_DRIVER=pg (local Postgres and the CI integration test).
 */
function pgSql(p: Pool): Sql {
  const run = async (text: string, params: unknown[] = []) => (await p.query(text, params)).rows;
  type Lazy = PromiseLike<unknown[]> & { text: string; params: unknown[] };
  const tag = (strings: TemplateStringsArray, ...values: unknown[]): Lazy => {
    const text = strings.reduce((t, part, i) => t + part + (i < values.length ? `$${i + 1}` : ''), '');
    return { text, params: values, then: (ok, fail) => run(text, values).then(ok, fail) };
  };
  const transaction = async (queries: Lazy[]) => {
    const client = await p.connect();
    try {
      await client.query('BEGIN');
      const out = [];
      for (const q of queries) out.push((await client.query(q.text, q.params)).rows);
      await client.query('COMMIT');
      return out;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };
  return Object.assign(tag, { query: run, transaction }) as unknown as Sql;
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
