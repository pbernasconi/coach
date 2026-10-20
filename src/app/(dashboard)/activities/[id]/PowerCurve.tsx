'use client';

import { useState } from 'react';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { niceTicks, useMeasure } from '@/components/charts/useMeasure';
import { duration } from '@/lib/activity/format.mjs';

const label = (s: number) => (s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.round((s / 3600) * 10) / 10}h`);

/** The best average power for each duration in this ride, on a log time axis. */
export default function PowerCurve({ points, ftp }: { points: { seconds: number; watts: number }[]; ftp: number | null }) {
  const [ref, width] = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;
  const M = { left: 44, right: 12, top: 12, bottom: 24 };
  const PH = 180;
  const plotW = width - M.left - M.right;
  const lx0 = Math.log(points[0].seconds);
  const lx1 = Math.log(points[points.length - 1].seconds);
  const x = (s: number) => M.left + ((Math.log(s) - lx0) / Math.max(1e-6, lx1 - lx0)) * plotW;
  const ticks = niceTicks(Math.max(...points.map((p) => p.watts), ftp ?? 0), 4);
  const top = ticks[ticks.length - 1];
  const y = (w: number) => M.top + PH - (w / top) * PH;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.seconds).toFixed(1)},${y(p.watts).toFixed(1)}`).join('');
  const h = hover != null ? points[hover] : null;
  return (
    <div ref={ref} className="relative">
      <svg
        width={width}
        height={M.top + PH + M.bottom}
        role="img"
        tabIndex={0}
        aria-label={`Power curve: ${points.map((p) => `${label(p.seconds)} ${p.watts} W`).join(', ')}.`}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = e.clientX - r.left;
          let best = 0;
          points.forEach((p, i) => { if (Math.abs(x(p.seconds) - px) < Math.abs(x(points[best].seconds) - px)) best = i; });
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
        className="outline-none focus-visible:ring-2 focus-visible:ring-[var(--viz-ctl)]"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={M.left + plotW} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)'} />
            <text x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[var(--viz-muted)] text-[10px] tabular-nums">{t} W</text>
          </g>
        ))}
        {[1, 5, 30, 60, 300, 1200, 3600, 7200].filter((s) => s >= points[0].seconds && s <= points[points.length - 1].seconds).map((s) => (
          <text key={s} x={x(s)} y={M.top + PH + 16} textAnchor="middle" className="fill-[var(--viz-muted)] text-[10px]">{label(s)}</text>
        ))}
        {ftp && ftp < top && (
          <g>
            <line x1={M.left} x2={M.left + plotW} y1={y(ftp)} y2={y(ftp)} stroke="var(--viz-ink-2)" strokeDasharray="4 3" />
            <text x={M.left + plotW} y={y(ftp) - 4} textAnchor="end" stroke="var(--viz-surface)" strokeWidth={3} paintOrder="stroke" className="fill-[var(--viz-ink-2)] text-[10px]">FTP {ftp} W</text>
          </g>
        )}
        <path d={d} fill="none" stroke="var(--viz-power)" strokeWidth={2} strokeLinejoin="round" />
        {h && <circle cx={x(h.seconds)} cy={y(h.watts)} r={4} fill="var(--viz-power)" stroke="var(--viz-surface)" strokeWidth={2} />}
      </svg>
      {h && <ChartTooltip x={x(h.seconds)} y={M.top} width={width} title={`Best ${duration(h.seconds)}`} rows={[{ key: 'w', label: 'W average', value: String(h.watts), color: 'var(--viz-power)', strong: true }, ...(ftp ? [{ key: 'f', label: 'of FTP', value: `${Math.round((h.watts / ftp) * 100)}%` }] : [])]} />}
    </div>
  );
}
