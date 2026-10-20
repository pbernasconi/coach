import type { Readiness } from '@/lib/vitals/queries';

const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const hm = (m: number) => `${Math.floor(Math.round(m) / 60)} h ${String(Math.round(m) % 60).padStart(2, '0')}`;
const signed = (n: number, d = 0) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toFixed(d)}`;

const READY = {
  good: { label: 'Ready', color: 'var(--viz-good)', text: 'HRV, resting heart rate and sleep are all near your normal.' },
  ok: { label: 'One flag', color: 'var(--color-amber-500)', text: 'One signal is off. Keep the plan, but watch how the session feels.' },
  low: { label: 'Low', color: 'var(--viz-down)', text: 'Several signals are off. An easier day is a good idea.' },
  unknown: { label: 'Not enough data', color: 'var(--viz-muted)', text: 'Readiness needs HRV or resting heart rate with 14 days of history, or last night’s sleep.' },
} as const;

// Garmin's own bands for its 0-100 scores.
const READINESS_LEVELS: [number, string][] = [[95, 'Prime'], [75, 'High'], [50, 'Moderate'], [25, 'Low'], [0, 'Poor']];
const SLEEP_LEVELS: [number, string][] = [[90, 'Excellent'], [80, 'Good'], [60, 'Fair'], [0, 'Poor']];
const level = (v: number, levels: [number, string][]) => levels.find(([min]) => v >= min)?.[1] ?? '';

function Tile({ label, value, foot, tone }: { label: string; value: string; foot: React.ReactNode; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-lg border bg-[var(--viz-surface)] p-4">
      <div className="text-xs font-medium text-[var(--viz-muted)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-[var(--viz-ink)] sm:text-3xl">{value}</div>
      <div className={`mt-1 text-xs ${tone === 'bad' ? 'text-[var(--viz-down)]' : tone === 'good' ? 'text-[var(--viz-up)]' : 'text-[var(--viz-muted)]'}`}>{foot}</div>
    </div>
  );
}

/** The readiness verdict and four tiles: HRV, resting HR, last night's sleep, weight. */
export default function ReadinessTiles({ r }: { r: Readiness }) {
  const v = READY[r.status];
  const { hrv, restingHr: rhr, sleep, weight, garmin } = r;
  const hasGarmin = garmin.sleepScore || garmin.bodyBattery || garmin.trainingReadiness;
  const when = (d: string) => (d === r.today ? 'today' : 'yesterday');
  return (
    <section className="space-y-3">
      <div className="rounded-lg border bg-[var(--viz-surface)] p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-2 text-lg font-semibold text-[var(--viz-ink)]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: v.color }} />
            {v.label}
          </span>
          <span className="text-sm text-[var(--viz-ink-2)]">{v.text}</span>
        </div>
        {r.flags.length > 0 && (
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-[var(--viz-ink-2)]">
            {r.flags.map((f) => <li key={f}>{f}</li>)}
          </ul>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label={`HRV (${hrv?.measure ?? 'RMSSD'}), 7-day average`}
          value={hrv ? `${Math.round(hrv.avg7)} ms` : '-'}
          tone={hrv?.status === 'below' ? 'bad' : hrv?.status === 'above' ? 'good' : undefined}
          foot={
            !hrv ? 'No HRV this week' : hrv.baseline === null ? `${hrv.baselineDays} of 14 baseline days` : (
              <>{signed((hrv.pct ?? 0) * 100)}% vs 60-day baseline {Math.round(hrv.baseline)} ms</>
            )
          }
        />
        <Tile
          label="Resting HR, 7-day average"
          value={rhr ? `${Math.round(rhr.avg7)} bpm` : '-'}
          tone={rhr?.status === 'elevated' ? 'bad' : undefined}
          foot={
            !rhr ? 'No resting HR this week' : rhr.baseline === null ? `${rhr.baselineDays} of 14 baseline days` : (
              <>{signed(rhr.delta ?? 0, 1)} bpm vs 60-day baseline {Math.round(rhr.baseline)}</>
            )
          }
        />
        <Tile
          label="Last night's sleep"
          value={sleep ? hm(sleep.totalMin) : '-'}
          tone={sleep?.status === 'short' ? 'bad' : undefined}
          foot={
            sleep
              ? [sleep.deepMin !== null && `deep ${hm(sleep.deepMin)}`, sleep.remMin !== null && `REM ${hm(sleep.remMin)}`, `7-day avg ${hm(sleep.avg7)}`].filter(Boolean).join(' · ')
              : 'No sleep for last night'
          }
        />
        <Tile
          label="Weight"
          value={weight ? `${weight.latest.toFixed(1)} kg` : '-'}
          foot={
            weight
              ? weight.change28 === null
                ? fmtDay(weight.latestDate)
                : `${signed(weight.change28, 1)} kg in 4 weeks (7-day avg)`
              : 'No weight in 40 days'
          }
        />
      </div>
      {hasGarmin && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Tile
            label="Training readiness"
            value={garmin.trainingReadiness ? String(Math.round(garmin.trainingReadiness.value)) : '-'}
            tone={garmin.trainingReadiness && garmin.trainingReadiness.value < 25 ? 'bad' : undefined}
            foot={garmin.trainingReadiness ? `${level(garmin.trainingReadiness.value, READINESS_LEVELS)} · Garmin, ${when(garmin.trainingReadiness.date)}` : 'None today or yesterday'}
          />
          <Tile
            label="Body Battery"
            value={garmin.bodyBattery?.high != null ? String(Math.round(garmin.bodyBattery.high)) : '-'}
            foot={
              garmin.bodyBattery
                ? `high${garmin.bodyBattery.low != null ? ` · low ${Math.round(garmin.bodyBattery.low)}` : ''} · ${when(garmin.bodyBattery.date)}`
                : 'None today or yesterday'
            }
          />
          <Tile
            label="Sleep score"
            value={garmin.sleepScore ? String(Math.round(garmin.sleepScore.value)) : '-'}
            tone={garmin.sleepScore && garmin.sleepScore.value < 60 ? 'bad' : undefined}
            foot={garmin.sleepScore ? `${level(garmin.sleepScore.value, SLEEP_LEVELS)} · ${when(garmin.sleepScore.date)}` : 'None today or yesterday'}
          />
        </div>
      )}
      {garmin.hrvStatus && garmin.hrvStatus.code > 0 && (
        <p className="text-xs text-[var(--viz-muted)]">
          Garmin HRV status: <span className="text-[var(--viz-ink-2)]">{garmin.hrvStatus.label}</span>
          {garmin.hrvWeeklyAvg && ` · 7-day average ${Math.round(garmin.hrvWeeklyAvg.value)} ms`}
        </p>
      )}
    </section>
  );
}
