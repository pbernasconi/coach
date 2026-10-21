/**
 * Calendar sync, called every hour (at :17) by .github/workflows/sync.yml (Vercel Hobby crons run only once
 * a day). Authenticated by `Authorization: Bearer $CRON_SECRET`. Public to Clerk (/api/cron).
 *
 * After the pull, it pushes this week and next to Google Calendar. That push copies workouts moved on the calendar
 * into Coach (src/lib/calendar-sync/push.mjs) and leaves events that are already right alone.
 */

import { sql } from '@/db';
import { isAuthorized } from '@/lib/lift-sync/auth.mjs';
import { syncCalendars } from '@/lib/calendar-sync/sync.mjs';
import { pushWeek } from '@/lib/calendar-sync/push.mjs';
import { followWorkoutInLift } from '@/lib/lift/edit-store';
import { ownerId } from '@/lib/plan/queries';
import { addDays, mondayOf, todayIn } from '@/lib/plan/week.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Pushes this week and next; a workout moved on the calendar to another day also moves its Lift session. */
async function pushWeeks() {
  const userId = await ownerId();
  if (!userId) return { skipped: 'no user' };
  const monday = mondayOf(todayIn('America/Los_Angeles'));
  const out = [];
  for (const week of [monday, addDays(monday, 7)]) {
    const r = await pushWeek(sql, userId, week);
    for (const m of 'moved' in r ? r.moved : []) {
      if (m.from === m.to) continue;
      try {
        await followWorkoutInLift(m.id);
      } catch (error) {
        console.error('Lift follow after a calendar move failed:', error);
      }
    }
    out.push({ week, ...r });
  }
  return out;
}

export async function GET(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const synced = await syncCalendars(sql, { daysBack: 7, daysForward: 30 });
    let pushed;
    try {
      pushed = await pushWeeks();
    } catch (error) {
      console.error('Calendar push after sync failed:', error);
      pushed = { error: String((error as Error).message ?? error) };
    }
    return Response.json({ ...synced, pushed });
  } catch (error) {
    console.error('Calendar cron sync failed:', error);
    return Response.json({ error: String((error as Error).message ?? error) }, { status: 500 });
  }
}
