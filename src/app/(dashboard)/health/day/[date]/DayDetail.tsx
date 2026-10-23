import Hypnogram from '@/components/vitals/Hypnogram';
import { STAGE_STYLE } from '@/components/vitals/stages';
import TimeChart from '@/components/vitals/TimeChart';
import { stageMinutes, words } from '@/lib/vitals/garmin-day.mjs';
import { hrvStatusLabel } from '@/lib/vitals/garmin-training.mjs';
import type { DayView } from '@/lib/vitals/garmin-pages';

const H = 3600_000;
const hm = (m: number | null | undefined) => (m == null ? '-' : `${Math.floor(Math.round(m) / 60)}:${String(Math.round(m) % 60).padStart(2, '0')}`);
const clock = (t: number) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
const r0 = (v: number | null | undefined) => (v == null ? '-' : Math.round(v).toLocaleString('en-US'));

function Card({ title, children, note }: { title: string; children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border bg-[var(--viz-surface)] p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-[var(--viz-ink)]">{title}</h2>
        {note && <span className="text-xs text-[var(--viz-muted)]">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium text-[var(--viz-muted)]">{label}</div>
      <div className="text-xl font-semibold tabular-nums text-[var(--viz-ink)]">{value}</div>
      {sub && <div className="truncate text-[11px] text-[var(--viz-ink-2)]">{sub}</div>}
    </div>
  );
}

/** A 0-100 bar with its value as text. */
function Meter({ label, value, sub }: { label: string; value: number; sub?: string | null }) {
  return (
    <div className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 text-xs sm:grid-cols-[10rem_1fr_7rem]">
      <span className="truncate text-[var(--viz-ink)]">{label}</span>
      <div className="relative h-2.5 rounded-full bg-[var(--viz-band)]" aria-hidden>
        <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--viz-ctl)]" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      <span className="text-right tabular-nums text-[var(--viz-ink-2)]">
        <b className="font-semibold text-[var(--viz-ink)]">{Math.round(value)}%</b>
        {sub ? ` · ${sub}` : ''}
      </span>
    </div>
  );
}

export default function DayDetail({ d }: { d: DayView }) {
  const v = d.values;
  const dayStart = Date.parse(`${d.date}T00:00:00Z`); // local midnight in "local ms"
  const dayEnd = dayStart + 24 * H;
  const s = d.sleep;
  const stages = s?.stages ?? [];
  const sleepFrom = s?.start ?? stages[0]?.start ?? dayStart - 3 * H;
  const sleepTo = s?.end ?? stages.at(-1)?.end ?? dayStart + 8 * H;
  const mins = s ? stageMinutes(s) : null;
  const sleepTotal = s?.totalMin ?? v.sleep_total_min ?? null;
  const score = s?.score ?? v.sleep_score ?? null;
  const hrvBand = d.hrv?.baseline ?? (v.hrv_baseline_low_ms != null && v.hrv_baseline_high_ms != null ? { low: v.hrv_baseline_low_ms, high: v.hrv_baseline_high_ms } : null);
  const readiness = d.readiness;
  const sum = d.summary;
  const steps = sum?.steps ?? v.steps ?? null;
  const goal = sum?.stepGoal ?? null;
  const moderate = sum?.moderateMin ?? v.intensity_minutes_moderate ?? null;
  const vigorous = sum?.vigorousMin ?? v.intensity_minutes_vigorous ?? null;

  return (
    <div className="space-y-4">
      <Card title="Sleep" note={s?.start && s?.end ? `${clock(s.start)} – ${clock(s.end)}` : 'The night that ends on this day'}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Asleep" value={`${hm(sleepTotal)} h`} sub={s?.awakeCount != null ? `${s.awakeCount} times awake` : null} />
          <Stat label="Sleep score" value={score == null ? '-' : String(Math.round(score))} sub={words(s?.quality ?? null)} />
          <Stat label="Avg sleep stress" value={r0(s?.avgStress ?? v.sleep_avg_stress)} />
          <Stat label="Resting HR" value={`${r0(s?.restingHr ?? v.resting_hr_bpm)} bpm`} sub={v.sleep_avg_hr_bpm != null ? `sleep avg ${r0(v.sleep_avg_hr_bpm)} bpm` : null} />
        </div>
        {mins && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--viz-ink-2)]">
            {(['deep', 'light', 'rem', 'awake'] as const).map((k) => (
              <li key={k} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: STAGE_STYLE[k].color }} />
                {STAGE_STYLE[k].label} <b className="tabular-nums text-[var(--viz-ink)]">{hm(mins[k])}</b>
                {sleepTotal ? <span className="tabular-nums">({Math.round((mins[k] / (sleepTotal + (k === 'awake' ? mins.awake : 0))) * 100)}%)</span> : null}
              </li>
            ))}
          </ul>
        )}
        {/* The stage list above is its legend, with the minutes. */}
        <Hypnogram stages={stages} from={sleepFrom} to={sleepTo} legend={!mins} />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <TimeChart title="Heart rate in sleep" points={s?.hr ?? []} from={sleepFrom} to={sleepTo} unit="bpm" color="var(--viz-down)" empty="No sleep heart rate." height={120} />
          <TimeChart title="Stress in sleep" points={s?.stress ?? []} from={sleepFrom} to={sleepTo} unit="stress" kind="bars" yMin={0} yMax={100} color="var(--color-amber-500)" empty="No sleep stress." avg={s?.avgStress ?? v.sleep_avg_stress} height={120} />
          <TimeChart
            title="Blood oxygen (SpO2)"
            points={s?.spo2 ?? []}
            from={sleepFrom}
            to={sleepTo}
            unit="%"
            yMax={100}
            color="var(--viz-ctl)"
            empty={s?.avgSpo2 != null ? `Average ${Math.round(s.avgSpo2)}%. No readings over the night.` : 'No SpO2 for this night.'}
            height={120}
          />
        </div>
      </Card>

      <Card title="Overnight HRV" note={d.hrv?.status ? `Status: ${words(d.hrv.status)}` : hrvStatusLabel(v.hrv_status ?? null) ? `Status: ${hrvStatusLabel(v.hrv_status)}` : undefined}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Overnight average" value={`${r0(d.hrv?.lastNightAvg ?? v.hrv_night_avg_ms)} ms`} sub="RMSSD" />
          <Stat label="Highest 5 min" value={`${r0(d.hrv?.lastNight5MinHigh)} ms`} />
          <Stat label="7-day average" value={`${r0(d.hrv?.weeklyAvg ?? v.hrv_weekly_avg_ms)} ms`} />
          <Stat label="Balanced range" value={hrvBand ? `${r0(hrvBand.low)}–${r0(hrvBand.high)}` : '-'} sub="Garmin's baseline for you" />
        </div>
        <TimeChart
          title="HRV readings"
          points={d.hrv?.readings ?? []}
          from={sleepFrom}
          to={sleepTo}
          unit="ms"
          kind="dots"
          band={hrvBand ? { ...hrvBand, label: `Balanced range ${r0(hrvBand.low)}–${r0(hrvBand.high)} ms` } : null}
          empty="No HRV readings for this night."
          height={130}
        />
      </Card>

      <Card title="Training readiness">
        {!readiness && v.training_readiness == null ? (
          <p className="text-sm text-[var(--viz-muted)]">No training readiness for this day.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {/* The morning score is the one Home and Health show; Garmin keeps updating it through the day. */}
              <Stat label="Morning" value={r0(v.training_readiness ?? readiness?.score)} sub={v.training_readiness == null ? readiness?.level ?? null : null} />
              {readiness?.score != null && readiness.at && readiness.score !== v.training_readiness && (
                <Stat label={`Latest, ${clock(readiness.at)}`} value={r0(readiness.score)} sub={readiness.level} />
              )}
              <Stat label="Recovery time" value={readiness?.recoveryTimeH != null ? `${Math.round(readiness.recoveryTimeH)} h` : v.readiness_recovery_time_h != null ? `${Math.round(v.readiness_recovery_time_h)} h` : '-'} />
              <Stat label="Acute load" value={r0(readiness?.acuteLoad ?? v.readiness_acute_load)} />
              <Stat label="Sleep score" value={r0(readiness?.sleepScore ?? score)} />
            </div>
            {readiness?.feedback && <p className="text-xs text-[var(--viz-ink-2)]">{words(readiness.feedback)}</p>}
            {readiness && readiness.factors.length > 0 ? (
              <div className="space-y-1.5">
                {readiness.factors.map((f) => <Meter key={f.key} label={f.label} value={f.percent} sub={f.feedback} />)}
              </div>
            ) : (
              <p className="text-xs text-[var(--viz-muted)]">Garmin sent no parts for this score.</p>
            )}
          </>
        )}
      </Card>

      <Card title="All day">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <TimeChart
            title="Heart rate"
            subtitle={d.heartRate?.resting != null ? `Resting ${d.heartRate.resting} bpm${d.heartRate.max != null ? ` · max ${d.heartRate.max}` : ''}` : undefined}
            points={d.heartRate?.values ?? []}
            from={dayStart}
            to={dayEnd}
            unit="bpm"
            color="var(--viz-down)"
            empty="No all-day heart rate."
          />
          <TimeChart
            title="Stress"
            points={d.stress}
            from={dayStart}
            to={dayEnd}
            unit="stress"
            kind="bars"
            yMin={0}
            yMax={100}
            color="var(--color-amber-500)"
            empty="No stress readings."
          />
        </div>
        <TimeChart
          title="Body Battery"
          subtitle={sum?.bodyBatteryHigh != null ? `High ${sum.bodyBatteryHigh} · low ${sum.bodyBatteryLow ?? '-'} · charged +${sum.bodyBatteryCharged ?? '-'} · drained −${sum.bodyBatteryDrained ?? '-'}` : undefined}
          points={d.bodyBattery}
          from={dayStart}
          to={dayEnd}
          unit="Body Battery"
          yMin={0}
          yMax={100}
          color="var(--viz-ctl)"
          events={d.events}
          empty="No Body Battery timeline."
        />
      </Card>

      <Card title="Steps and intensity">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Steps" value={r0(steps)} sub={goal ? `goal ${r0(goal)} · ${steps != null && steps >= goal ? 'met' : 'not met'}` : null} />
          <Stat
            label="Intensity minutes"
            value={moderate == null && vigorous == null ? '-' : r0((moderate ?? 0) + 2 * (vigorous ?? 0))}
            sub={moderate != null || vigorous != null ? `${r0(moderate)} moderate · ${r0(vigorous)} vigorous (×2)` : null}
          />
          <Stat label="Floors climbed" value={r0(sum?.floors ?? v.floors_climbed)} />
          <Stat label="Active energy" value={`${r0(sum?.activeKcal ?? v.active_energy_kcal)} kcal`} sub={sum?.distanceKm != null ? `${sum.distanceKm.toFixed(1)} km moved` : null} />
        </div>
        {steps != null && goal ? (
          <div className="relative h-2.5 rounded-full bg-[var(--viz-band)]" role="img" aria-label={`${r0(steps)} of ${r0(goal)} steps`}>
            <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--viz-good)]" style={{ width: `${Math.min(100, (steps / goal) * 100)}%` }} />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
