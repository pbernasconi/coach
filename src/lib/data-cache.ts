import { revalidateTag, unstable_cache } from 'next/cache';

/**
 * The server data cache (Vercel's Data Cache) for the large, slow-changing reads: the Lift rows, the lab catalog
 * and results, and the Garmin and Apple Health samples. Neon's plan has monthly quotas for data out of the database
 * (20 GB) and for compute (100 CU-hours), and these reads were most of the transfer: each page load and each nav prefetch read them again. A cached read
 * also does not wake the database, so a cached page is faster.
 *
 * A write clears its tag (`clearCache`): the Lift sync push, the vitals and Garmin pushes, and the Function sync
 * (POST /api/cache). A write that does not go through one of them (a script on the database) shows within
 * MAX_AGE. The cache key holds the function's code and its arguments, so a deploy that changes a query reads
 * fresh data.
 *
 * Only JSON-safe values: return raw rows (Neon's HTTP driver sends times as text; read them with db-time.mjs),
 * not Maps or Dates. One entry holds at most 2 MB; Vercel does not store a larger one (the read still works, from
 * the database).
 */

export const TAGS = ['lift', 'labs', 'vitals', 'status'] as const;
export type CacheTag = (typeof TAGS)[number];

const MAX_AGE = 3600; // seconds

// Next sets NEXT_RUNTIME in its server. Elsewhere (node --test, the CI integration test, scripts) there is no
// cache to use, so the function runs as it is.
const inNext = () => !!process.env.NEXT_RUNTIME;

export function cached<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  key: string,
  tag: CacheTag,
  maxAge = MAX_AGE,
): (...args: A) => Promise<R> {
  const read = unstable_cache(fn, [key], { tags: [tag], revalidate: maxAge });
  // Calls with the same arguments that run at the same time share one read: after a clear, the parallel checks
  // of /api/health would otherwise all miss the cache and each read the database.
  const pending = new Map<string, Promise<R>>();
  return (...args: A) => {
    if (!inNext()) return fn(...args);
    const id = JSON.stringify(args);
    let p = pending.get(id);
    if (!p) {
      p = read(...args).finally(() => pending.delete(id));
      pending.set(id, p);
    }
    return p;
  };
}

/** Clears a tag after a write. It never throws: the write already succeeded, and the cache expires anyway. */
export function clearCache(tag: CacheTag) {
  if (!inNext()) return;
  try {
    // expire: 0 drops the entry now, so the next read is fresh (as revalidateTag did before Next.js 16).
    revalidateTag(tag, { expire: 0 });
  } catch (error) {
    console.error(`[cache] revalidateTag(${tag}) failed:`, error);
  }
}
