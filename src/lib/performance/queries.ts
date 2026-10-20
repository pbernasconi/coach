import { sql } from '@/db';
import { loadLiftModel } from '@/lib/lift-dashboard/queries';
import { sessionSummaries } from '@/lib/lift-dashboard/stats.mjs';
import { addDays, mondayOf, sportOfStrava } from '@/lib/plan/week.mjs';
import { stravaTypeLabel, type SportId } from '@/lib/sports';

/** One sport's week: moving hours, km, and hours for each exact Strava type in it ("Hike", "Virtual ride"). */
export type SportWeek = { hours: number; km: number; types: Record<string, number> };

export type WeekStats = {
  week: string; // Monday
  hours: number;
  runKm: number;
  runMin: number;
  rideKm: number;
  rideHours: number;
  strength: number; // Strava weight sessions and Lift sessions, one per day
  tss: number;
  planned: number;
  done: number;
  sports: Partial<Record<SportId, SportWeek>>;
};

export type LoadPoint = { date: string; ctl: number; atl: number; tsb: number; tss: number };

export type Performance = {
  weeks: WeekStats[]; // oldest first
  load: LoadPoint[];
  latestActivity: string | null;
  lastSync: string | null;
};

type Row = Record<string, unknown>;
const day = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

export async function loadPerformance(userId: string, today: string, weekCount = 12): Promise<Performance> {
  const firstWeek = addDays(mondayOf(today), -7 * (weekCount - 1));
  const [acts, load, plans, conn, lift] = await Promise.all([
    sql`
      SELECT start_date_local, sport_type, distance, moving_time, tss
      FROM strava_activities
      WHERE user_id = ${userId} AND start_date_local >= ${firstWeek} AND COALESCE(commute, false) = false` as Promise<Row[]>,
    sql`
      SELECT date, ctl, atl, tsb, tss FROM daily_training_load
      WHERE user_id = ${userId} AND date >= ${firstWeek} ORDER BY date` as Promise<Row[]>,
    sql`
      SELECT a.scheduled_date, a.activity_type, a.status
      FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
      WHERE p.user_id = ${userId} AND a.scheduled_date >= ${firstWeek} AND a.scheduled_date < ${addDays(today, 1)}` as Promise<Row[]>,
    sql`SELECT last_synced_at FROM strava_connections LIMIT 1` as Promise<Row[]>,
    loadLiftModel(),
  ]);

  const weeks = new Map<string, WeekStats>();
  for (let i = 0; i < weekCount; i++) {
    const w = addDays(firstWeek, 7 * i);
    weeks.set(w, { week: w, hours: 0, runKm: 0, runMin: 0, rideKm: 0, rideHours: 0, strength: 0, tss: 0, planned: 0, done: 0, sports: {} });
  }
  const strengthDays = new Set<string>();
  const activityDays = new Map<string, Set<string>>();
  let latest = '';

  for (const a of acts) {
    const d = day(a.start_date_local);
    const w = weeks.get(mondayOf(d));
    if (!w) continue;
    if (d > latest) latest = d;
    const min = Number(a.moving_time ?? 0) / 60;
    const km = Number(a.distance ?? 0) / 1000;
    const sport = sportOfStrava(a.sport_type);
    w.hours += min / 60;
    w.tss += Number(a.tss ?? 0);
    const sw = (w.sports[sport as SportId] ??= { hours: 0, km: 0, types: {} });
    const type = stravaTypeLabel(String(a.sport_type ?? 'Workout'));
    sw.hours += min / 60;
    sw.km += km;
    sw.types[type] = (sw.types[type] ?? 0) + min / 60;
    if (sport === 'run') {
      w.runKm += km;
      w.runMin += min;
    }
    if (sport === 'ride') {
      w.rideKm += km;
      w.rideHours += min / 60;
    }
    if (sport === 'strength') strengthDays.add(d);
    if (!activityDays.has(d)) activityDays.set(d, new Set());
    activityDays.get(d)!.add(sport);
  }
  for (const s of sessionSummaries(lift.model, lift.unit) as { day: string }[]) {
    if (s.day >= firstWeek) strengthDays.add(s.day);
  }
  for (const d of strengthDays) {
    const w = weeks.get(mondayOf(d));
    if (w) w.strength += 1;
  }

  // Plan compliance: a past planned workout counts as done when an activity of the same sport is on that day.
  for (const p of plans) {
    if (p.activity_type === 'rest' || p.status === 'skipped') continue;
    const d = day(p.scheduled_date);
    const w = weeks.get(mondayOf(d));
    if (!w) continue;
    w.planned += 1;
    const sport = String(p.activity_type);
    if (sport === 'strength' ? strengthDays.has(d) : activityDays.get(d)?.has(sport)) w.done += 1;
  }

  return {
    weeks: [...weeks.values()],
    load: load.map((r) => ({ date: day(r.date), ctl: Number(r.ctl), atl: Number(r.atl), tsb: Number(r.tsb), tss: Number(r.tss ?? 0) })),
    latestActivity: latest || null,
    lastSync: conn[0]?.last_synced_at ? String(conn[0].last_synced_at) : null,
  };
}
