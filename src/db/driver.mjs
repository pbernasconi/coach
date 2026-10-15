// Which Postgres driver `src/db/index.ts` uses. Production (Vercel + Neon) leaves DATABASE_DRIVER unset and
// gets Neon's HTTP driver, exactly as before. `DATABASE_DRIVER=pg` switches to node-postgres over TCP, for a
// local Postgres (lift/scripts/sync-e2e.sh): Neon's HTTP driver cannot reach a plain Postgres server.

/** @typedef {'neon-http' | 'pg'} DatabaseDriver */

/**
 * @param {Record<string, string | undefined>} env usually process.env
 * @returns {DatabaseDriver}
 */
export function databaseDriver(env) {
  const value = env.DATABASE_DRIVER?.trim() ?? '';
  if (value === '' || value === 'neon-http') return 'neon-http';
  if (value === 'pg') return 'pg';
  throw new Error(`DATABASE_DRIVER must be unset, "neon-http" or "pg"; got "${value}"`);
}
