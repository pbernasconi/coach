import { sql } from '@/db';
import { toDay } from '@/lib/db-time.mjs';
import { cached } from '@/lib/data-cache';
import { addDays, hrvMetricOf, readinessFrom, seriesOf, type ReadinessSummary, type SampleRow } from './readiness.mjs';
import type { LabStatus } from './labs.mjs';
import { mergeAliases, mergeByCatalog } from './labs-highlights.mjs';
import { garminStatusFrom, type GarminStatus } from './garmin.mjs';
import { garminConnection } from './repository';

export type Readiness = ReadinessSummary & { lastSampleDate: string | null };
export type Point = { date: string; value: number };

export const CHART_DAYS = 90;
const READINESS_METRICS = ['hrv_night_avg_ms', 'hrv_sdnn_ms', 'hrv_weekly_avg_ms', 'hrv_status', 'sleep_score', 'body_battery_high', 'body_battery_low', 'training_readiness', 'resting_hr_bpm', 'sleep_total_min', 'sleep_deep_min', 'sleep_rem_min', 'sleep_core_min', 'sleep_awake_min', 'weight_kg'];
const CHART_METRICS = [...READINESS_METRICS, 'vo2max'];

const utcToday = () => new Date().toISOString().slice(0, 10);

/** Samples for `userId` from `from` to `today`, owner-scoped. Cached under 'vitals' (src/lib/data-cache.ts). */
const samples = cached(
  async (userId: string, from: string, today: string, metrics: string[]): Promise<SampleRow[]> =>
    (await sql`
      SELECT to_char(date, 'YYYY-MM-DD') AS date, metric, value
      FROM health_samples
      WHERE user_id = ${userId} AND date >= ${from}::date AND date <= ${today}::date AND metric = ANY(${metrics}::text[])
      ORDER BY date`) as SampleRow[],
  'health-samples',
  'vitals'
);

/**
 * Today's readiness (HRV and resting HR against their 60-day baselines, last night's sleep, weight trend) for the
 * home page and /api/home. `today` is YYYY-MM-DD in the viewer's zone; it defaults to the UTC day.
 */
export async function loadReadiness(userId: string, today: string = utcToday()): Promise<Readiness> {
  const rows = await samples(userId, addDays(today, -70), today, READINESS_METRICS);
  return { ...readinessFrom(rows, today), lastSampleDate: rows.at(-1)?.date ?? null };
}

export type LabReading = {
  collectedOn: string;
  value: number | null;
  valueText: string | null;
  status: LabStatus;
};

export type Biomarker = {
  biomarker: string;
  category: string;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  optimalLow: number | null;
  optimalHigh: number | null;
  latest: LabReading;
  history: LabReading[]; // oldest first, the latest included
};

export type LabCategory = { category: string; outOfRange: number; biomarkers: Biomarker[] };

export const STATUS_RANK: Record<LabStatus, number> = { out_of_range: 0, unknown: 1, in_range: 2, optimal: 3 };

/** Lab results grouped by category; out-of-range biomarkers first, and categories with any out of range first. */
export async function loadLabs(userId: string): Promise<{ categories: LabCategory[]; draws: string[] }> {
  const [rows, catalog] = await Promise.all([sql`
    SELECT to_char(collected_on, 'YYYY-MM-DD') AS collected_on, biomarker, category, value::float8 AS value, value_text, unit,
           ref_low::float8 AS ref_low, ref_high::float8 AS ref_high, optimal_low::float8 AS optimal_low,
           optimal_high::float8 AS optimal_high, status
    FROM lab_results WHERE user_id = ${userId} ORDER BY biomarker, collected_on`,
    sql`SELECT name, result_names, status FROM lab_biomarkers WHERE user_id = ${userId} AND source = 'function'`,
  ]) as [{
    collected_on: string; biomarker: string; category: string | null; value: number | null; value_text: string | null;
    unit: string | null; ref_low: number | null; ref_high: number | null; optimal_low: number | null; optimal_high: number | null;
    status: LabStatus;
  }[], { name: string | null; result_names: string[] | null; status: string }[]];
  const byName = new Map<string, typeof rows>();
  for (const r of rows) byName.set(r.biomarker, [...(byName.get(r.biomarker) ?? []), r]);
  const perName: Biomarker[] = [...byName.values()].map((rs) => {
    const last = rs[rs.length - 1];
    const history = rs.map((r) => ({ collectedOn: r.collected_on, value: r.value, valueText: r.value_text, status: r.status }));
    return {
      biomarker: last.biomarker,
      category: last.category ?? rs.findLast((r) => r.category)?.category ?? 'Other',
      unit: last.unit,
      refLow: last.ref_low,
      refHigh: last.ref_high,
      optimalLow: last.optimal_low,
      optimalHigh: last.optimal_high,
      latest: history[history.length - 1],
      history,
    };
  });
  // One row per Function biomarker with Function's status, as on /health/labs.
  const biomarkers = mergeAliases(mergeByCatalog(perName, catalog.map((c) => ({ resultNames: c.result_names ?? [], name: c.name, status: c.status }))));
  const groups = new Map<string, Biomarker[]>();
  for (const b of biomarkers) groups.set(b.category, [...(groups.get(b.category) ?? []), b]);
  const categories = [...groups.entries()]
    .map(([category, bs]) => ({
      category,
      outOfRange: bs.filter((b) => b.latest.status === 'out_of_range').length,
      biomarkers: bs.sort((a, b) => STATUS_RANK[a.latest.status] - STATUS_RANK[b.latest.status] || a.biomarker.localeCompare(b.biomarker)),
    }))
    .sort((a, b) => b.outOfRange - a.outOfRange || a.category.localeCompare(b.category));
  const draws = [...new Set(rows.map((r) => r.collected_on))].sort();
  return { categories, draws };
}

export type HealthView = {
  readiness: Readiness;
  series: Record<'hrv' | 'restingHr' | 'sleep' | 'weight' | 'vo2max', Point[]>;
  hrvMeasure: 'RMSSD' | 'SDNN'; // which HRV the hrv series and the HRV tile show (readiness.mjs, hrvMetricOf)
  sleepStages: Record<string, { deep: number | null; rem: number | null; core: number | null; awake: number | null }>;
  baselines: { hrv: { mean: number; sd: number } | null; restingHr: { mean: number; sd: number } | null };
  labs: Awaited<ReturnType<typeof loadLabs>>;
};

/** Everything the /health page shows. */
export async function loadHealth(userId: string, today: string): Promise<HealthView> {
  const from = addDays(today, -Math.max(CHART_DAYS, 70));
  const [rows, labs] = await Promise.all([samples(userId, from, today, CHART_METRICS), loadLabs(userId)]);
  const readiness = { ...readinessFrom(rows, today), lastSampleDate: rows.at(-1)?.date ?? null };
  const chartFrom = addDays(today, -(CHART_DAYS - 1));
  const hrvMetric = hrvMetricOf(rows);
  const s = (m: string) => seriesOf(rows, m, chartFrom, today);
  const sleepStages: HealthView['sleepStages'] = {};
  for (const r of rows) {
    const key = { sleep_deep_min: 'deep', sleep_rem_min: 'rem', sleep_core_min: 'core', sleep_awake_min: 'awake' }[r.metric] as
      | 'deep' | 'rem' | 'core' | 'awake' | undefined;
    if (!key || r.date < chartFrom) continue;
    sleepStages[r.date] ??= { deep: null, rem: null, core: null, awake: null };
    sleepStages[r.date][key] = Number(r.value);
  }
  const band = (b: { baseline: number | null; sd: number | null } | null) =>
    b && b.baseline !== null && b.sd !== null ? { mean: b.baseline, sd: b.sd } : null;
  return {
    readiness,
    hrvMeasure: hrvMetric === 'hrv_night_avg_ms' ? 'RMSSD' : 'SDNN',
    series: { hrv: s(hrvMetric), restingHr: s('resting_hr_bpm'), sleep: s('sleep_total_min'), weight: s('weight_kg'), vo2max: s('vo2max') },
    sleepStages,
    baselines: { hrv: band(readiness.hrv), restingHr: band(readiness.restingHr) },
    labs,
  };
}

/** The Garmin job's state for /health, Settings and the status banner (src/lib/vitals/garmin.mjs). */
export async function loadGarminStatus(userId: string, now: number = Date.now()): Promise<GarminStatus> {
  return garminStatusFrom(await garminConnection(userId), now);
}

export type ClinicianNoteGroup = { requisitionId: string; notedOn: string; notes: { category: string | null; body: string }[] };

/** The clinician's notes per Function test order, newest order first, in Function's order inside an order. */
export async function loadClinicianNotes(userId: string): Promise<ClinicianNoteGroup[]> {
  const rows = (await sql`
    SELECT requisition_id, noted_on, category, body FROM clinician_notes
    WHERE user_id = ${userId} ORDER BY noted_on DESC, requisition_id, position`) as Record<string, unknown>[];
  const groups = new Map<string, ClinicianNoteGroup>();
  for (const r of rows) {
    const id = String(r.requisition_id);
    if (!groups.has(id)) groups.set(id, { requisitionId: id, notedOn: toDay(r.noted_on) ?? '', notes: [] });
    groups.get(id)!.notes.push({ category: r.category == null ? null : String(r.category), body: String(r.body) });
  }
  return [...groups.values()];
}
