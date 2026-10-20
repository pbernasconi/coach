/**
 * The workout sync for the Garmin job (scripts/garmin/workouts.py; COACH-API.md). CRON_SECRET bearer only.
 * GET: what to create, update or delete on Garmin Connect for the next two weeks of runs (Garmin workout JSON).
 * POST: what the job did, stored in workout_syncs.
 */

import { sql } from '@/db';
import { HOME_TZ } from '@/lib/calendar-sync/push.mjs';
import { addDays, todayIn } from '@/lib/plan/week.mjs';
import { GARMIN_DAYS, handleGarminWorkoutsGet, handleGarminWorkoutsPost } from '@/lib/workouts/garmin-api.mjs';
import { loadSyncRows, recordSync } from '@/lib/workouts/sync.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'no-store' };
const tokens = () => ({ cron: process.env.CRON_SECRET });

async function owner(): Promise<string | null> {
  const [u] = (await sql`SELECT id FROM users ORDER BY created_at LIMIT 1`) as { id: string }[];
  return u?.id ?? null;
}

const repo = {
  async load() {
    const userId = await owner();
    const from = todayIn(HOME_TZ);
    const to = addDays(from, GARMIN_DAYS - 1);
    if (!userId) return { rows: [], synced: [], from, to };
    return { ...(await loadSyncRows(sql, userId, 'garmin', from, to)), from, to };
  },
  record: (r: Parameters<typeof recordSync>[2]) => recordSync(sql, 'garmin', r),
};

export async function GET(request: Request) {
  try {
    const result = await handleGarminWorkoutsGet({ authorization: request.headers.get('authorization'), tokens: tokens() }, repo);
    return Response.json(result.body, { status: result.status, headers });
  } catch (error) {
    console.error('Garmin workouts read failed:', error instanceof Error ? error.message : 'unknown error');
    return Response.json({ error: 'internal error' }, { status: 500, headers });
  }
}

export async function POST(request: Request) {
  try {
    const result = await handleGarminWorkoutsPost(
      { authorization: request.headers.get('authorization'), rawBody: await request.text(), tokens: tokens() },
      repo
    );
    return Response.json(result.body, { status: result.status, headers });
  } catch (error) {
    console.error('Garmin workouts write failed:', error instanceof Error ? error.message : 'unknown error');
    return Response.json({ error: 'internal error' }, { status: 500, headers });
  }
}
