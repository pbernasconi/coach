import { sql } from '@/db';
import { toDay } from '@/lib/db-time.mjs';
import { cached } from '@/lib/data-cache';
import { parseDay } from './garmin-day.mjs';
import {
  latestWithChange, parseEnduranceScore, parseHillScore, parsePersonalRecords, parseTrainingStatus,
  series, trainingStatusOf, type SampleRow,
} from './garmin-training.mjs';
import { addDays } from './readiness.mjs';
import { BOARD_METRICS, NORMAL_DAYS, boardOf } from './board.mjs';

/**
 * Loaders for the Garmin views: /health/day/[date], /health/training, the /health board, and the
 * "Recovery today" card on the home page. Owner-scoped. Raw payloads come from garmin_raw; daily values from
 * health_samples. All parsing is in garmin-day.mjs and garmin-training.mjs.
 */

type Row = Record<string, unknown>;

// health_samples and garmin_raw change only through the vitals and Garmin pushes, which clear the 'vitals' tag
// (src/lib/data-cache.ts), so the reads here are cached.
const sampleRows = cached(
  async (userId: string, from: string, to: string, metrics: string[] | null) =>
    (await sql`
      SELECT date, metric, value FROM health_samples
      WHERE user_id = ${userId} AND date >= ${from}::date AND date <= ${to}::date
        AND (${metrics}::text[] IS NULL OR metric = ANY(${metrics}::text[]))
      ORDER BY date`) as Row[],
  'garmin-samples',
  'vitals'
);

async function samples(userId: string, from: string, to: string, metrics: string[] | null): Promise<SampleRow[]> {
  const rows = await sampleRows(userId, from, to, metrics);
  return rows.flatMap((r) => {
    const date = toDay(r.date);
    return date ? [{ date, metric: String(r.metric), value: Number(r.value) }] : [];
  });
}

/** The payloads of one day, by kind. */
const rawDayRows = cached(
  async (userId: string, date: string) => (await sql`SELECT kind, payload FROM garmin_raw WHERE user_id = ${userId} AND date = ${date}::date`) as Row[],
  'garmin-raw-day',
  'vitals'
);

async function rawDay(userId: string, date: string): Promise<Record<string, unknown>> {
  const rows = await rawDayRows(userId, date);
  return Object.fromEntries(rows.map((r) => [String(r.kind), r.payload]));
}

/** The newest payload of each kind, on or before `today`. */
const rawLatestRows = cached(
  async (userId: string, kinds: string[], today: string) =>
    (await sql`
      SELECT DISTINCT ON (kind) kind, date, payload FROM garmin_raw
      WHERE user_id = ${userId} AND kind = ANY(${kinds}::text[]) AND date <= ${today}::date
      ORDER BY kind, date DESC`) as Row[],
  'garmin-raw-latest',
  'vitals'
);

async function rawLatest(userId: string, kinds: string[], today: string): Promise<Record<string, { date: string | null; payload: unknown }>> {
  const rows = await rawLatestRows(userId, kinds, today);
  return Object.fromEntries(rows.map((r) => [String(r.kind), { date: toDay(r.date), payload: r.payload }]));
}

// ---- /health/day/[date] ----

export type DayView = ReturnType<typeof parseDay> & {
  values: Record<string, number>; // health_samples of the day, by metric
  hasData: boolean;
};

export async function loadDay(userId: string, date: string): Promise<DayView> {
  const [raw, rows] = await Promise.all([rawDay(userId, date), samples(userId, date, date, null)]);
  const parsed = parseDay(raw, date);
  const values = Object.fromEntries(rows.map((r) => [r.metric, r.value]));
  const hasData =
    rows.length > 0 || !!parsed.sleep || !!parsed.hrv || !!parsed.readiness || parsed.stress.length > 0 || (parsed.heartRate?.values.length ?? 0) > 0;
  return { ...parsed, values, hasData };
}

// ---- /health/training ----

const TRAINING_METRICS = [
  'training_load_acute', 'training_load_chronic', 'training_load_ratio', 'load_focus_anaerobic', 'load_focus_high_aerobic',
  'load_focus_low_aerobic', 'training_status', 'endurance_score', 'hill_score', 'race_pred_5k_s', 'race_pred_10k_s',
  'race_pred_half_s', 'race_pred_marathon_s', 'lactate_threshold_hr_bpm', 'lactate_threshold_pace_s_per_km', 'cycling_ftp_w',
  'vo2max', 'vo2max_cycling', 'fitness_age',
];

export type Pt = { date: string; value: number };

export async function loadTraining(userId: string, today: string) {
  const from = addDays(today, -364);
  const [rows, raw] = await Promise.all([
    samples(userId, from, today, TRAINING_METRICS),
    rawLatest(userId, ['training_status', 'endurance_score', 'hill_score', 'personal_records', 'personal_record'], today),
  ]);
  raw.personal_records ??= raw.personal_record;
  const s = (m: string): Pt[] => series(rows, m);
  const status = parseTrainingStatus(raw.training_status?.payload);
  const statusCode = s('training_status').at(-1) ?? null;
  return {
    status,
    // The status label from health_samples when there is no raw payload.
    statusFallback: status?.status ?? trainingStatusOf(statusCode?.value ?? null),
    statusDate: status?.date ?? statusCode?.date ?? null,
    load: { acute: s('training_load_acute'), chronic: s('training_load_chronic'), ratio: s('training_load_ratio') },
    focus: { anaerobic: s('load_focus_anaerobic'), high: s('load_focus_high_aerobic'), low: s('load_focus_low_aerobic') },
    endurance: { series: s('endurance_score'), latest: parseEnduranceScore(raw.endurance_score?.payload) },
    hill: { series: s('hill_score'), latest: parseHillScore(raw.hill_score?.payload) },
    races: (
      [
        ['5 km', 'race_pred_5k_s'],
        ['10 km', 'race_pred_10k_s'],
        ['Half marathon', 'race_pred_half_s'],
        ['Marathon', 'race_pred_marathon_s'],
      ] as const
    ).map(([label, m]) => ({ label, series: s(m), latest: latestWithChange(s(m), 28) })),
    tiles: {
      ltHr: s('lactate_threshold_hr_bpm'),
      ltPace: s('lactate_threshold_pace_s_per_km'),
      ftp: s('cycling_ftp_w'),
      vo2max: s('vo2max'),
      vo2maxCycling: s('vo2max_cycling'),
      fitnessAge: s('fitness_age'),
    },
    records: parsePersonalRecords(raw.personal_records?.payload),
    recordsDate: raw.personal_records?.date ?? null,
  };
}
export type TrainingView = Awaited<ReturnType<typeof loadTraining>>;

// ---- /health board ----

/** The /health board for the last `days` days (30 or 90): daily series, watch coverage and normal ranges (board.mjs). */
export async function loadBoard(userId: string, today: string, days: number, syncedThrough: string | null) {
  const rows = await samples(userId, addDays(today, -(days + NORMAL_DAYS)), today, Object.keys(BOARD_METRICS));
  return boardOf(rows, { today, days, syncedThrough });
}
export type Board = Awaited<ReturnType<typeof loadBoard>>;

// ---- Home: Recovery today ----

const RECOVERY_METRICS = ['training_readiness', 'body_battery_high', 'body_battery_low', 'hrv_status', 'hrv_night_avg_ms', 'sleep_total_min', 'sleep_score', 'training_status', 'vo2max', 'vo2max_cycling'];

export async function loadRecoveryToday(userId: string, today: string) {
  // 60 days back: VO2max changes only after some activities; everything else must be from today or yesterday.
  const rows = await samples(userId, addDays(today, -59), today, RECOVERY_METRICS);
  const recent = (m: string, days = 1) => {
    const p = series(rows, m).at(-1);
    return p && p.date >= addDays(today, -days) ? p : null;
  };
  const status = recent('training_status', 6);
  return {
    today,
    readiness: recent('training_readiness'),
    bodyBatteryHigh: recent('body_battery_high'),
    bodyBatteryLow: recent('body_battery_low'),
    hrvStatus: recent('hrv_status'),
    hrv: recent('hrv_night_avg_ms'),
    sleepMin: recent('sleep_total_min'),
    sleepScore: recent('sleep_score'),
    trainingStatus: status ? { date: status.date, ...trainingStatusOf(status.value) } : null,
    vo2max: recent('vo2max', 59),
    vo2maxCycling: recent('vo2max_cycling', 59),
    hasData: rows.some((r) => r.date >= addDays(today, -6)),
  };
}
export type RecoveryToday = Awaited<ReturnType<typeof loadRecoveryToday>>;

// ---- Home: Lean and strong (weight and body fat) ----

/**
 * Weight and body fat for the home page: the latest reading, the change over 4 weeks, and the last 12 weeks of
 * weight. Readings come from the scale through the vitals push (health_samples). Null fields when there are none.
 */
export async function loadBody(userId: string, today: string) {
  const from = addDays(today, -83);
  const rows = await samples(userId, from, today, ['weight_kg', 'body_fat_pct']);
  const weight = series(rows, 'weight_kg') as Pt[];
  const fat = series(rows, 'body_fat_pct') as Pt[];
  const latest = latestWithChange(weight, 28) as (Pt & { change: number | null }) | null;
  return {
    weight: latest ? { date: latest.date, value: latest.value } : null,
    change4w: latest?.change ?? null,
    bodyFat: fat.at(-1) ?? null,
    series: weight,
  };
}
export type Body = Awaited<ReturnType<typeof loadBody>>;
