'use client';

import { useState } from 'react';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { niceTicks, useMeasure } from '@/components/charts/useMeasure';
import { duration } from '@/lib/activity/format.mjs';

const label = (s: number) => (s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.round((s / 3600) * 10) / 10}h`);

/**
 * A peak curve (best average for each duration) as an area on a log time axis: peak heart rate, peak pace or
 * peak power. `format` prints a value (for pace, a speed in m/s printed as min/km, so faster is higher).
 */
export default function PeakCurve({
  points, color, name, format, unit, floor = 0, height = 170,
}: {
  points: { seconds: number; value: number }[];
  color: string;
  name: string;
  format: (v: number) => string;
  unit: string;
  /** The lowest value on the axis (for heart rate, a resting value reads better than 0). */
  floor?: number;
  height?: number;
}) {
  const [ref, width] = useMeasure<HTMLDivElement>(480, 200);
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <p className="py-6 text-center text-xs text-[var(--viz-muted)]">Not enough data for a {name.toLowerCase()} curve.</p>;
  const M = { left: 48, right: 12, top: 10, bottom: 22 };
  const PH = height;
  const plotW = Math.max(40, width - M.left - M.right);
  const lx0 = Math.log(points[0].seconds);
  const lx1 = Math.log(points[points.length - 1].seconds);
  const x = (s: number) => M.left + ((Math.log(s) - lx0) / Math.max(1e-6, lx1 - lx0)) * plotW;
  const lo = Math.min(floor, ...points.map((p) => p.value));
  const ticks = niceTicks(Math.max(...points.map((p) => p.value)), 4, lo);
  const y0 = ticks[0];
  const y1 = ticks[ticks.length - 1];
  const y = (v: number) => M.top + PH - ((v - y0) / Math.max(1e-6, y1 - y0)) * PH;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.seconds).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const area = `${line}L${x(points[points.length - 1].seconds).toFixed(1)},${M.top + PH}L${x(points[0].seconds).toFixed(1)},${M.top + PH}Z`;
  const h = hover != null ? points[hover] : null;
  return (
    <div ref={ref} className="relative">
      <svg
        width={width}
        height={M.top + PH + M.bottom}
        role="img"
        tabIndex={0}
        aria-label={`${name}: ${points.map((p) => `${label(p.seconds)} ${format(p.value)} ${unit}`).join(', ')}.`}
        onPointerMove={(e) => {
          const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
          let best = 0;
          points.forEach((p, i) => {
            if (Math.abs(x(p.seconds) - px) < Math.abs(x(points[best].seconds) - px)) best = i;
          });
          setHover(best);
        }}
        onKeyDown={(e) => {
          const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
          if (!step) return;
          e.preventDefault();
          setHover((v) => Math.min(points.length - 1, Math.max(0, (v ?? -1) + step)));
        }}
        onBlur={() => setHover(null)}
        onPointerLeave={() => setHover(null)}
        className="max-w-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={M.left + plotW} y1={y(t)} y2={y(t)} stroke={t === y0 ? 'var(--viz-axis)' : 'var(--viz-grid)'} />
            <text x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[var(--viz-muted)] text-[10px] tabular-nums">{format(t)}</text>
          </g>
        ))}
        {points.map((p) => (
          <text key={p.seconds} x={x(p.seconds)} y={M.top + PH + 15} textAnchor="middle" className="fill-[var(--viz-muted)] text-[10px]">
            {[5, 30, 60, 300, 1200, 3600, 7200].includes(p.seconds) ? label(p.seconds) : ''}
          </text>
        ))}
        <path d={area} fill={color} fillOpacity={0.14} />
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {h && (
          <>
            <line x1={x(h.seconds)} x2={x(h.seconds)} y1={M.top} y2={M.top + PH} stroke="var(--viz-axis)" />
            <circle cx={x(h.seconds)} cy={y(h.value)} r={4} fill={color} stroke="var(--viz-surface)" strokeWidth={2} />
          </>
        )}
      </svg>
      {h && <ChartTooltip x={x(h.seconds)} y={M.top} width={width} title={`Best ${duration(h.seconds)}`} rows={[{ key: 'v', label: unit, value: format(h.value), color, strong: true }]} />}
    </div>
  );
}
