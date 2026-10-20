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
  const [range, planRows] = await Promise.all([
    loadRange(userId, start, mondays.at(-1)!, today),
    sql`
      SELECT week_start_date, context_data FROM training_plans
      WHERE user_id = ${userId} AND week_start_date >= ${start} AND week_start_date <= ${mondays.at(-1)!}` as Promise<Record<string, unknown>[]>,
  ]);
  const plans = new Map(
    planRows.map((p) => [toDay(p.week_start_date) ?? '', { title: (p.context_data as { title?: string } | null)?.title ?? null }])
  );
  return weekResponse({ timeZone, today, mondays, now, range, plans, sports });
}
