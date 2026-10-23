import { HelpTooltip } from '@kobo/web';
import { Info } from 'lucide-react';
import type { Board } from '@/lib/vitals/garmin-pages';
import type { Readiness } from '@/lib/vitals/queries';
import { outliersText, verdictOf, vitalCells, type rangeBar } from '@/lib/vitals/health-view.mjs';

const VERDICT_COLOR = {
  good: 'var(--viz-good)',
  ok: 'var(--color-amber-500)',
  low: 'var(--viz-down)',
  unknown: 'var(--viz-muted)',
} as const;

/** Where the value sits against its normal range: a short track, the range shaded, the value as a tick. */
function RangeBar({ range, off }: { range: ReturnType<typeof rangeBar>; off: boolean }) {
  if (!range) return <div className="mt-1.5 h-1.5" />;
  const { low, high, min: lo, max: hi } = range;
  const pct = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  return (
    <div className="relative mt-1.5 h-1.5 rounded-full bg-[var(--viz-grid)]" aria-hidden>
      <div className="absolute inset-y-0 rounded-full bg-[var(--viz-axis)]" style={{ left: pct(low), width: `calc(${pct(high)} - ${pct(low)})` }} />
      <div
        className="absolute -top-[3px] h-3 w-[3px] -translate-x-1/2 rounded-full"
        style={{ left: pct(range.value), background: off ? 'var(--viz-down)' : 'var(--viz-ink)' }}
      />
    </div>
  );
}

/**
 * The top of /health: the readiness verdict and one compact row of the latest values, each against its normal range
 * (mean ± 1 SD of the 60 days before it). Colour only marks a value outside that range. The text and the maths are
 * in health-view.mjs, which GET /api/app/health also uses.
 */
export default function VitalsSummary({ r, b }: { r: Readiness; b: Board }) {
  const v = verdictOf(r.status);
  const cells = vitalCells(b);

  return (
    <section className="rounded-lg border bg-[var(--viz-surface)]" data-smoke="health-vitals">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2.5">
        <span className="inline-flex items-center gap-2 font-semibold text-[var(--viz-ink)]">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: VERDICT_COLOR[r.status] }} />
          {v.label}
          <HelpTooltip label="About readiness" icon={<Info aria-hidden />}>
            {v.text} Each value below is compared with your own normal range: the middle of your last 60 days.
          </HelpTooltip>
        </span>
        <span className="text-sm text-[var(--viz-ink-2)]">{outliersText(cells)}</span>
        {r.flags.length > 0 && <span className="text-sm text-[var(--viz-muted)]">· {r.flags.join(' · ')}</span>}
      </div>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-b-lg bg-[var(--viz-grid)] sm:grid-cols-4 xl:grid-cols-8">
        {cells.map((c) => (
          <div key={c.key} className="min-w-0 bg-[var(--viz-surface)] px-4 py-3">
            <dt className="truncate text-xs text-[var(--viz-muted)]">{c.label}</dt>
            <dd>
              <span className={`text-xl font-semibold tabular-nums tracking-tight ${c.hasValue ? (c.isOff ? 'text-[var(--viz-down)]' : 'text-[var(--viz-ink)]') : 'text-[var(--viz-muted)]'}`}>
                {c.valueText}
              </span>
              {c.hasValue && c.unit && <span className="ml-1 text-xs text-[var(--viz-muted)]">{c.unit}</span>}
              <RangeBar range={c.range} off={c.isOff} />
              <div className="mt-1 truncate text-[11px] tabular-nums text-[var(--viz-muted)]">
                {c.footText}
                {c.staleText && <span className="ml-1 text-[var(--color-amber-600)]">· {c.staleText}</span>}
              </div>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
