'use client';

import { useState } from 'react';
import { useMeasure } from './useMeasure';

/** One point: `label` (usually a date) and `text` (the value, formatted) show on hover. */
export type MiniPoint = { value: number; label: string; text: string; dot?: number };

/**
 * A small trend line (or filled area) scaled to its own range, with a hover readout: a guide line, the point, and a
 * small "label · value" box. Server components pass the text already formatted (they cannot pass a formatter).
 * A point's `dot` draws a small muted dot at that value under the line (weight: each reading under its trend).
 */
export default function MiniTrend({
  points, color, height = 40, area = false, lastDot = false, label, className,
}: {
  points: MiniPoint[];
  color: string;
  height?: number;
  area?: boolean;
  lastDot?: boolean;
  label: string;
  className?: string;
}) {
  const [ref, width] = useMeasure<HTMLDivElement>(120, 40);
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <div className={className} style={{ height }} aria-hidden />;
  const vals = points.map((p) => p.value);
  const dots = points.map((p) => p.dot).filter((v): v is number => v != null);
  const lo = Math.min(...vals, ...dots);
  const hi = Math.max(...vals, ...dots);
  const pad = area ? (hi - lo || 1) * 0.15 : 0;
  const inset = 3;
  const last = points.length - 1;
  const x = (i: number) => inset + (i / last) * (width - 2 * inset);
  const y = (v: number) => inset + (1 - (v - (lo - pad)) / (hi - lo + 2 * pad || 1)) * (height - 2 * inset);
  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const h = hover == null ? null : points[hover];
  const hx = hover == null ? 0 : x(hover);

  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      <svg
        width={width}
        height={height}
        className="block max-w-full touch-none"
        role="img"
        aria-label={label}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setHover(Math.max(0, Math.min(last, Math.round(((e.clientX - r.left - inset) / (width - 2 * inset)) * last))));
        }}
        onPointerLeave={() => setHover(null)}
      >
        {points.map((p, i) => (p.dot == null ? null : <circle key={i} cx={x(i)} cy={y(p.dot)} r={1.6} fill="var(--viz-muted)" opacity={0.7} />))}
        {area && <path d={`${line}L${x(last)},${height}L${x(0)},${height}Z`} fill={color} opacity={0.18} />}
        <path d={line} fill="none" stroke={color} strokeWidth={area ? 1.5 : 1.75} strokeLinejoin="round" strokeLinecap="round" />
        {lastDot && hover == null && <circle cx={x(last)} cy={y(vals[last])} r={2.75} fill={color} />}
        {h && (
          <g pointerEvents="none">
            <line x1={hx} x2={hx} y1={0} y2={height} stroke="var(--viz-axis)" strokeWidth={1} />
            <circle cx={hx} cy={y(h.value)} r={3.5} fill={color} stroke="var(--viz-surface)" strokeWidth={1.5} />
          </g>
        )}
      </svg>
      {h && (
        <div
          role="status"
          className="pointer-events-none absolute bottom-full z-20 mb-1 whitespace-nowrap rounded border bg-[var(--viz-surface)] px-1.5 py-0.5 text-[11px] leading-4 shadow-sm"
          style={hx > width / 2 ? { right: Math.max(0, width - hx - 8) } : { left: Math.max(0, hx - 8) }}
        >
          <span className="text-[var(--viz-muted)]">{h.label} ·</span> <b className="font-semibold tabular-nums text-[var(--viz-ink)]">{h.text}</b>
        </div>
      )}
    </div>
  );
}
