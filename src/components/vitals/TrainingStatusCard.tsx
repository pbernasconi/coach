import { fmtDate } from '@/lib/vitals/health-view.mjs';
import type { TrainingView } from '@/lib/vitals/garmin-pages';
import { RATIO_BANDS, ratioLabel } from '@/lib/vitals/garmin-training.mjs';

/** A YYYY-MM-DD as "Oct 22, 2026"; other text as is. */
const dateText = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? fmtDate(d) : d);

const TONE: Record<string, string> = { good: 'var(--viz-good)', warn: 'var(--color-amber-500)', bad: 'var(--viz-down)', neutral: 'var(--viz-muted)' };
const r0 = (v: number | null | undefined) => (v == null ? '-' : String(Math.round(v)));
const RATIO_MAX = 2.5;

/** The acute:chronic ratio on Garmin's bands: Low, Optimal, High, Very high. The band is named under the bar. */
function RatioBar({ ratio }: { ratio: number }) {
  const pct = (v: number) => `${(Math.min(RATIO_MAX, Math.max(0, v)) / RATIO_MAX) * 100}%`;
  return (
    <div className="space-y-1">
      <div className="relative h-3 overflow-hidden rounded-full" role="img" aria-label={`Acute to chronic load ratio ${ratio.toFixed(1)}, ${ratioLabel(ratio)}`}>
        {RATIO_BANDS.map((b) => (
          <div
            key={b.label}
            className="absolute inset-y-0"
            style={{
              left: pct(b.from),
              width: `calc(${pct(Math.min(RATIO_MAX, b.to))} - ${pct(b.from)})`,
              background: b.label === 'Optimal' ? 'color-mix(in oklab, var(--viz-good) 35%, var(--viz-surface))' : 'var(--viz-band)',
            }}
          />
        ))}
        <div className="absolute inset-y-0 w-1 -translate-x-1/2 rounded-full bg-[var(--viz-ink)]" style={{ left: pct(ratio) }} />
      </div>
      <div className="relative h-3 text-[10px] text-[var(--viz-muted)]">
        {RATIO_BANDS.map((b) => (
          <span key={b.label} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: pct((b.from + Math.min(RATIO_MAX, b.to)) / 2) }}>{b.label}</span>
        ))}
      </div>
    </div>
  );
}

/** One load focus as a bar against Garmin's target range for the last 4 weeks. */
function FocusBar({ label, value, min, max, scale }: { label: string; value: number; min: number | null; max: number | null; scale: number }) {
  const pct = (v: number) => `${(Math.min(scale, Math.max(0, v)) / scale) * 100}%`;
  const verdict = min === null || max === null ? null : value < min ? 'below target' : value > max ? 'above target' : 'in target';
  return (
    <div className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-xs sm:grid-cols-[7.5rem_1fr_9rem]">
      <span className="truncate text-[var(--viz-ink)]">{label}</span>
      <div className="relative h-3" aria-hidden>
        {min !== null && max !== null && <div className="absolute inset-y-0 rounded-sm bg-[var(--viz-band)] outline outline-1 outline-[var(--viz-grid)]" style={{ left: pct(min), width: `calc(${pct(max)} - ${pct(min)})` }} />}
        <div className="absolute inset-y-0.5 left-0 rounded-r-[4px] bg-[var(--viz-ride)]" style={{ width: pct(value) }} />
      </div>
      <span className="text-right tabular-nums text-[var(--viz-ink-2)]">
        <b className="font-semibold text-[var(--viz-ink)]">{Math.round(value)}</b>
        {verdict ? ` · ${verdict}` : ''}
      </span>
    </div>
  );
}

/** Training status, acute and chronic load with the ratio band, and the 4-week load focus. */
export default function TrainingStatusCard({ t }: { t: TrainingView }) {
  const st = t.status;
  const label = t.statusFallback;
  const acute = st?.acute ?? t.load.acute.at(-1)?.value ?? null;
  const chronic = st?.chronic ?? t.load.chronic.at(-1)?.value ?? null;
  const ratio = st?.ratio ?? t.load.ratio.at(-1)?.value ?? (acute !== null && chronic ? acute / chronic : null);
  const focus = st?.focus.length
    ? st.focus.map((f) => ({ key: f.key, label: f.label, value: f.value as number, min: f.min ?? null, max: f.max ?? null }))
    : (
        [
          ['anaerobic', 'Anaerobic', t.focus.anaerobic],
          ['high', 'High aerobic', t.focus.high],
          ['low', 'Low aerobic', t.focus.low],
        ] as const
      ).flatMap(([key, l, s]) => (s.at(-1) ? [{ key, label: l, value: s.at(-1)!.value, min: null, max: null }] : []));
  const scale = Math.max(100, ...focus.map((f) => Math.max(f.value, f.max ?? 0))) * 1.1;
  const empty = !label && acute === null && !focus.length;

  return (
    <section className="space-y-4 rounded-lg border bg-[var(--viz-surface)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-[var(--viz-ink)]">Training status</h2>
        {t.statusDate && <span className="text-xs text-[var(--viz-muted)]">as of {dateText(t.statusDate)}</span>}
      </div>
      {empty ? (
        <p className="text-sm text-[var(--viz-muted)]">No training status from Garmin yet. The watch needs about a week of activities with heart rate.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <div className="text-[11px] font-medium text-[var(--viz-muted)]">Status</div>
              <div className="flex items-center gap-2 text-xl font-semibold text-[var(--viz-ink)]">
                {label && <span className="h-2.5 w-2.5 rounded-full" style={{ background: TONE[label.tone] }} aria-hidden />}
                {label?.label ?? '-'}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-[var(--viz-muted)]">Acute load (7 days)</div>
              <div className="text-xl font-semibold tabular-nums text-[var(--viz-ink)]">{r0(acute)}</div>
              {st?.tunnelMin != null && st.tunnelMax != null && <div className="text-[11px] text-[var(--viz-ink-2)]">optimal {r0(st.tunnelMin)}–{r0(st.tunnelMax)}</div>}
            </div>
            <div>
              <div className="text-[11px] font-medium text-[var(--viz-muted)]">Chronic load (4 weeks)</div>
              <div className="text-xl font-semibold tabular-nums text-[var(--viz-ink)]">{r0(chronic)}</div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-[var(--viz-muted)]">Load ratio</div>
              <div className="text-xl font-semibold tabular-nums text-[var(--viz-ink)]">{ratio === null ? '-' : ratio.toFixed(1)}</div>
              {ratio !== null && <div className="text-[11px] text-[var(--viz-ink-2)]">{st?.ratioStatus ?? ratioLabel(ratio)}</div>}
            </div>
          </div>
          {ratio !== null && <RatioBar ratio={ratio} />}
          {focus.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-[var(--viz-ink)]">Load focus, last 4 weeks</h3>
                <span className="text-xs text-[var(--viz-muted)]">{st?.focusFeedback ?? (focus.some((f) => f.min !== null) ? 'Gray boxes: Garmin targets' : 'No targets from Garmin')}</span>
              </div>
              {focus.map((f) => <FocusBar key={f.key} label={f.label} value={f.value} min={f.min} max={f.max} scale={scale} />)}
            </div>
          )}
        </>
      )}
    </section>
  );
}
