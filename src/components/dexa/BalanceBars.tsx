import { HelpTooltip } from '@kobo/web';
import { Info } from 'lucide-react';
import type { FullScan } from '@/lib/vitals/dexa.mjs';

/** Right against left lean mass for arms and legs: two bars from the middle, and the difference in %. */
export default function BalanceBars({ scan }: { scan: FullScan }) {
  const r = Object.fromEntries(scan.regions.map((x) => [x.key, x]));
  const pairs = [
    { label: 'Arms', right: r.right_arm?.leanKg ?? null, left: r.left_arm?.leanKg ?? null, pct: scan.derived.armLeanBalancePct },
    { label: 'Legs', right: r.right_leg?.leanKg ?? null, left: r.left_leg?.leanKg ?? null, pct: scan.derived.legLeanBalancePct },
  ].filter((p) => p.right !== null && p.left !== null) as { label: string; right: number; left: number; pct: number | null }[];
  if (!pairs.length) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs text-[var(--viz-muted)]">
        Lean mass, right vs left
        <HelpTooltip label="About balance" icon={<Info aria-hidden />}>
          The difference between your right and left side as a share of their average. Under about 5% is common; the
          dominant side is usually a little bigger.
        </HelpTooltip>
      </div>
      {pairs.map((p) => {
        const max = Math.max(p.right, p.left);
        return (
          <div key={p.label} className="space-y-1">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-[var(--viz-ink-2)]">{p.label}</span>
              <span className="text-xs tabular-nums text-[var(--viz-ink-2)]">
                {p.pct === null ? '' : Math.abs(p.pct) < 0.05 ? 'even' : `${Math.abs(p.pct).toFixed(1)}% ${p.pct > 0 ? 'right' : 'left'} heavier`}
              </span>
            </div>
            <div className="grid grid-cols-[2.5rem_1fr_1fr_2.5rem] items-center gap-1 text-xs tabular-nums">
              <span className="text-[var(--viz-ink)]">{p.right.toFixed(2)}</span>
              <span className="flex justify-end"><span className="h-3 rounded-l bg-[var(--dexa-lean)]" style={{ width: `${(p.right / max) * 100}%` }} /></span>
              <span className="flex"><span className="h-3 rounded-r bg-[var(--dexa-lean)] opacity-60" style={{ width: `${(p.left / max) * 100}%` }} /></span>
              <span className="text-right text-[var(--viz-ink)]">{p.left.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[10px] text-[var(--viz-muted)]"><span>R kg</span><span>L kg</span></div>
          </div>
        );
      })}
    </div>
  );
}
