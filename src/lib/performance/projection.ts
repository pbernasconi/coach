import { sql } from '@/db';
import { toDay } from '@/lib/db-time.mjs';
import { addDays } from '@/lib/plan/week.mjs';
import { estimatePlannedTss, projectLoad, projectionEnd, rampRates, RAMP_WINDOWS } from './pmc.mjs';
import { loadUpcomingEvents, type CoachEvent } from './events';

/** One PMC day. `projected` days come from the plan (estimated TSS where the plan has none). */
export type PmcDay = { date: string; ctl: number; atl: number; tsb: number; tss: number; projected: boolean };

export type RampRate = { days: number; from: number; to: number; change: number; perWeek: number } | null;

/** An event marker for the chart. */
export type PmcEvent = Pick<CoachEvent, 'id' | 'name' | 'date' | 'priority'>;

export type Pmc = {
  today: string;
  days: PmcDay[]; // `pastDays` before today, then the projection
  ramp: RampRate[]; // 7, 28, 90, 365 days, as of today (actual days only)
  fitness: { date: string; ctl: number }[]; // the last 366 actual days, for the ramp-rate mini charts
  events: PmcEvent[]; // events inside the chart's range
  plannedTss: number; // planned TSS in the projection
  estimatedWorkouts: number; // planned workouts with no TSS in the plan
};

type Row = Record<string, unknown>;
const dayOf = (v: unknown) => toDay(v) ?? '';

/**
 * Fitness, fatigue and form for the last `pastDays` days and projected to the end of the plan or the next
 * event (at most `maxAhead` days), with ramp rates over 7 / 28 / 90 / 365 days.
 */
export async function loadPmc(userId: string, today: string, { pastDays = 120, maxAhead = 120 } = {}): Promise<Pmc> {
  const since = addDays(today, -Math.max(pastDays, 365 + 3));
  const [load, plan, events] = await Promise.all([
    sql`
      SELECT date, ctl, atl, tsb, tss FROM daily_training_load
      WHERE user_id = ${userId} AND date >= ${since} ORDER BY date` as Promise<Row[]>,
    sql`
      SELECT a.scheduled_date, a.activity_type, a.workout_type, a.title, a.intensity, a.duration, a.tss, a.status
      FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
      WHERE p.user_id = ${userId} AND a.scheduled_date >= ${today}
        AND a.scheduled_date < ${addDays(today, maxAhead + 1)}` as Promise<Row[]>,
    loadUpcomingEvents(userId, today, maxAhead),
  ]);

  const history = load.map((r) => ({ date: dayOf(r.date), ctl: Number(r.ctl), atl: Number(r.atl), tsb: Number(r.tsb), tss: Number(r.tss ?? 0) }));
  let estimatedWorkouts = 0;
  const planned = plan
    .map((r) => {
      const est = estimatePlannedTss({
        tss: r.tss == null ? null : Number(r.tss),
        duration: r.duration == null ? null : Number(r.duration),
        status: String(r.status ?? 'planned'),
        sport: String(r.activity_type ?? ''),
        workoutType: (r.workout_type as string) ?? null,
        intensity: (r.intensity as string) ?? null,
        title: String(r.title ?? ''),
      });
      if (est.method === 'estimated') estimatedWorkouts++;
      return { date: dayOf(r.scheduled_date), tss: est.tss };
    })
    .filter((p) => p.date >= today);

  const until = projectionEnd(today, planned.filter((p) => p.tss > 0).map((p) => p.date), events.map((e) => e.date), { maxDays: maxAhead });
  const series = projectLoad(history, planned, { today, until }) as PmcDay[];
  const first = addDays(today, -pastDays);
  const days = series.filter((d) => d.date >= first);
  const actual = series.filter((d) => !d.projected);
  return {
    today,
    days,
    ramp: rampRates(actual, undefined, RAMP_WINDOWS),
    fitness: actual.slice(-366).map((d) => ({ date: d.date, ctl: d.ctl })),
    events: events.filter((e) => e.date <= until).map(({ id, name, date, priority }) => ({ id, name, date, priority })),
    plannedTss: Math.round(days.filter((d) => d.projected).reduce((n, d) => n + d.tss, 0)),
    estimatedWorkouts,
  };
}
