import { rampLevel } from '@/lib/performance/pmc.mjs';
import type { RampRate } from '@/lib/performance/projection';

const LABEL: Record<number, string> = { 7: '7 days', 28: '28 days', 90: '90 days', 365: '1 year' };
const LEVEL: Record<string, string> = { high: 'High', aggressive: 'Aggressive', steady: 'Steady', falling: 'Falling' };
const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}`;

/**
 * Ramp rates: the change in fitness (CTL) over 7, 28, 90 and 365 days, and the same as CTL per week.
 * Over 8 per week is a high injury risk; 5–8 is aggressive. The level is a word next to the number, never color alone.
 */
export default function RampRates({ ramp }: { ramp: RampRate[] }) {
  return (
    <div className="rounded-lg border bg-[var(--viz-surface)] p-4">
      <div className="text-xs font-medium text-[var(--viz-muted)]">Ramp rate · fitness change</div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {ramp.map((r, k) => {
          const days = r?.days ?? [7, 28, 90, 365][k];
          const level = r ? rampLevel(r.perWeek) : null;
          const warn = level === 'high' || level === 'aggressive';
          return (
            <div key={days}>
              <dt className="text-xs text-[var(--viz-muted)]">{LABEL[days] ?? `${days} days`}</dt>
              <dd className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-[var(--viz-ink)]">{r ? signed(r.change) : '–'}</dd>
              <dd className="text-xs tabular-nums text-[var(--viz-ink-2)]">
                {r ? (
                  <>
                    {signed(r.perWeek)}/wk ·{' '}
                    <span className={warn ? 'font-medium text-[var(--viz-down)]' : undefined}>
                      {warn && <span aria-hidden>▲ </span>}
                      {LEVEL[level!]}
                    </span>
                  </>
                ) : (
                  'Not enough data'
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="mt-3 text-[11px] text-[var(--viz-muted)]">CTL points. Over +8 a week is a high injury risk; +5 to +8 is aggressive.</p>
    </div>
  );
}
