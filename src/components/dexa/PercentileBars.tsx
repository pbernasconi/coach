import { HelpTooltip } from '@kobo/web';
import { Info } from 'lucide-react';
import type { FullScan } from '@/lib/vitals/dexa.mjs';

const ordinal = (p: number) => `${p}${p % 100 >= 11 && p % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][p % 10] ?? 'th')}`;

/**
 * Each BodySpec percentile on a 0–100 track against peers of the same sex and age. The marker is the value; the
 * words say which way is good, so colour is not the only signal.
 */
export default function PercentileBars({ p }: { p: FullScan['percentiles'] }) {
  if (!p.metrics.length) return <p className="text-sm text-[var(--viz-muted)]">No percentiles for this scan.</p>;
  const group = [p.gender ? `${p.gender[0].toUpperCase()}${p.gender.slice(1)}s` : 'People', p.minAge !== null && p.maxAge !== null ? `${p.minAge}–${p.maxAge}` : null].filter(Boolean).join(' ');
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs text-[var(--viz-muted)]">
        vs {group}
        <HelpTooltip label="About percentiles" icon={<Info aria-hidden />}>
          BodySpec ranks each value against its own scans of people of your sex and age{p.datasetSize ? ` (about ${p.datasetSize.toLocaleString('en-US')} scans)` : ''}. 50 is the middle.
        </HelpTooltip>
      </div>
      <ul className="space-y-3">
        {p.metrics.map((m) => {
          const good = m.better === null ? null : m.better === 'down' ? m.percentile <= 50 : m.percentile >= 50;
          const words = m.better === 'down' ? `leaner than ${100 - m.percentile}%` : m.better === 'up' ? `higher than ${m.percentile}%` : `${ordinal(m.percentile)} percentile`;
          return (
            <li key={m.key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-[var(--viz-ink-2)]">{m.label}</span>
                <span className="tabular-nums text-[var(--viz-ink)]">
                  {m.value.toFixed(m.digits)}
                  {m.unit && <span className="text-xs text-[var(--viz-muted)]"> {m.unit}</span>}
                  <span className="ml-2 text-xs" style={{ color: good === null ? 'var(--viz-muted)' : good ? 'var(--viz-good)' : 'var(--viz-ink-2)' }}>
                    {ordinal(m.percentile)} · {words}
                  </span>
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-[var(--viz-grid)]" aria-hidden>
                <div className="absolute inset-y-0 left-1/2 w-px bg-[var(--viz-axis)]" />
                <div className="absolute -top-[3px] h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-[var(--viz-surface)] bg-[var(--viz-ink)]" style={{ left: `${Math.max(1, Math.min(99, m.percentile))}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
