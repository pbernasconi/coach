'use client';

import { HelpTooltip } from '@kobo/web';
import { Info } from 'lucide-react';
import Link from 'next/link';

export type Coverage = 'worn' | 'partial' | 'off' | 'pending';

export const COVERAGE_LABEL: Record<Coverage, string> = { worn: 'Worn', partial: 'Partly worn', off: 'Not worn', pending: 'Not synced yet' };

const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

function Cell({ c }: { c: Coverage }) {
  if (c === 'worn') return <span className="block h-full w-full rounded-[2px] bg-[var(--viz-good)] opacity-70" />;
  if (c === 'partial') return <span className="block h-full w-full rounded-[2px] bg-[var(--viz-good)] opacity-30" />;
  if (c === 'off')
    return <span className="block h-full w-full rounded-[2px] border border-[var(--viz-axis)] bg-[repeating-linear-gradient(45deg,var(--viz-axis)_0_1px,transparent_1px_4px)]" />;
  return <span className="block h-full w-full rounded-[2px] border border-dashed border-[var(--viz-axis)]" />;
}

/** One cell per day: was the watch worn? Hovering a cell reads the same day on every chart. */
export default function CoverageStrip({
  days, coverage, counts, hover, onHover,
}: {
  days: string[];
  coverage: Record<string, Coverage>;
  counts: Record<Coverage, number>;
  hover: number | null;
  onHover: (i: number | null) => void;
}) {
  const h = hover === null ? null : days[hover];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5" data-smoke="health-coverage">
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--viz-ink-2)]">
        Watch
        <HelpTooltip label="About watch coverage" icon={<Info aria-hidden />}>
          Days the Garmin recorded heart rate. Hatched days had nothing from the watch; they show as gaps in every chart.
        </HelpTooltip>
      </span>
      <div className="flex min-w-[180px] flex-1 gap-px" role="list" aria-label={`Watch worn ${counts.worn + counts.partial} of ${days.length} days`} onPointerLeave={() => onHover(null)}>
        {days.map((d, i) => (
          <Link
            key={d}
            role="listitem"
            href={`/health/day/${d}`}
            aria-label={`${fmtDay(d)}: ${COVERAGE_LABEL[coverage[d]]}`}
            title={`${fmtDay(d)}: ${COVERAGE_LABEL[coverage[d]]}`}
            onPointerEnter={() => onHover(i)}
            className={`h-3 min-w-0 flex-1 ${hover === i ? 'outline outline-1 outline-[var(--viz-ink-2)]' : ''}`}
          >
            <Cell c={coverage[d]} />
          </Link>
        ))}
      </div>
      <span className="text-xs tabular-nums text-[var(--viz-muted)]">
        {h ? (
          <>{fmtDay(h)} · <span className="text-[var(--viz-ink)]">{COVERAGE_LABEL[coverage[h]]}</span></>
        ) : (
          <>
            <span className="text-[var(--viz-ink)]">{counts.worn + counts.partial}</span>/{days.length} days
            {counts.off > 0 && <> · <span className="text-[var(--viz-ink)]">{counts.off}</span> not worn</>}
            {counts.pending > 0 && <> · {counts.pending} not synced</>}
          </>
        )}
      </span>
    </div>
  );
}
