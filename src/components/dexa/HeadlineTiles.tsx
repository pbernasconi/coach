import { TREND_MEASURES, shownDiff, type FullScan } from '@/lib/vitals/dexa.mjs';
import Delta from './Delta';

const KEYS = ['fatPct', 'vatKg', 'leanKg', 'armsLeanKg', 'almi', 'totalKg'];
// "Apr '25", as on the DEXA progress page ("Apr 25" read as a day).
const monthYear = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }).replace(' ', " '");

/** The headline measures of one scan, each with its change since the scan before and since the first scan. */
export default function HeadlineTiles({ scan, previous, first }: { scan: FullScan; previous: FullScan | null; first: FullScan | null }) {
  const tiles = TREND_MEASURES.filter((m) => KEYS.includes(m.key)).map((m) => {
    const value = m.get(scan);
    const diff = (other: FullScan | null) => {
      if (!other || other === scan) return null;
      const then = m.get(other);
      // From the shown values, so "21.8 → 22.2" reads 0.4.
      return shownDiff(value, then, m.digits);
    };
    const before = previous && previous !== scan ? m.get(previous) : null;
    return { ...m, value, before, sincePrevious: diff(previous), sinceFirst: first !== previous ? diff(first) : null };
  });
  return (
    <ul className="grid grid-cols-2 gap-px self-start overflow-hidden rounded-lg border bg-[var(--viz-grid)] sm:grid-cols-3 lg:grid-cols-2">
      {tiles.map((m) => (
        <li key={m.key} className="space-y-1 bg-[var(--viz-surface)] p-3">
          <div className="text-xs text-[var(--viz-muted)]">{m.label}</div>
          <div className="flex items-baseline gap-1.5 text-2xl font-semibold tabular-nums text-[var(--viz-ink)]">
            {m.before !== null && (
              <span className="text-sm font-normal text-[var(--viz-muted)]" title={previous ? `${previous.scanDate}` : undefined}>
                {m.before.toFixed(m.digits)} →
              </span>
            )}
            {m.value === null ? '–' : m.value.toFixed(m.digits)}
            {m.unit && <span className="text-sm font-normal text-[var(--viz-muted)]">{m.unit}</span>}
          </div>
          <div className="flex flex-col text-xs">
            <Delta value={m.sincePrevious} digits={m.digits} unit={m.unit} better={m.better} label={previous ? `vs ${monthYear(previous.scanDate)}` : undefined} />
            <Delta value={m.sinceFirst} digits={m.digits} unit={m.unit} better={m.better} label={first ? `vs ${monthYear(first.scanDate)}` : undefined} />
          </div>
        </li>
      ))}
    </ul>
  );
}
