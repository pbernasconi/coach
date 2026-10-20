/**
 * Calendar sync, called every 30 minutes by .github/workflows/sync.yml (Vercel Hobby crons run only once
 * a day). Authenticated by `Authorization: Bearer $CRON_SECRET`. Public to Clerk (/api/cron).
 */

import { sql } from '@/db';
import { isAuthorized } from '@/lib/lift-sync/auth.mjs';
import { syncCalendars } from '@/lib/calendar-sync/sync.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    return Response.json(await syncCalendars(sql, { daysBack: 7, daysForward: 30 }));
  } catch (error) {
    console.error('Calendar cron sync failed:', error);
    return Response.json({ error: String((error as Error).message ?? error) }, { status: 500 });
  }
}
