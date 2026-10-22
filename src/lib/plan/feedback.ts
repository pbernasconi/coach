import { sql } from '@/db';
import { toDay, toIso } from '@/lib/db-time.mjs';

/** How a workout felt (workout_feedback; src/lib/plan/feedback.mjs has the scales). */
export type Feedback = { item: string; date: string; feel: number | null; rpe: number | null; comment: string | null; updatedAt: string | null; fromWatch: boolean };

type Row = Record<string, unknown>;
const num = (v: unknown) => (v == null ? null : Number(v));

function toFeedback(r: Row): Feedback {
  return {
    item: String(r.item),
    date: toDay(r.date) ?? '',
    feel: num(r.feel),
    rpe: num(r.rpe),
    comment: (r.comment as string) ?? null,
    updatedAt: toIso(r.updated_at) ?? null,
    fromWatch: r.source === 'watch',
  };
}

/** The feedback for one item, else the feedback logged on another item of the same planned workout. */
export async function loadFeedback(userId: string, items: string[], planActivityId: string | null): Promise<Feedback | null> {
  const rows = (await sql`
    SELECT item, date, feel, rpe, comment, source, updated_at FROM workout_feedback
    WHERE user_id = ${userId} AND (item = ANY(${items}) OR (${planActivityId}::text IS NOT NULL AND plan_activity_id = ${planActivityId}))
    ORDER BY updated_at DESC LIMIT 1`) as Row[];
  return rows[0] ? toFeedback(rows[0]) : null;
}

export async function saveFeedback(
  userId: string,
  f: { item: string; date: string; feel: number | null; rpe: number | null; comment: string | null; title: string | null; planActivityId: string | null }
): Promise<Feedback> {
  const empty = f.feel == null && f.rpe == null && !f.comment;
  if (empty) {
    await sql`DELETE FROM workout_feedback WHERE user_id = ${userId} AND item = ${f.item}`;
    return { item: f.item, date: f.date, feel: null, rpe: null, comment: null, updatedAt: null, fromWatch: false };
  }
  const rows = (await sql`
    INSERT INTO workout_feedback (user_id, item, date, title, plan_activity_id, feel, rpe, comment)
    VALUES (${userId}, ${f.item}, ${f.date}, ${f.title}, ${f.planActivityId}, ${f.feel}, ${f.rpe}, ${f.comment})
    ON CONFLICT (user_id, item) DO UPDATE SET
      date = EXCLUDED.date, title = COALESCE(EXCLUDED.title, workout_feedback.title),
      plan_activity_id = COALESCE(EXCLUDED.plan_activity_id, workout_feedback.plan_activity_id),
      feel = EXCLUDED.feel, rpe = EXCLUDED.rpe, comment = EXCLUDED.comment, source = NULL, updated_at = NOW()
    RETURNING item, date, feel, rpe, comment, source, updated_at`) as Row[];
  return toFeedback(rows[0]);
}
