import { HelpTooltip } from '@kobo/web';
import { Info } from 'lucide-react';
import type { FullScan } from '@/lib/vitals/dexa.mjs';

/** Bone density per site with BodySpec's age-matched (Z) and young-adult (T) percentiles. */
export default function BoneTable({ bone }: { bone: FullScan['bone'] }) {
  const rows = [...(bone.total ? [bone.total] : []), ...bone.sites];
  if (!rows.length) return <p className="text-sm text-[var(--viz-muted)]">No bone density for this scan.</p>;
  const hasPct = rows.some((b) => b.zPercentile !== null || b.tPercentile !== null);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b text-left text-xs text-[var(--viz-muted)]">
            <th className="py-2 pr-3 font-medium">Site</th>
            <th className="px-3 py-2 text-right font-medium">g/cm²</th>
            {hasPct && (
              <th className="py-2 pl-3 text-right font-medium">
                <span className="inline-flex items-center gap-1">
                  Age · Peak pct
                  <HelpTooltip label="About bone percentiles" icon={<Info aria-hidden />}>
                    Age: against people of your sex and age (the Z-score as a percentile). Peak: against 30-year-olds of
                    your sex (the T-score as a percentile).
                  </HelpTooltip>
                </span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.key} className={b.key === 'total' ? 'border-b font-medium' : 'border-b border-[var(--viz-grid)] last:border-0'}>
              <td className="py-1.5 pr-3 text-[var(--viz-ink)]">{b.label}</td>
              <td className="px-3 py-1.5 text-right text-[var(--viz-ink)]">{b.bmd === null ? '–' : b.bmd.toFixed(3)}</td>
              {hasPct && (
                <td className="py-1.5 pl-3 text-right text-[var(--viz-ink-2)]">
                  {b.zPercentile === null && b.tPercentile === null ? '' : `${b.zPercentile ?? '–'} · ${b.tPercentile ?? '–'}`}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
