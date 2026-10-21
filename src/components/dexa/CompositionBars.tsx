import Link from 'next/link';
import type { FullScan } from '@/lib/vitals/dexa.mjs';

const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const PARTS = [
  { key: 'fatKg', label: 'Fat', color: 'var(--dexa-fat)' },
  { key: 'leanKg', label: 'Lean', color: 'var(--dexa-lean)' },
  { key: 'boneKg', label: 'Bone', color: 'var(--dexa-bone)' },
] as const;

/** Each scan's weight split into fat, lean and bone, on one shared kg scale, newest first. Rows link to the scan. */
export default function CompositionBars({ scans }: { scans: FullScan[] }) {
  const rows = [...scans].reverse().filter((s) => s.totals.fatKg !== null && s.totals.leanKg !== null);
  const max = Math.max(...rows.map((s) => (s.totals.fatKg ?? 0) + (s.totals.leanKg ?? 0) + (s.totals.boneKg ?? 0)), 1);
  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--viz-ink-2)]" aria-label="Legend">
        {PARTS.map((p) => (
          <li key={p.key} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} aria-hidden />
            {p.label}
          </li>
        ))}
      </ul>
      <ul className="space-y-1.5">
        {rows.map((s) => {
          const total = (s.totals.fatKg ?? 0) + (s.totals.leanKg ?? 0) + (s.totals.boneKg ?? 0);
          return (
            <li key={s.resultId}>
              <Link href={`/health/dexa/${s.scanDate}`} className="grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-3 rounded-md px-1 py-0.5 text-sm hover:bg-[var(--viz-band)] sm:grid-cols-[7rem_1fr_4.5rem]">
                <span className="whitespace-nowrap text-xs text-[var(--viz-ink-2)] sm:text-sm">{fmtDate(s.scanDate)}</span>
                <span className="flex h-5 overflow-hidden rounded" style={{ width: `${(total / max) * 100}%` }} aria-label={PARTS.map((p) => `${p.label} ${(s.totals[p.key] ?? 0).toFixed(1)} kg`).join(', ')}>
                  {PARTS.map((p) => {
                    const v = s.totals[p.key] ?? 0;
                    return (
                      <span key={p.key} className="flex items-center justify-center overflow-hidden text-[10px] font-medium text-white tabular-nums" style={{ width: `${(v / total) * 100}%`, background: p.color }}>
                        {p.key !== 'boneKg' && v / max > 0.08 ? v.toFixed(1) : ''}
                      </span>
                    );
                  })}
                </span>
                <span className="text-right text-xs tabular-nums text-[var(--viz-ink)] sm:text-sm">{total.toFixed(1)} kg</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
