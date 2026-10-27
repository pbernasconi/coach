import { sql } from '@/db';
import { toDay } from '@/lib/db-time.mjs';
import { SPORTS, sport } from '@/lib/sports';
import { loadRange } from './month';
import { addDays } from './week.mjs';
import { weekResponse } from './week-api.mjs';

const sports = { known: new Set<string>(SPORTS.map((s) => s.id)), label: (id: string) => sport(id).label };

/**
 * GET /api/lift/week (lift/WEEK-API.md): `weeks` plan weeks from the Monday `start`. The workouts, their state and
 * compliance come from loadRange, the same data as the web calendar; the plan rows give each week's title.
 */
export async function loadLiftWeeks(userId: string, start: string, weeks: number, today: string, timeZone: string, now = new Date()) {
  const mondays = Array.from({ length: weeks }, (_, i) => addDays(start, i * 7));
  const last = addDays(mondays.at(-1)!, 6);
  const [range, planRows, liftRows] = await Promise.all([
    loadRange(userId, start, mondays.at(-1)!, today),
    sql`
      SELECT week_start_date, context_data FROM training_plans
      WHERE user_id = ${userId} AND week_start_date >= ${start} AND week_start_date <= ${mondays.at(-1)!}` as Promise<Record<string, unknown>[]>,
    // Every live Lift session on the server in these weeks, planned or logged: the phone shows a local session that
    // no item links only when the server has it too (lift/WEEK-API.md, `liftSessions`).
    sql`
      SELECT lower(id::text) AS id, payload->>'day' AS day FROM lift_rows
      WHERE entity = 'session' AND deleted_at IS NULL AND (payload->>'deletedAt') IS NULL
        AND payload->>'day' >= ${start} AND payload->>'day' <= ${last}` as unknown as Promise<{ id: string; day: string }[]>,
  ]);
  const plans = new Map(
    planRows.map((p) => [toDay(p.week_start_date) ?? '', { title: (p.context_data as { title?: string } | null)?.title ?? null }])
  );
  const liftSessions = liftRows.map((r) => ({ id: String(r.id), date: String(r.day).slice(0, 10) }));
  return weekResponse({ timeZone, today, mondays, now, range, plans, sports, liftSessions });
}
