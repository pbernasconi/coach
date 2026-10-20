'use client';

import { useState } from 'react';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { niceTicks, useMeasure } from '@/components/charts/useMeasure';
import { duration, percents } from '@/lib/activity/format.mjs';

/**
 * Time per bin as vertical bars (the pace distribution). `bins` are in reading order; `label` is the x-axis text.
 * A dashed line can mark one bin value (the average). Hover and arrow keys read each bin.
 */
export default function Histogram({ bins, color, title, unit, mark }: { bins: { label: string; seconds: number }[]; color: string; title: string; unit: string; mark?: { index: number; label: string } }) {
  const [ref, width] = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  if (!bins.length) return null;
  const pct = percents(bins.map((b) => b.seconds));
  const M = { left: 40, right: 8, top: 10, bottom: 24 };
  const PH = 150;
  const plotW = width - M.left - M.right;
  const bw = plotW / bins.length;
  const ticks = niceTicks(Math.max(...bins.map((b) => b.seconds / 60)), 3);
  const top = ticks[ticks.length - 1] || 1;
  const y = (min: number) => M.top + PH - (min / top) * PH;
  const every = Math.ceil(bins.length / Math.max(2, Math.floor(plotW / 44)));
  const h = hover != null ? bins[hover] : null;
  return (
    <div ref={ref} className="relative">
      <svg
        width={width}
        height={M.top + PH + M.bottom}
        role="img"
        tabIndex={0}
        aria-label={`${title}. Use the arrow keys to read each bin.`}
        onKeyDown={(e) => {
          const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
          if (!step) return;
          e.preventDefault();
          setHover((v) => Math.min(bins.length - 1, Math.max(0, (v ?? -1) + step)));
        }}
        onBlur={() => setHover(null)}
        onPointerLeave={() => setHover(null)}
        className="max-w-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--viz-ctl)]"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={M.left + plotW} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)'} />
            <text x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[var(--viz-muted)] text-[10px] tabular-nums">{t} min</text>
          </g>
        ))}
        {bins.map((b, i) => {
          const x0 = M.left + i * bw;
          const hgt = Math.max(0, M.top + PH - y(b.seconds / 60));
          const w = Math.max(1, bw - 2);
          return (
            <g key={b.label} onPointerEnter={() => setHover(i)}>
              <rect x={x0} y={M.top} width={bw} height={PH} fill="transparent" />
              {hgt > 0 && (
                <path d={`M${x0 + 1},${M.top + PH}V${M.top + PH - hgt + Math.min(2, hgt)}a2,2 0 0 1 2,-2H${x0 + 1 + w - 2}a2,2 0 0 1 2,2V${M.top + PH}Z`}
                  fill={color} opacity={hover == null || hover === i ? 1 : 0.55} />
              )}
              {i % every === 0 && (
                <text x={x0 + bw / 2} y={M.top + PH + 16} textAnchor="middle" className="fill-[var(--viz-muted)] text-[10px] tabular-nums">{b.label}</text>
              )}
            </g>
          );
        })}
        {mark && (
          <g pointerEvents="none">
            <line x1={M.left + (mark.index + 0.5) * bw} x2={M.left + (mark.index + 0.5) * bw} y1={M.top} y2={M.top + PH} stroke="var(--viz-ink-2)" strokeDasharray="4 3" />
            <text x={M.left + (mark.index + 0.5) * bw + 4} y={M.top + 10} stroke="var(--viz-surface)" strokeWidth={3} paintOrder="stroke" className="fill-[var(--viz-ink-2)] text-[10px]">{mark.label}</text>
          </g>
        )}
      </svg>
      {h && hover != null && (
        <ChartTooltip x={M.left + (hover + 0.5) * bw} y={M.top} width={width} title={`${h.label} ${unit}`}
          rows={[{ key: 't', label: 'time', value: duration(h.seconds), color, strong: true }, { key: 'p', label: 'of the moving time', value: `${pct[hover]}%` }]} />
      )}
    </div>
  );
}
