import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { databaseDriver } from './driver.mjs';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// Neon serverless HTTP client - optimized for serverless environments
export const sql = neon(connectionString);

/**
 * Neon's HTTP driver unless DATABASE_DRIVER=pg (local Postgres only; see ./driver.mjs). The node-postgres
 * database is typed as the Neon one: the code here uses only the API both share (the query builder, and
 * `execute` resolving to an object with `rows`).
 */
export const db: NeonHttpDatabase<typeof schema> =
  databaseDriver(process.env) === 'pg'
    ? (drizzleNodePg(new Pool({ connectionString, max: 5 }), { schema }) as unknown as NeonHttpDatabase<
        typeof schema
      >)
    : drizzle(sql, { schema });
