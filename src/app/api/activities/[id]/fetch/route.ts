/**
 * POST /api/activities/[id]/fetch (Clerk session, owner only). The activity page calls it once when a part of the
 * activity is not stored yet: Strava's detailed activity, the streams, or the weather. It stores them
 * (src/lib/activity/fetch.mjs) and answers what it fetched; the page then reloads its data from the database.
 * `id` is the Strava activity id. A token refresh happens only in production (refreshAllowed).
 */
import { sql } from '@/db';
import { fetchActivityParts } from '@/lib/activity/fetch.mjs';
import { ownerForSignedInUser } from '@/lib/owner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await ownerForSignedInUser();
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const [row] = (await sql`
    SELECT id FROM strava_activities WHERE user_id = ${userId} AND (strava_activity_id = ${id} OR id = ${id}) LIMIT 1`) as { id: string }[];
  if (!row) return Response.json({ error: 'not found' }, { status: 404 });
  const result = await fetchActivityParts(sql, row.id);
  return Response.json(result, { headers: { 'cache-control': 'no-store' } });
}
