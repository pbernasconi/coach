import type { Point } from './BandChart';
import { monthYY } from './Zones';

type Series = { label: string; color: string; points: Point[]; better: 'up' | 'down' };

const signed = (v: number, d: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(d)}`;

/** One panel: the series on its own scale, its latest value and its change since the first scan on the right. */
function Panel({ s, width, top, height, x }: { s: Series; width: number; top: number; height: number; x: (d: string) => number }) {
  const vs = s.points.map((p) => p.value);
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const span = hi - lo || 1;
  const y = (v: number) => top + 20 + (1 - (v - lo) / span) * (height - 30);
  const last = s.points.at(-1)!;
  const change = last.value - s.points[0].value;
  const good = (change < 0) === (s.better === 'down');
  return (
    <g>
      <text x={0} y={top + 12} className="text-[12px] font-medium" fill={s.color}>{s.label}</text>
      <text x={width} y={top + 12} textAnchor="end" className="text-[12px] tabular-nums">
        <tspan className="fill-[var(--viz-ink)] font-semibold">{last.value.toFixed(1)} kg</tspan>
        <tspan dx="6" fill={good ? 'var(--viz-up)' : 'var(--viz-down)'}>{signed(change, 1)}</tspan>
      </text>
      <polyline points={s.points.map((p) => `${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')} fill="none" stroke={s.color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
      {s.points.map((p, i) => (
        <circle key={p.resultId} cx={x(p.date)} cy={y(p.value)} r={i === s.points.length - 1 ? 4 : 2.75} fill={i === s.points.length - 1 ? s.color : 'var(--viz-surface)'} stroke={s.color} strokeWidth="1.5">
          <title>{`${p.date}: ${p.value.toFixed(1)} kg`}</title>
        </circle>
      ))}
    </g>
  );
}

/**
 * Fat mass over lean mass across scans, each on its own scale so both changes show: "losing fat, keeping muscle"
 * at a glance. The kilograms and the change since the first scan are written on each panel.
 */
export default function MassTrend({ fat, lean, width = 480 }: { fat: Point[]; lean: Point[]; width?: number }) {
  if (fat.length < 2 || lean.length < 2) return null;
  const panel = 104;
  const H = panel * 2 + 22;
  const t = (d: string) => Date.parse(`${d}T00:00:00Z`);
  const t0 = t(fat[0].date);
  const t1 = t(fat[fat.length - 1].date);
  const x = (d: string) => 6 + ((t(d) - t0) / (t1 - t0 || 1)) * (width - 12);
  return (
    <svg viewBox={`0 0 ${width} ${H}`} className="h-auto w-full" role="img" aria-label={`Fat mass ${fat[0].value.toFixed(1)} to ${fat.at(-1)!.value.toFixed(1)} kg, lean mass ${lean[0].value.toFixed(1)} to ${lean.at(-1)!.value.toFixed(1)} kg`}>
      <Panel s={{ label: 'Lean mass', color: 'var(--dexa-lean)', points: lean, better: 'up' }} width={width} top={0} height={panel} x={x} />
      <line x1={0} x2={width} y1={panel + 2} y2={panel + 2} stroke="var(--viz-grid)" />
      <Panel s={{ label: 'Fat mass', color: 'var(--dexa-fat)', points: fat, better: 'down' }} width={width} top={panel + 8} height={panel} x={x} />
      <text x={6} y={H - 4} className="fill-[var(--viz-muted)] text-[11px]">{monthYY(fat[0].date)}</text>
      <text x={width - 6} y={H - 4} textAnchor="end" className="fill-[var(--viz-muted)] text-[11px]">{monthYY(fat[fat.length - 1].date)}</text>
    </svg>
  );
}
