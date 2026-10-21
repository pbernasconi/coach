'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { niceTicks, useMeasure } from '@/components/charts/useMeasure';
import { fmtDay, type LiftPoint } from './types';

const H = 168;
const PAD = { top: 12, right: 12, bottom: 24, left: 40 };

/** "Sep 29", or "Nov 19 '25" for a day in another year than the last point. */
function label(day: string, year: string) {
  return day.slice(0, 4) === year ? fmtDay(day) : `${fmtDay(day)} '${day.slice(2, 4)}`;
}

/**
 * Estimated 1RM per session for one lift, drawn at its real pixel width (no stretching): a y axis in the lift's
 * unit, dates under it, the all-time best as a dashed rule, and a tooltip with the top set on hover or focus.
 * A click on a point opens that session.
 */
export default function LiftChart({ points, best, unit, name }: { points: LiftPoint[]; best: number | null; unit: string; name: string }) {
  const [ref, width] = useMeasure<HTMLDivElement>(420, 200);
  const [hover, setHover] = useState<number | null>(null);
  const router = useRouter();
  if (points.length < 2) {
    return <div className="grid h-[168px] place-items-center rounded-lg bg-[var(--viz-band)] text-xs text-[var(--viz-muted)]">One session so far. The trend starts with the next one.</div>;
  }
  const vals = points.map((p) => p.e1rm);
  const lo = Math.min(...vals, best ?? Infinity);
  const hi = Math.max(...vals, best ?? 0);
  // At least 15% of the value in range, so a flat lift does not look like a cliff.
  const span = Math.max(hi - lo, hi * 0.15);
  const ticks = niceTicks(hi, 3, Math.max(0, hi - span * 1.15));
  const yMin = ticks[0];
  const yMax = ticks.at(-1)!;
  const plotW = width - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * plotW;
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.e1rm).toFixed(1)}`).join('');
  const area = `${line}L${x(points.length - 1).toFixed(1)},${PAD.top + plotH}L${PAD.left},${PAD.top + plotH}Z`;
  const year = points.at(-1)!.day.slice(0, 4);
  // Date labels: first, last, and evenly between when there is room (about 64 px each).
  const room = Math.max(2, Math.min(5, Math.floor(plotW / 64)));
  const step = (points.length - 1) / (room - 1);
  const dateIdx = [...new Set(Array.from({ length: room }, (_, k) => Math.round(k * step)))];
  const id = `lg-${name.replace(/[^a-z0-9]/gi, '')}`;
  const h = hover === null ? null : points[hover];

  return (
    <div ref={ref} className="relative" onPointerLeave={() => setHover(null)}>
      <svg width={width} height={H} className="block" role="img" aria-label={`${name}: estimated 1RM per session, ${points.length} sessions, latest ${Math.round(vals.at(-1)!)} ${unit}`}>
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--sport-strength)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--sport-strength)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--viz-grid)" />
            <text x={PAD.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="var(--viz-muted)" className="tabular-nums">
              {Math.round(t)}
            </text>
          </g>
        ))}
        {dateIdx.map((i, k) => (
          <text key={i} x={x(i)} y={H - 6} fontSize="10" fill="var(--viz-muted)" textAnchor={k === 0 ? 'start' : k === dateIdx.length - 1 ? 'end' : 'middle'}>
            {label(points[i].day, year)}
          </text>
        ))}
        {best !== null && (
          <g>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(best)} y2={y(best)} stroke="var(--color-amber-500)" strokeDasharray="4 3" strokeOpacity="0.8" />
            <text x={width - PAD.right} y={y(best) - 4} textAnchor="end" fontSize="10" fill="var(--color-amber-600)">best {Math.round(best)}</text>
          </g>
        )}
        <path d={area} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke="var(--sport-strength)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {h && hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--viz-axis)" />}
        {points.map((p, i) => {
          const last = i === points.length - 1;
          const on = hover === i;
          return (
            <circle
              key={`${p.sessionId}-${i}`}
              cx={x(i)}
              cy={y(p.e1rm)}
              r={on ? 5 : last ? 4 : 3}
              fill={last || on ? 'var(--sport-strength)' : 'var(--background)'}
              stroke="var(--sport-strength)"
              strokeWidth="2"
            />
          );
        })}
        {/* One hit column per session: hover, focus or click. */}
        {points.map((p, i) => {
          const w = plotW / (points.length - 1);
          return (
            <rect
              key={`hit-${p.sessionId}-${i}`}
              x={x(i) - w / 2}
              y={PAD.top}
              width={w}
              height={plotH}
              fill="transparent"
              className="cursor-pointer outline-none"
              tabIndex={0}
              aria-label={`${fmtDay(p.day)}: ${Math.round(p.weight)} ${unit} × ${p.reps}, estimated 1RM ${Math.round(p.e1rm)}. Open the session.`}
              onPointerEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onClick={() => router.push(`/lift/sessions/${p.sessionId}`)}
              onKeyDown={(e) => e.key === 'Enter' && router.push(`/lift/sessions/${p.sessionId}`)}
            />
          );
        })}
      </svg>
      {h && hover !== null && (
        <ChartTooltip
          x={x(hover)}
          y={Math.max(0, y(h.e1rm) - 70)}
          width={width}
          title={fmtDay(h.day, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          rows={[
            { key: 'e', label: 'est. 1RM', value: `${Math.round(h.e1rm)} ${unit}`, color: 'var(--sport-strength)', strong: true },
            { key: 's', label: 'top set', value: `${Math.round(h.weight)} × ${h.reps}` },
            ...(best !== null ? [{ key: 'b', label: h.e1rm >= best - 0.5 ? 'your best' : `below best (${Math.round(best)})`, value: h.e1rm >= best - 0.5 ? '★' : `${Math.round(h.e1rm - best)}` }] : []),
          ]}
        />
      )}
    </div>
  );
}
