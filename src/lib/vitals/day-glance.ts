import { stageMinutes, words } from './garmin-day.mjs';
import { hrvStatusLabel } from './garmin-training.mjs';
import type { DayView } from './garmin-pages';
import type { StageSpan } from '@/components/vitals/stages';

/**
 * A small summary of one Garmin day for the hover card on the plan calendar (HealthBadge). The series are
 * cut down so the card stays fast: Body Battery to about 96 points, sleep to its stage spans.
 */
export type DayGlance = {
  date: string;
  hasData: boolean;
  readiness: { score: number; level: string | null; feedback: string | null } | null;
  sleep: {
    totalMin: number | null;
    score: number | null;
    quality: string | null;
    start: number | null;
    end: number | null;
    stages: StageSpan[];
    minutes: { deep: number; light: number; rem: number; awake: number } | null;
  } | null;
  hrv: { avg: number; low: number | null; high: number | null; status: string | null } | null;
  restingHr: number | null;
  bodyBattery: { points: { t: number; v: number }[]; high: number | null; low: number | null; charged: number | null; drained: number | null } | null;
  stressAvg: number | null;
  steps: number | null;
  stepGoal: number | null;
  intensityMin: number | null;
  activeKcal: number | null;
};

const n = (v: number | null | undefined) => (v == null || Number.isNaN(v) ? null : v);

function thin<T>(list: T[], max: number) {
  if (list.length <= max) return list;
  const step = list.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(list[Math.floor(i * step)]);
  out.push(list[list.length - 1]);
  return out;
}

export function dayGlance(d: DayView): DayGlance {
  const v = d.values;
  const s = d.sleep;
  const r = d.readiness;
  const sum = d.summary;
  const score = n(r?.score ?? v.training_readiness);
  const hrvAvg = n(d.hrv?.lastNightAvg ?? v.hrv_night_avg_ms);
  const band = d.hrv?.baseline ?? (v.hrv_baseline_low_ms != null && v.hrv_baseline_high_ms != null ? { low: v.hrv_baseline_low_ms, high: v.hrv_baseline_high_ms } : null);
  const totalMin = n(s?.totalMin ?? v.sleep_total_min);
  const moderate = n(sum?.moderateMin ?? v.intensity_minutes_moderate);
  const vigorous = n(sum?.vigorousMin ?? v.intensity_minutes_vigorous);
  const bb = d.bodyBattery;
  return {
    date: d.date,
    hasData: d.hasData,
    readiness: score == null ? null : { score: Math.round(score), level: r?.level ?? null, feedback: r?.feedback ? words(r.feedback) : null },
    sleep:
      s || totalMin != null
        ? {
            totalMin,
            score: n(s?.score ?? v.sleep_score),
            quality: s?.quality ? words(s.quality) : null,
            start: s?.start ?? s?.stages[0]?.start ?? null,
            end: s?.end ?? s?.stages.at(-1)?.end ?? null,
            stages: (s?.stages ?? []) as StageSpan[],
            minutes: s ? stageMinutes(s) : null,
          }
        : null,
    hrv: hrvAvg == null ? null : { avg: Math.round(hrvAvg), low: band?.low ?? null, high: band?.high ?? null, status: d.hrv?.status ? words(d.hrv.status) : hrvStatusLabel(v.hrv_status ?? null) },
    restingHr: n(s?.restingHr ?? d.heartRate?.resting ?? sum?.restingHr ?? v.resting_hr_bpm),
    bodyBattery:
      bb.length > 1 || sum?.bodyBatteryHigh != null
        ? {
            points: thin(bb, 96),
            high: n(sum?.bodyBatteryHigh) ?? (bb.length ? Math.max(...bb.map((p) => p.v)) : null),
            low: n(sum?.bodyBatteryLow) ?? (bb.length ? Math.min(...bb.map((p) => p.v)) : null),
            charged: n(sum?.bodyBatteryCharged),
            drained: n(sum?.bodyBatteryDrained),
          }
        : null,
    stressAvg: n(d.stressAvg ?? sum?.avgStress),
    steps: n(sum?.steps ?? v.steps),
    stepGoal: n(sum?.stepGoal),
    intensityMin: moderate == null && vigorous == null ? null : (moderate ?? 0) + 2 * (vigorous ?? 0),
    activeKcal: n(sum?.activeKcal ?? v.active_energy_kcal),
  };
}
