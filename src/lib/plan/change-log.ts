import { sql } from '@/db';
import { toDate } from '@/lib/db-time.mjs';
import { changeLine } from './change-log.mjs';

export type PlanChange = {
  id: number;
  workoutId: string;
  title: string | null;
  op: 'insert' | 'update' | 'delete';
  source: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  at: Date;
};

/**
 * The plan's change log (plan_changes), newest first: every change since `since`, or one workout's changes.
 * Only the user's plans (a change keeps the plan it was in).
 */
export async function loadPlanChanges(
  userId: string,
  { since, workoutId, limit = 50 }: { since?: Date; workoutId?: string; limit?: number } = {}
): Promise<PlanChange[]> {
  const rows = (await sql`
    SELECT c.id, c.workout_id, c.title, c.op, c.source, c.before, c.after, c.at
    FROM plan_changes c JOIN training_plans p ON p.id = c.plan_id
    WHERE p.user_id = ${userId}
      AND (${workoutId ?? null}::text IS NULL OR c.workout_id = ${workoutId ?? null})
      AND (${since ?? null}::timestamptz IS NULL OR c.at >= ${since ?? null})
    ORDER BY c.at DESC, c.id DESC
    LIMIT ${limit}`) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: Number(r.id),
    workoutId: String(r.workout_id),
    title: (r.title as string) ?? null,
    op: r.op as PlanChange['op'],
    source: String(r.source),
    before: (r.before as Record<string, unknown>) ?? null,
    after: (r.after as Record<string, unknown>) ?? null,
    at: toDate(r.at) ?? new Date(0),
  }));
}

/** The last week's plan changes as lines, oldest first, for Coach chat: what was moved, by whom, when. */
export async function recentChangesText(userId: string, timeZone: string, days = 7): Promise<string> {
  const changes = await loadPlanChanges(userId, { since: new Date(Date.now() - days * 86_400_000), limit: 40 });
  if (changes.length === 0) return 'No plan changes in the last week.';
  return changes.reverse().map((c) => changeLine(c, timeZone)).join('\n');
}
