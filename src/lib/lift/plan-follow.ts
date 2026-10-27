import { sql } from '@/db';
import { toDate, toDay } from '@/lib/db-time.mjs';
import { ensurePlan } from '@/lib/plan/queries';
import { mondayOf } from '@/lib/plan/week.mjs';
import { planFollowMoves, pushedSessions } from './follow-plan.mjs';

type Row = Record<string, unknown>;
export type PlanMove = { id: string; userId: string; from: string; to: string };

/**
 * After a Lift sync push from the iPhone: a planned session it moved to another day (`dayMovedAt` newer than the
 * workout's last server change) takes its plan workout along (follow-plan.mjs, planFollowMoves). The workout is marked edited, so a plan re-import keeps the new day. It writes
 * only the plan, never Lift, so nothing goes back to the phone. Returns the moves, for the calendar push.
 * @param changes the push's applied changes (sync.mjs push, `applied`)
 */
export async function followSessionsInPlan(changes: { entity: string; id: string; payload: Record<string, unknown>; deletedAt: Date | null }[]): Promise<PlanMove[]> {
  const sessions = pushedSessions(changes);
  if (sessions.size === 0) return [];
  const rows = (await sql`
    SELECT a.id, a.lift_session_id, a.scheduled_date, a.status, a.edited_at, a.updated_at, p.user_id
    FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
    WHERE lower(a.lift_session_id) = ANY(${[...sessions.keys()]})`) as Row[];
  const userOf = new Map(rows.map((r) => [String(r.id), String(r.user_id)]));
  const moves = planFollowMoves(
    sessions,
    rows.map((r) => {
      // The workout's last change on the server: a web edit (edited_at), or a script (updated_at).
      const times = [toDate(r.edited_at), toDate(r.updated_at)].filter((t): t is Date => t !== null);
      const changedAt = times.length ? new Date(Math.max(...times.map((t) => t.getTime()))) : null;
      return { id: String(r.id), liftSessionId: String(r.lift_session_id), date: toDay(r.scheduled_date) ?? '', status: String(r.status ?? ''), changedAt };
    })
  );
  const done: PlanMove[] = [];
  for (const m of moves) {
    const userId = userOf.get(m.id)!;
    const planId = await ensurePlan(userId, mondayOf(m.to));
    await sql`
      UPDATE training_plan_activities SET scheduled_date = ${m.to}, plan_id = ${planId}, change_source = 'lift', edited_at = NOW(), updated_at = NOW()
      WHERE id = ${m.id} AND lower(lift_session_id) = ${m.sessionId}`;
    done.push({ id: m.id, userId, from: m.from, to: m.to });
  }
  return done;
}
