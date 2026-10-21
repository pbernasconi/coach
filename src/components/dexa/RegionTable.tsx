import type { FullScan } from '@/lib/vitals/dexa.mjs';
import Delta from './Delta';

const f = (v: number | null, d: number) => (v === null ? '–' : v.toFixed(d));

/** Fat, lean, bone and fat % per region, with the change of fat and lean since `previous` when given. */
export default function RegionTable({ scan, previous }: { scan: FullScan; previous: FullScan | null }) {
  const before = Object.fromEntries((previous?.regions ?? []).map((r) => [r.key, r]));
  const rows = [...scan.regions, { key: 'total', label: 'Total', side: null, limb: null, ...scan.totals }];
  const prevTotal = previous ? { ...previous.totals } : null;
  const prevOf = (key: string) => (key === 'total' ? prevTotal : before[key] ?? null);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm tabular-nums">
        <thead>
          <tr className="border-b text-left text-xs text-[var(--viz-muted)]">
            <th className="py-2 pr-3 font-medium">Region</th>
            <th className="px-3 py-2 text-right font-medium">Fat %</th>
            <th className="px-3 py-2 text-right font-medium">Fat kg</th>
            <th className="px-3 py-2 text-right font-medium">Lean kg</th>
            <th className="px-3 py-2 text-right font-medium">Bone kg</th>
            {previous && <th className="py-2 pl-3 text-right font-medium">Fat · Lean change</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const p = prevOf(r.key);
            return (
              <tr key={r.key} className={r.key === 'total' ? 'border-t font-medium' : 'border-b border-[var(--viz-grid)] last:border-0'}>
                <td className="whitespace-nowrap py-1.5 pr-3 text-[var(--viz-ink)]">{r.label}</td>
                <td className="px-3 py-1.5 text-right text-[var(--viz-ink)]">{f(r.fatPct, 1)}</td>
                <td className="px-3 py-1.5 text-right text-[var(--viz-ink)]">{f(r.fatKg, 2)}</td>
                <td className="px-3 py-1.5 text-right text-[var(--viz-ink)]">{f(r.leanKg, 2)}</td>
                <td className="px-3 py-1.5 text-right text-[var(--viz-ink-2)]">{f(r.boneKg, 2)}</td>
                {previous && (
                  <td className="whitespace-nowrap py-1.5 pl-3 text-right text-xs">
                    {p ? (
                      <span className="inline-flex gap-3">
                        <Delta value={r.fatKg !== null && p.fatKg !== null ? r.fatKg - p.fatKg : null} digits={2} unit="" better="down" />
                        <Delta value={r.leanKg !== null && p.leanKg !== null ? r.leanKg - p.leanKg : null} digits={2} unit="" better="up" />
                      </span>
                    ) : (
                      '–'
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
