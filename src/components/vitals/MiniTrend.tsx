'use client';

import { fmtDate } from '@/lib/vitals/health-view.mjs';
import { useState } from 'react';
import { useMeasure } from '@/components/charts/useMeasure';

/** A YYYY-MM-DD as "Oct 22, 2026"; other text as is. */
const dateText = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? fmtDate(d) : d);

/**
 * A small trend for a tile, scaled to its own min and max (unlike Sparkline, which starts at 0, so small changes
 * of a high value stay visible). The latest point is in the accent. Hover reads a point; the tile has the values.
 */
export default function MiniTrend({ points, display, height = 34, accent = 'var(--viz-ctl)' }: { points: { date: string; value: number }[]; display: string[]; height?: number; accent?: string }) {
  const [ref, width] = useMeasure<HTMLDivElement>(160, 60);
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <div className="mt-2 text-[10px] text-[var(--viz-muted)]">{points.length ? 'One reading so far' : 'No trend yet'}</div>;
  const pad = 4;
  const vs = points.map((p) => p.value);
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const t0 = Date.parse(points[0].date);
  const span = Math.max(1, Date.parse(points[points.length - 1].date) - t0);
  const x = (d: string) => pad + ((Date.parse(d) - t0) / span) * (width - 2 * pad);
  const y = (v: number) => (hi === lo ? height / 2 : height - pad - ((v - lo) / (hi - lo)) * (height - 2 * pad));
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const last = points.length - 1;
  const i = hover ?? last;
  return (
    <div ref={ref} className="mt-2">
      <svg
        className="max-w-full"
        width={width}
        height={height}
        aria-hidden
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const at = t0 + ((e.clientX - r.left - pad) / (width - 2 * pad)) * span;
          let best = 0;
          points.forEach((p, k) => {
            if (Math.abs(Date.parse(p.date) - at) < Math.abs(Date.parse(points[best].date) - at)) best = k;
          });
          setHover(best);
        }}
        onPointerLeave={() => setHover(null)}
      >
        <path d={d} fill="none" stroke="var(--viz-axis)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(points[i].date)} cy={y(points[i].value)} r={3.5} fill={hover === null ? accent : 'var(--viz-ink-2)'} stroke="var(--viz-surface)" strokeWidth={2} />
      </svg>
      <div className="flex justify-between text-[10px] text-[var(--viz-muted)]">
        <span>{hover === null ? `since ${dateText(points[0].date)}` : dateText(points[i].date)}</span>
        <span className="tabular-nums">{hover === null ? '' : display[i]}</span>
      </div>
    </div>
  );
}
