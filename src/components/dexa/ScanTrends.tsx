import Link from 'next/link';
import type { DexaTrends } from '@/lib/vitals/dexa-store';
import Delta from './Delta';

type Measure = DexaTrends['measures'][number];

const monthYear = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });

/** One measure across scans: a line with a dot per scan (a link to the scan), the latest dot filled. */
function Chart({ m, highlight }: { m: Measure; highlight?: string }) {
  const pts = m.series.filter((p): p is { date: string; resultId: string; value: number } => p.value !== null);
  const W = 300;
  const H = 100;
  const L = 6;
  const R = 6;
  const T = 14;
  const B = 18;
  if (pts.length < 2) return <div className="h-[100px]" />;
  const t = (d: string) => Date.parse(`${d}T00:00:00Z`);
  const t0 = t(pts[0].date);
  const t1 = t(pts[pts.length - 1].date);
  const vs = pts.map((p) => p.value);
  let lo = Math.min(...vs);
  let hi = Math.max(...vs);
  const pad = (hi - lo || Math.abs(hi) * 0.05 || 1) * 0.15;
  lo -= pad;
  hi += pad;
  const x = (d: string) => L + ((t(d) - t0) / (t1 - t0 || 1)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const line = pts.map((p) => `${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  // Value labels, newest first, leaving out one that would touch the label after it.
  const labelled = new Set<number>();
  let lastX = Infinity;
  for (let i = pts.length - 1; i >= 0; i--) {
    const px = x(pts[i].date);
    if (lastX - px >= 26) {
      labelled.add(i);
      lastX = px;
    }
  }
  const area = `${x(pts[0].date)},${H - B} ${line} ${x(pts[pts.length - 1].date)},${H - B}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${m.label} by scan: ${pts.map((p) => `${p.date} ${p.value.toFixed(m.digits)}`).join(', ')}`}>
      <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="var(--viz-grid)" />
      <polygon points={area} fill="var(--viz-ink)" fillOpacity="0.04" />
      <polyline points={line} fill="none" stroke="var(--viz-ink-2)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => {
        const last = i === pts.length - 1;
        const on = highlight ? p.resultId === highlight : last;
        return (
          <Link key={p.resultId} href={`/health/dexa/${p.date}`} aria-label={`${p.date}: ${p.value.toFixed(m.digits)}`}>
            <circle cx={x(p.date)} cy={y(p.value)} r="9" fill="transparent" />
            {labelled.has(i) && (
              <text
                x={Math.min(W - R - 2, Math.max(L + 2, x(p.date)))}
                y={y(p.value) - 6 < T ? y(p.value) + 13 : y(p.value) - 6}
                textAnchor={i === 0 ? 'start' : last ? 'end' : 'middle'}
                className="fill-[var(--viz-ink-2)] text-[9px] tabular-nums"
              >
                {p.value.toFixed(m.digits)}
              </text>
            )}
            <circle cx={x(p.date)} cy={y(p.value)} r={on ? 3.75 : 2.75} fill={on ? 'var(--viz-ink)' : 'var(--viz-surface)'} stroke="var(--viz-ink-2)" strokeWidth="1.25">
              <title>{`${p.date}: ${p.value.toFixed(m.digits)}${m.unit ? ` ${m.unit}` : ''}`}</title>
            </circle>
          </Link>
        );
      })}
      <text x={L} y={H - 4} className="fill-[var(--viz-muted)] text-[10px]">{monthYear(pts[0].date)}</text>
      <text x={W - R} y={H - 4} textAnchor="end" className="fill-[var(--viz-muted)] text-[10px]">{monthYear(pts[pts.length - 1].date)}</text>
    </svg>
  );
}

/** Small multiples of every measure across scans, with the latest value and its change since the first scan. */
export default function ScanTrends({ measures, firstDate, highlight }: { measures: Measure[]; firstDate: string | null; highlight?: string }) {
  const shown = measures.filter((m) => m.series.filter((p) => p.value !== null).length >= 2);
  return (
    <ul className="grid gap-px overflow-hidden rounded-lg border bg-[var(--viz-grid)] sm:grid-cols-2 lg:grid-cols-3">
      {shown.map((m) => (
        <li key={m.key} className="space-y-1 bg-[var(--viz-surface)] px-4 pb-2 pt-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm text-[var(--viz-ink-2)]">{m.label}</span>
            <span className="text-base font-semibold tabular-nums text-[var(--viz-ink)]">
              {m.value === null ? '–' : m.value.toFixed(m.digits)}
              {m.unit && <span className="ml-1 text-xs font-normal text-[var(--viz-muted)]">{m.unit}</span>}
            </span>
          </div>
          <div className="flex justify-end text-xs">
            <Delta value={m.sinceFirst ?? m.sincePrevious} digits={m.digits} unit={m.unit} better={m.better} label={firstDate && m.sinceFirst !== null ? `since ${monthYear(firstDate)}` : 'since last'} />
          </div>
          <Chart m={m} highlight={highlight} />
        </li>
      ))}
    </ul>
  );
}
