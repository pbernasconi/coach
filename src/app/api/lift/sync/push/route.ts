/**
 * Lift sync push (lift/SYNC.md). Public to Clerk; authenticated by the LIFT_SYNC_TOKEN bearer token.
 *
 * After the changes are stored, a planned session the phone moved to another day takes its plan workout along
 * (src/lib/lift/plan-follow.ts), and Google Calendar follows after the response.
 */

import { after } from 'next/server';
import { sql } from '@/db';
import { pushWeek } from '@/lib/calendar-sync/push.mjs';
import { handlePush } from '@/lib/lift-sync/sync.mjs';
import type { ValidChange } from '@/lib/lift-sync/contract.mjs';
import { drizzleLiftRepository } from '@/lib/lift-sync/drizzle-repository';
import { followSessionsInPlan } from '@/lib/lift/plan-follow';
import { mondayOf } from '@/lib/plan/week.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Moves the plan workouts of sessions the phone moved. Never fails the push: the Lift rows are already stored. */
async function followInPlan(applied: ValidChange[]) {
  try {
    const moves = await followSessionsInPlan(applied);
    if (moves.length === 0) return;
    after(async () => {
      for (const userId of new Set(moves.map((m) => m.userId))) {
        const weeks = new Set(moves.filter((m) => m.userId === userId).flatMap((m) => [mondayOf(m.from), mondayOf(m.to)]));
        for (const week of weeks) {
          try {
            await pushWeek(sql, userId, week);
          } catch (error) {
            console.error('Calendar push failed:', error);
          }
        }
      }
    });
  } catch (error) {
    console.error('Lift → plan follow failed:', error);
  }
}

export async function POST(request: Request) {
  try {
    const applied: ValidChange[] = [];
    const result = await handlePush(
      {
        authorization: request.headers.get('authorization'),
        rawBody: await request.text(),
        token: process.env.LIFT_SYNC_TOKEN,
      },
      drizzleLiftRepository,
      { applied }
    );
    if (result.status === 200 && applied.length) await followInPlan(applied);
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    console.error('Lift sync push failed:', error);
    return Response.json({ error: 'internal error' }, { status: 500 });
  }
}
