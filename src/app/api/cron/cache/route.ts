/**
 * POST /api/cron/cache?tag=labs clears one tag of the server data cache (src/lib/data-cache.ts). For writers that
 * go straight to the database, such as the Function sync (.github/workflows/function.yml). Authenticated by
 * `Authorization: Bearer $CRON_SECRET`. Public to Clerk (/api/cron).
 */

import { clearCache, TAGS, type CacheTag } from '@/lib/data-cache';
import { isAuthorized } from '@/lib/lift-sync/auth.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const tag = new URL(request.url).searchParams.get('tag');
  if (!TAGS.includes(tag as CacheTag)) return Response.json({ error: `tag must be one of ${TAGS.join(', ')}` }, { status: 400 });
  clearCache(tag as CacheTag);
  return Response.json({ cleared: tag });
}
