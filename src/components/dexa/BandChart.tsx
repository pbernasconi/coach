import Link from 'next/link';
import type { HealthRange } from '@/lib/vitals/dexa-health.mjs';
import { ZONE_FILL, ZONE_INK, monthYY } from './Zones';

export type Point = { date: string; resultId: string; value: number };

/** A round step for about `n` gridlines over a span. */
function niceStep(span: number, n = 4) {
  const raw = span / n;
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? p * 10;
}

/**
 * A measure across scans over its healthy-range zones: the zones as bands named on the right, a line with a dot per
 * scan (each a link to the scan), and value labels that skip a neighbour they would touch. Drawn at a fixed width in
 * SVG units, so the page renders one per breakpoint and text stays the same size.
 */
export default function BandChart({ points, range, width, height, unit, digits, label }: { points: Point[]; range: HealthRange | null; width: number; height: number; unit: string; digits: number; label: string }) {
  if (points.length < 1) return null;
  const L = 34;
  const R = range ? 70 : 12;
  const T = 24;
  const B = 26;
  const vs = points.map((p) => p.value);
  let lo = Math.min(...vs);
  let hi = Math.max(...vs);
  const pad = Math.max((hi - lo) * 0.25, Math.abs(hi) * 0.04, 10 ** -digits);
  lo -= pad;
  hi += pad;
  // Keep the edge of the healthy zone in view when the values sit just outside it.
  const good = range?.zones.filter((z) => z.tone === 'good') ?? [];
  if (good.length) {
    const gLo = Math.min(...good.map((z) => z.from));
    const gHi = Math.max(...good.map((z) => z.to));
    if (lo > gHi && lo - gHi < (hi - lo) * 1.5) lo = gHi - (hi - lo) * 0.2;
    if (hi < gLo && gLo - hi < (hi - lo) * 1.5) hi = gLo + (hi - lo) * 0.2;
  }
  const t = (d: string) => Date.parse(`${d}T00:00:00Z`);
  const t0 = t(points[0].date);
  const t1 = t(points[points.length - 1].date);
  const x = (d: string) => (t1 === t0 ? (L + width - R) / 2 : L + 10 + ((t(d) - t0) / (t1 - t0)) * (width - L - R - 30));
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (height - T - B);
  const step = niceStep(hi - lo);
  const grid: number[] = [];
  for (let g = Math.ceil(lo / step) * step; g <= hi; g += step) grid.push(+g.toFixed(6));
  const line = points.map((p) => `${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');

  const labelled = new Set<number>();
  let lastX = Infinity;
  for (let i = points.length - 1; i >= 0; i--) {
    const px = x(points[i].date);
    if (lastX - px >= 30) {
      labelled.add(i);
      lastX = px;
    }
  }
  const dated = new Set<number>([0, points.length - 1]);
  let prevX = x(points[0].date);
  for (let i = 1; i < points.length - 1; i++) {
    const px = x(points[i].date);
    if (px - prevX >= 58 && x(points[points.length - 1].date) - px >= 58) {
      dated.add(i);
      prevX = px;
    }
  }
  const fmt = (v: number) => v.toFixed(digits);
  const zones = (range?.zones ?? [])
    .map((z) => ({ ...z, y0: y(Math.min(hi, z.to)), y1: y(Math.max(lo, z.from)) }))
    .filter((z) => z.to > lo && z.from < hi);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={`${label} by scan: ${points.map((p) => `${p.date} ${fmt(p.value)}${unit === '%' ? '%' : ` ${unit}`}`).join(', ')}`}>
      {zones.map((z) => (
        <g key={z.label}>
          <rect x={L} y={z.y0} width={width - L - R + 4} height={Math.max(0, z.y1 - z.y0)} fill={ZONE_FILL[z.tone]} />
          {z.y1 - z.y0 >= 13 && (
            <text x={width - R + 12} y={(z.y0 + z.y1) / 2 + 4} className="text-[11px] font-medium" fill={ZONE_INK[z.tone]}>
              {z.label}
            </text>
          )}
        </g>
      ))}
      {grid.map((g) => (
        <g key={g}>
          <line x1={L} x2={width - R + 4} y1={y(g)} y2={y(g)} stroke="var(--viz-surface)" strokeOpacity="0.9" />
          <text x={L - 6} y={y(g) + 4} textAnchor="end" className="fill-[var(--viz-muted)] text-[11px] tabular-nums">
            {+g.toFixed(3)}
            {unit === '%' ? '%' : ''}
          </text>
        </g>
      ))}
      <polyline points={line} fill="none" stroke="var(--viz-ink)" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => {
        const last = i === points.length - 1;
        const py = y(p.value);
        return (
          <Link key={p.resultId} href={`/health/dexa/${p.date}`} aria-label={`${p.date}: ${fmt(p.value)}`}>
            <circle cx={x(p.date)} cy={py} r="12" fill="transparent" />
            <circle cx={x(p.date)} cy={py} r={last ? 6 : 4.5} fill="var(--viz-ink)" stroke="var(--viz-surface)" strokeWidth="2">
              <title>{`${p.date}: ${fmt(p.value)}${unit === '%' ? '%' : ` ${unit}`}`}</title>
            </circle>
            {labelled.has(i) && (
              <text x={x(p.date)} y={py - 11 < T - 8 ? py + 20 : py - 11} textAnchor="middle" className={`fill-[var(--viz-ink)] tabular-nums ${last ? 'text-[13px] font-semibold' : 'text-[11px]'}`}>
                {fmt(p.value)}
              </text>
            )}
            {dated.has(i) && (
              <text x={x(p.date)} y={height - 6} textAnchor={i === 0 && points.length > 1 ? 'start' : last && points.length > 1 ? 'end' : 'middle'} className="fill-[var(--viz-muted)] text-[11px]">
                {monthYY(p.date)}
              </text>
            )}
          </Link>
        );
      })}
    </svg>
  );
}
