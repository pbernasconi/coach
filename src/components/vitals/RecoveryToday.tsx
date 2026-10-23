import { fmtDate } from '@/lib/vitals/health-view.mjs';
import Link from 'next/link';
import type { RecoveryToday as Recovery } from '@/lib/vitals/garmin-pages';
import { hrvStatusLabel } from '@/lib/vitals/garmin-training.mjs';

/** A YYYY-MM-DD as "Oct 22, 2026"; other text as is. */
const dateText = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? fmtDate(d) : d);

// Garmin's own bands for its 0-100 scores.
const READINESS: [number, string][] = [[95, 'Prime'], [75, 'High'], [50, 'Moderate'], [25, 'Low'], [0, 'Poor']];
const SLEEP: [number, string][] = [[90, 'Excellent'], [80, 'Good'], [60, 'Fair'], [0, 'Poor']];
const band = (v: number, bands: [number, string][]) => bands.find(([min]) => v >= min)?.[1] ?? '';
const hm = (m: number) => `${Math.floor(Math.round(m) / 60)}:${String(Math.round(m) % 60).padStart(2, '0')}`;
const TONE = { good: 'var(--viz-good)', warn: 'var(--color-amber-500)', bad: 'var(--viz-down)', neutral: 'var(--viz-muted)' } as const;

function Item({ label, value, note, tone }: { label: string; value: string; note?: string | null; tone?: keyof typeof TONE }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium text-[var(--viz-muted)]">{label}</div>
      <div className="flex items-baseline gap-1.5">
        {tone && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: TONE[tone] }} aria-hidden />}
        <span className="text-lg font-semibold tabular-nums text-[var(--viz-ink)]">{value}</span>
      </div>
      {note && <div className="truncate text-[11px] text-[var(--viz-ink-2)]">{note}</div>}
    </div>
  );
}

/**
 * Home: "Recovery today", Garmin's morning picture in one card: training readiness, Body Battery, HRV status, last
 * night's sleep and score, and training status. Links to the day page. Every value has a word, not only a colour.
 */
export default function RecoveryToday({ r }: { r: Recovery }) {
  const hrv = hrvStatusLabel(r.hrvStatus?.value ?? null);
  return (
    <Link
      href={`/health/day/${r.today}`}
      className="block rounded-lg border bg-[var(--viz-surface)] p-4 transition-colors hover:bg-[var(--viz-band)]"
      aria-label="Recovery today. Open today's health details."
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-semibold text-[var(--viz-ink)]">Recovery today</h2>
        <span className="text-xs text-[var(--viz-muted)]">Garmin · details →</span>
      </div>
      {!r.hasData ? (
        <p className="text-sm text-[var(--viz-muted)]">No Garmin data in the last 7 days. The Garmin job sends it each morning.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
          <Item
            label="Training readiness"
            value={r.readiness ? String(Math.round(r.readiness.value)) : '-'}
            note={r.readiness ? band(r.readiness.value, READINESS) : 'none today'}
            tone={r.readiness ? (r.readiness.value < 25 ? 'bad' : r.readiness.value < 50 ? 'warn' : 'good') : undefined}
          />
          <Item
            label="Body Battery"
            value={r.bodyBatteryHigh ? String(Math.round(r.bodyBatteryHigh.value)) : '-'}
            note={r.bodyBatteryHigh ? `high${r.bodyBatteryLow ? ` · low ${Math.round(r.bodyBatteryLow.value)}` : ''}` : 'none today'}
          />
          <Item
            label="HRV status"
            value={hrv ?? '-'}
            note={r.hrv ? `${Math.round(r.hrv.value)} ms overnight` : null}
            tone={hrv === 'Balanced' ? 'good' : hrv === 'Unbalanced' ? 'warn' : hrv === 'Low' || hrv === 'Poor' ? 'bad' : undefined}
          />
          <Item
            label="Last night"
            value={r.sleepMin ? `${hm(r.sleepMin.value)} h` : '-'}
            note={r.sleepScore ? `score ${Math.round(r.sleepScore.value)} · ${band(r.sleepScore.value, SLEEP)}` : null}
            tone={r.sleepScore ? (r.sleepScore.value < 60 ? 'bad' : r.sleepScore.value < 80 ? 'warn' : 'good') : undefined}
          />
          <Item
            label="Training status"
            value={r.trainingStatus?.label ?? '-'}
            note={r.trainingStatus && r.trainingStatus.date !== r.today ? `as of ${dateText(r.trainingStatus.date)}` : null}
            tone={r.trainingStatus?.tone as keyof typeof TONE | undefined}
          />
          <Item
            label={r.vo2max && r.vo2maxCycling ? 'VO2max run / ride' : r.vo2maxCycling ? 'VO2max (ride)' : 'VO2max'}
            value={r.vo2max || r.vo2maxCycling ? [r.vo2max, r.vo2maxCycling].filter(Boolean).map((p) => p!.value.toFixed(1)).join(' / ') : '-'}
            note={r.vo2max || r.vo2maxCycling ? 'mL/kg/min' : null}
          />
        </div>
      )}
    </Link>
  );
}
