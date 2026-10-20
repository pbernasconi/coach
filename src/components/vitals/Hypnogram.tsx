'use client';

import { useState } from 'react';
import { ChartTooltip, LegendItem } from '@/components/charts/ChartTooltip';
import { useMeasure } from '@/components/charts/useMeasure';

import { STAGE_STYLE, type Stage, type StageSpan } from './stages';

const ROWS: Stage[] = ['awake', 'rem', 'light', 'deep'];
const clock = (t: number) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
const mins = (ms: number) => {
  const m = Math.round(ms / 60_000);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`;
};

/** The night's sleep stages: one row per stage, awake at the top. Hover or arrow keys read a stage span. */
export default function Hypnogram({ stages, from, to }: { stages: StageSpan[]; from: number; to: number }) {
  const [ref, width] = useMeasure<HTMLDivElement>(320);
  const [hover, setHover] = useState<number | null>(null);
  const M = { top: 4, right: 10, bottom: 20, left: 46 };
  const rowH = 22;
  const H = M.top + rowH * ROWS.length + M.bottom;
  const plotW = width - M.left - M.right;
  const span = Math.max(1, to - from);
  const x = (t: number) => M.left + ((Math.min(to, Math.max(from, t)) - from) / span) * plotW;
  const rowY = (s: Stage) => M.top + ROWS.indexOf(s) * rowH;
  // A label needs about 36 px: on a phone, every second or third hour.
  const perHour = plotW / Math.max(1, span / 3600_000);
  const step = [1, 2, 3, 4, 6].find((s) => s * perHour >= 36) ?? 6;
  const hourTicks: number[] = [];
  for (let t = Math.ceil(from / 3600_000) * 3600_000; t <= to; t += 3600_000) if (new Date(t).getUTCHours() % step === 0) hourTicks.push(t);
  const h = hover === null ? null : stages[hover];

  if (!stages.length) {
    return <div className="flex h-24 items-center justify-center rounded-md bg-[var(--viz-band)] text-xs text-[var(--viz-muted)]">No sleep stages for this night.</div>;
  }
  return (
    <div>
      <div className="mb-1 flex flex-wrap gap-3">
        {ROWS.slice().reverse().map((s) => <LegendItem key={s} color={STAGE_STYLE[s].color} label={STAGE_STYLE[s].label} />)}
      </div>
      <div ref={ref} className="relative">
        <svg
          width={width}
          height={H}
          role="img"
          tabIndex={0}
          aria-label={`Sleep stages from ${clock(from)} to ${clock(to)}. Use arrow keys to read each stage.`}
          onPointerLeave={() => setHover(null)}
          onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            setHover((i) => Math.min(stages.length - 1, Math.max(0, (i ?? -1) + (e.key === 'ArrowLeft' ? -1 : 1))));
          }}
          className="max-w-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--viz-ctl)]"
        >
          {ROWS.map((s) => (
            <g key={s}>
              <line x1={M.left} x2={M.left + plotW} y1={rowY(s) + rowH} y2={rowY(s) + rowH} stroke="var(--viz-grid)" />
              <text x={M.left - 6} y={rowY(s) + rowH / 2} dy="0.32em" textAnchor="end" className="fill-[var(--viz-muted)] text-[11px]">{STAGE_STYLE[s].label}</text>
            </g>
          ))}
          {hourTicks.map((t) => (
            <text key={t} x={x(t)} y={H - 6} textAnchor={x(t) > M.left + plotW - 14 ? 'end' : 'middle'} className="fill-[var(--viz-muted)] text-[10px]">
              {new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', timeZone: 'UTC' })}
            </text>
          ))}
          {stages.map((s, i) => (
            <rect
              key={`${s.start}-${i}`}
              x={x(s.start)}
              y={rowY(s.stage) + 3}
              width={Math.max(1, x(s.end) - x(s.start))}
              height={rowH - 6}
              rx={2}
              fill={STAGE_STYLE[s.stage].color}
              opacity={hover !== null && hover !== i ? 0.45 : 1}
              onPointerEnter={() => setHover(i)}
            />
          ))}
        </svg>
        {h && (
          <ChartTooltip
            x={x(h.start)}
            y={rowY(h.stage)}
            width={width}
            title={`${clock(h.start)}–${clock(h.end)}`}
            rows={[{ key: 's', label: STAGE_STYLE[h.stage].label, value: mins(h.end - h.start), color: STAGE_STYLE[h.stage].color, strong: true }]}
          />
        )}
      </div>
    </div>
  );
}
