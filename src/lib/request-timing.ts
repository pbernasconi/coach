import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Where a request's time goes, so a slow one says why in the Vercel logs and in its `Server-Timing` header.
 *
 * Every database call is an HTTPS request to Neon (its HTTP driver), so `timedFetch`, installed as Neon's fetch in
 * src/db/index.ts, times each one. A call slower than SLOW_DB_MS is logged on its own: that is almost always Neon
 * waking up (it suspends after 5 idle minutes). `withTiming` wraps a route handler and logs the request when it
 * took longer than SLOW_REQUEST_MS, with its database calls and whether the function had just started.
 */

const SLOW_DB_MS = 700;
const SLOW_REQUEST_MS = 1000;

type Timing = { queries: number; dbMs: number; slowestMs: number };
const current = new AsyncLocalStorage<Timing>();

// The first request a function instance serves also pays for starting it (loading the code).
let fresh = true;

export async function timedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const start = performance.now();
  try {
    return await fetch(input, init);
  } finally {
    const ms = performance.now() - start;
    const t = current.getStore();
    if (t) {
      t.queries += 1;
      t.dbMs += ms;
      t.slowestMs = Math.max(t.slowestMs, ms);
    }
    if (ms > SLOW_DB_MS) console.warn(`[timing] database call took ${Math.round(ms)} ms (Neon waking up?)`);
  }
}

export type Timed<R> = { result: R; serverTiming: string };

/** Runs `run`, and logs it when slow. `serverTiming` is the value for a `Server-Timing` response header. */
export async function withTiming<R>(label: string, run: () => Promise<R>): Promise<Timed<R>> {
  const coldFunction = fresh;
  fresh = false;
  const t: Timing = { queries: 0, dbMs: 0, slowestMs: 0 };
  const start = performance.now();
  const done = () => {
    const total = Math.round(performance.now() - start);
    if (total > SLOW_REQUEST_MS) {
      console.warn(
        `[timing] slow ${label}: ${total} ms, ${t.queries} database calls (slowest ${Math.round(t.slowestMs)} ms)` +
          (coldFunction ? ', first request of a new function instance' : '')
      );
    }
    return [
      `total;dur=${total}`,
      `db;dur=${Math.round(t.slowestMs)};desc="slowest of ${t.queries} calls"`,
      ...(coldFunction ? ['cold;desc="new function instance"'] : []),
    ].join(', ');
  };
  try {
    const result = await current.run(t, run);
    return { result, serverTiming: done() };
  } catch (error) {
    done();
    throw error;
  }
}
