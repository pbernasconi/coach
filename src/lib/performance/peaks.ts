import { sql } from '@/db';
import { addDays } from '@/lib/plan/week.mjs';
import { bestByWindow, PEAK_WINDOWS, POWER_DURATIONS, RUN_DISTANCES, recentPeaks } from './peaks.mjs';

export type PeakCell = { value: number; date: string; activityId: string; name?: string } | null;
export type PeakWindowKey = 'all' | 'd90' | 'd28';
export type PeakRow = { span: number; label: string; cells: Record<PeakWindowKey, PeakCell> };

export type PeakPerformances = {
  power: PeakRow[]; // span = seconds, value = watts
  run: PeakRow[]; // span = meters (21097 = half), value = seconds
  windows: { key: PeakWindowKey; label: string }[];
  scanned: number; // activities with a peak scan
  pending: number; // runs and power rides still to scan
};

type Row = Record<string, unknown>;

const powerLabel = (s: number) => (s < 60 ? `${s} s` : `${s / 60} min`);

/** Best power (5 s to 60 min) and best run times (1 km to half), all time and in the last 90 and 28 days. */
export async function loadPeakPerformances(userId: string, today: string): Promise<PeakPerformances> {
  const [rows, counts] = await Promise.all([
    sql`
      SELECT p.metric, p.span, p.value, p.strava_activity_id, to_char(a.start_date_local, 'YYYY-MM-DD') AS day, a.name
      FROM activity_peaks p
      JOIN strava_activities a ON a.user_id = p.user_id AND a.strava_activity_id = p.strava_activity_id
      WHERE p.user_id = ${userId}` as Promise<Row[]>,
    sql`
      SELECT (SELECT COUNT(*)::int FROM activity_peak_scans WHERE user_id = ${userId}) AS scanned,
             (SELECT COUNT(*)::int FROM strava_activities a
               LEFT JOIN activity_peak_scans s ON s.user_id = a.user_id AND s.strava_activity_id = a.strava_activity_id
               WHERE a.user_id = ${userId} AND s.strava_activity_id IS NULL
                 AND ((a.sport_type ~ 'Ride$' AND a.sport_type NOT IN ('EBikeRide', 'EMountainBikeRide') AND a.device_watts = true)
                   OR (a.sport_type ~ 'Run$' AND COALESCE(a.distance, 0) >= 1000))) AS pending` as Promise<Row[]>,
  ]);
  const best = bestByWindow(
    rows.map((r) => ({
      metric: String(r.metric), span: Number(r.span), value: Number(r.value),
      date: String(r.day), activityId: String(r.strava_activity_id), name: (r.name as string) ?? undefined,
    })),
    today,
  ) as Record<'power' | 'run', Record<number, Record<PeakWindowKey, PeakCell>>>;
  return {
    power: POWER_DURATIONS.map((s: number) => ({ span: s, label: powerLabel(s), cells: best.power[s] })),
    run: RUN_DISTANCES.map((d: { span: number; label: string }) => ({ span: d.span, label: d.label, cells: best.run[d.span] })),
    windows: PEAK_WINDOWS.map((w: { key: string; label: string }) => ({ key: w.key as PeakWindowKey, label: w.label })),
    scanned: Number(counts[0]?.scanned ?? 0),
    pending: Number(counts[0]?.pending ?? 0),
  };
}

export type RecentPeak = {
  metric: 'power' | 'run';
  span: number;
  value: number;
  date: string;
  activityId: string;
  name: string | null;
  rank: number; // 1 to 3
  window: 'all' | 'year' | 'd90';
  windowLabel: string; // "All time", "2026", "Last 90 days"
};

/**
 * The home page's recent peaks: peaks from the last `days` days that rank in the top 3 all time, this year or in
 * the last 90 days. Postgres counts the better values, so only the recent rows (a few dozen) leave the database.
 */
export async function loadRecentPeaks(userId: string, today: string, { days = 28, limit = 6 } = {}): Promise<RecentPeak[]> {
  const since = addDays(today, -(days - 1));
  const d90 = addDays(today, -89);
  const year = `${today.slice(0, 4)}-01-01`;
  const rows = (await sql`
    WITH p AS (
      SELECT p.metric, p.span, p.value, p.strava_activity_id, a.name, a.start_date_local::date AS day
      FROM activity_peaks p
      JOIN strava_activities a ON a.user_id = p.user_id AND a.strava_activity_id = p.strava_activity_id
      WHERE p.user_id = ${userId} AND a.start_date_local::date <= ${today}::date
    )
    SELECT r.metric, r.span, r.value, r.strava_activity_id, r.name, to_char(r.day, 'YYYY-MM-DD') AS day,
           c.all_better::int AS all_better, c.year_better::int AS year_better, c.d90_better::int AS d90_better
    FROM p r
    CROSS JOIN LATERAL (
      SELECT COUNT(*) AS all_better,
             COUNT(*) FILTER (WHERE o.day >= ${year}::date) AS year_better,
             COUNT(*) FILTER (WHERE o.day >= ${d90}::date) AS d90_better
      FROM p o
      WHERE o.metric = r.metric AND o.span = r.span
        AND CASE WHEN r.metric = 'power' THEN o.value > r.value ELSE o.value < r.value END
    ) c
    WHERE r.day >= ${since}::date
    ORDER BY r.day DESC`) as Row[];
  return recentPeaks(
    rows.map((r) => ({
      metric: String(r.metric) as 'power' | 'run',
      span: Number(r.span),
      value: Number(r.value),
      date: String(r.day),
      activityId: String(r.strava_activity_id),
      name: (r.name as string) ?? null,
      rankAll: Number(r.all_better) + 1,
      rankYear: Number(r.year_better) + 1,
      rank90: Number(r.d90_better) + 1,
    })),
    today,
    { limit },
  ) as RecentPeak[];
}
