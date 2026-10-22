import type { DexaTrends } from '@/lib/vitals/dexa-store';
import Delta from './Delta';
import { monthYY } from './Zones';

type Measure = DexaTrends['measures'][number];

/** A sparkline of one measure; the latest point filled. */
function Spark({ m }: { m: Measure }) {
  const pts = m.series.filter((p): p is { date: string; resultId: string; value: number } => p.value !== null);
  if (pts.length < 2) return <span className="w-[104px]" />;
  const W = 104;
  const H = 30;
  const vs = pts.map((p) => p.value);
  const lo = Math.min(...vs);
  const span = Math.max(...vs) - lo || 1;
  const t = (d: string) => Date.parse(`${d}T00:00:00Z`);
  const t0 = t(pts[0].date);
  const tn = t(pts[pts.length - 1].date) - t0 || 1;
  const xy = pts.map((p) => [4 + ((t(p.date) - t0) / tn) * (W - 8), 26 - ((p.value - lo) / span) * 22] as const);
  const sinceFirst = vs[vs.length - 1] - vs[0];
  const good = m.better === null || Math.abs(sinceFirst) < 10 ** -m.digits ? null : (sinceFirst < 0) === (m.better === 'down');
  const color = good === null ? 'var(--viz-ink-2)' : good ? 'var(--viz-up)' : 'var(--viz-down)';
  const [lx, ly] = xy[xy.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden className="shrink-0">
      <polyline points={xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="3" fill={color} />
    </svg>
  );
}

/** The measures the training plan aims at, each with its value now, a sparkline and its change since the first scan. */
export default function FocusList({ measures, firstDate }: { measures: Measure[]; firstDate: string | null }) {
  return (
    <ul className="divide-y divide-[var(--viz-grid)]">
      {measures.map((m) => (
        <li key={m.key} className="flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium text-[var(--viz-ink)]">{m.label}</p>
            <p className="text-xs tabular-nums text-[var(--viz-muted)]">
              {m.value === null ? '–' : `${m.value.toFixed(m.digits)}${m.unit === '%' ? '%' : ` ${m.unit}`} now`}
            </p>
          </div>
          <Spark m={m} />
          <div className="w-24 text-right text-sm font-semibold">
            <Delta value={m.sinceFirst ?? m.sincePrevious} digits={m.digits} unit={m.unit} better={m.better} />
            <p className="text-[11px] font-normal text-[var(--viz-muted)]">{firstDate && m.sinceFirst !== null ? `since ${monthYY(firstDate)}` : 'since last'}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
