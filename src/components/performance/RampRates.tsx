import { Info } from 'lucide-react';
import { HelpTooltip } from '@kobo/web';
import { RAMP_NOTE, rampCell } from '@/lib/performance/display.mjs';
import type { RampRate } from '@/lib/performance/projection';

/**
 * Ramp rates: the change in fitness (CTL) over 7, 28, 90 and 365 days, and the same as CTL per week.
 * Over 8 per week is a high injury risk; 5–8 is aggressive. The level is a word next to the number, never color alone.
 */
export default function RampRates({ ramp }: { ramp: RampRate[] }) {
  return (
    <div className="rounded-lg border bg-[var(--viz-surface)] p-4">
      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--viz-muted)]">
        Ramp rate · fitness change
        <HelpTooltip label="About ramp rate" icon={<Info aria-hidden />}>{RAMP_NOTE}</HelpTooltip>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {ramp.map((r, k) => {
          const c = rampCell(r, k);
          return (
            <div key={c.days}>
              <dt className="text-xs text-[var(--viz-muted)]">{c.label}</dt>
              <dd className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-[var(--viz-ink)]">{c.changeText}</dd>
              <dd className="text-xs tabular-nums text-[var(--viz-ink-2)]">
                {c.perWeekText ? (
                  <>
                    {c.perWeekText} ·{' '}
                    <span className={c.warn ? 'font-medium text-[var(--viz-down)]' : undefined}>
                      {c.warn && <span aria-hidden>▲ </span>}
                      {c.levelText}
                    </span>
                  </>
                ) : (
                  c.levelText
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
