'use client';

import { useState } from 'react';
import { useMeasure } from './useMeasure';

/**
 * A 12-point trend for a stat tile: the past in the de-emphasis gray, the latest point in the accent.
 * Hover reads a point. Values are also in the tile and the table, so the hover never gates.
 */
export default function Sparkline({
  values, labels, display, accent = 'var(--viz-ctl)', height = 36,
}: {
  values: number[];
  labels: string[];
  display: string[]; // each value formatted for reading (server components cannot pass a formatter)
  accent?: string;
  height?: number;
}) {
  const [ref, width] = useMeasure<HTMLDivElement>(160);
  const [hover, setHover] = useState<number | null>(null);
  if (values.length < 2) return null;
  const pad = 5;
  const max = Math.max(...values, 1e-9);
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - (v / max) * (height - pad * 2);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const last = values.length - 1;
  const i = hover ?? last;
  return (
    <div ref={ref} className="relative mt-2">
      <svg
        width={width}
        height={height}
        aria-hidden
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setHover(Math.max(0, Math.min(last, Math.round(((e.clientX - r.left - pad) / (width - pad * 2)) * last))));
        }}
        onPointerLeave={() => setHover(null)}
      >
        <path d={d} fill="none" stroke="var(--viz-axis)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(i)} cy={y(values[i])} r={4} fill={hover === null ? accent : 'var(--viz-ink-2)'} stroke="var(--viz-surface)" strokeWidth={2} />
      </svg>
      <div className="flex justify-between text-[10px] text-[var(--viz-muted)]">
        <span>{hover === null ? '12 weeks' : labels[i]}</span>
        <span className="tabular-nums">{hover === null ? '' : display[i]}</span>
      </div>
    </div>
  );
}
