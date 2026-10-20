'use client';

import { useMeasure } from '@/components/charts/useMeasure';
import { formatDay, formatShortDay, formatWeight } from '@/lib/lift-dashboard/format';

export type Point = { day: string; e1rm: number; reps: number | null; weight: number | null };

/** A single-series line of estimated 1RM per session. Up to 640 px wide it is drawn at its real width, so the
 * labels keep their size on a phone; wider, it scales up from 640 as before. Each point has a native tooltip; the
 * table below carries the same numbers. */
export default function E1rmChart({ points, unit }: { points: Point[]; unit: string }) {
  const [ref, measured] = useMeasure<HTMLDivElement>(640);
  const width = Math.min(measured, 640);
  const height = width < 480 ? 180 : 220;
  const pad = { top: 16, right: 16, bottom: 28, left: width < 640 ? 44 : 52 };
  const values = points.map((p) => p.e1rm);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || Math.max(1, hi * 0.1);
  const yMin = Math.max(0, lo - span * 0.15);
  const yMax = hi + span * 0.15;
  const x = (i: number) =>
    points.length === 1 ? (pad.left + width - pad.right) / 2 : pad.left + (i / (points.length - 1)) * (width - pad.left - pad.right);
  const y = (v: number) => pad.top + (1 - (v - yMin) / (yMax - yMin)) * (height - pad.top - pad.bottom);
  const ticks = [yMin, (yMin + yMax) / 2, yMax];
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.e1rm).toFixed(1)}`).join(' ');
  // A date label needs about 56 px.
  const labels = Math.max(2, Math.min(6, Math.floor((width - pad.left - pad.right) / 56)));
  const labelEvery = Math.max(1, Math.ceil(points.length / labels));

  return (
    <div ref={ref}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full text-foreground"
        role="img"
        aria-label={`Estimated 1RM per session, ${points.length} sessions`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={1} />
            <text x={pad.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-[11px]">
              {Math.round(t)}
            </text>
          </g>
        ))}
        {points.map((p, i) => {
          const last = i === points.length - 1;
          // The last label is always drawn; skip a regular one within 56 px of it.
          if (!last && (i % labelEvery !== 0 || x(points.length - 1) - x(i) < 56)) return null;
          return (
            <text key={p.day + i} x={x(i)} y={height - 8} textAnchor={last && points.length > 1 ? 'end' : 'middle'} className="fill-muted-foreground text-[11px]">
              {formatShortDay(p.day)}
            </text>
          );
        })}
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={`pt-${p.day}-${i}`}>
            <circle cx={x(i)} cy={y(p.e1rm)} r={4} fill="currentColor" className="stroke-background" strokeWidth={2} />
            {/* Larger invisible hit target for the tooltip. */}
            <circle cx={x(i)} cy={y(p.e1rm)} r={12} fill="transparent">
              <title>
                {`${formatDay(p.day)}: ${formatWeight(p.e1rm, unit)} est. 1RM (${formatWeight(p.weight, unit)} x ${p.reps ?? '-'})`}
              </title>
            </circle>
          </g>
        ))}
      </svg>
    </div>
  );
}
