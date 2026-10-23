'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ChartTooltip, LegendItem, type TooltipRow } from '@/components/charts/ChartTooltip';
import { niceTicks, useMeasure } from '@/components/charts/useMeasure';

type Point = { date: string; value: number };

const DAY = 864e5;
const t = (d: string) => Date.parse(`${d}T12:00:00Z`);
const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const fmtMonth = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
const duration = (m: number) => `${Math.floor(Math.round(m) / 60)}:${String(Math.round(m) % 60).padStart(2, '0')}`;

/**
 * One metric over the last 90 days on its own axis: a line (gaps over 3 days break it) or daily bars. An optional
 * band shades the 60-day baseline (mean ± 1 SD). Hover or arrow keys read a day; the tooltip can add extra rows.
 */
export default function HealthTrendChart({
  title, subtitle, points, from, to, unit, decimals = 0, kind = 'line', format = 'number', band, details, linkDays = false, maxGapDays = 3,
}: {
  title: string;
  subtitle: string;
  points: Point[];
  from: string; // first day of the window, YYYY-MM-DD
  to: string; // today
  unit: string;
  decimals?: number;
  kind?: 'line' | 'bar';
  format?: 'number' | 'duration'; // duration: minutes shown as h:mm
  band?: { low: number; high: number; label: string } | null;
  details?: Record<string, TooltipRow[]>;
  linkDays?: boolean; // a click or Enter on a day opens /health/day/<date>
  maxGapDays?: number; // a longer gap between points breaks the line (scores Garmin updates weekly use more)
}) {
  const router = useRouter();
  const [ref, width] = useMeasure<HTMLDivElement>(320);
  const [hover, setHover] = useState<number | null>(null);
  const fmt = (v: number) => (format === 'duration' ? duration(v) : v.toFixed(decimals));
  const withUnit = (v: number) => (format === 'duration' ? `${duration(v)} h` : `${fmt(v)} ${unit}`);

  const M = { top: 10, right: 12, bottom: 22, left: 40 };
  const H = 150;
  const plotW = width - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const t0 = t(from);
  const span = Math.max(DAY, t(to) - t0);
  const x = (d: string) => M.left + ((t(d) - t0) / span) * plotW;

  const values = points.length ? points.map((p) => p.value) : [0, 1]; // the empty chart draws no axis
  const lo = kind === 'bar' ? 0 : Math.min(...values, band?.low ?? Infinity);
  const hi = Math.max(...values, band?.high ?? -Infinity);
  const pad = kind === 'bar' ? 0 : Math.max((hi - lo) * 0.15, hi * 0.01, 0.5);
  let ticks = niceTicks(hi + pad, 3, kind === 'bar' ? 0 : Math.max(0, lo - pad));
  if (format === 'duration') {
    // Hours, every 2 h.
    const top = Math.ceil((hi + 1) / 120) * 120;
    ticks = Array.from({ length: top / 120 + 1 }, (_, i) => i * 120);
  }
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const y = (v: number) => M.top + plotH - ((v - yMin) / Math.max(1e-9, yMax - yMin)) * plotH;

  const segments: Point[][] = [];
  for (const p of points) {
    const seg = segments.at(-1);
    if (seg && t(p.date) - t(seg[seg.length - 1].date) <= maxGapDays * DAY) seg.push(p);
    else segments.push([p]);
  }
  const path = (seg: Point[]) => seg.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  // Month labels on the 1st; every other month when the window is longer than 6 months.
  const monthCount = Math.ceil(span / (30 * DAY)) + 1;
  const months = Array.from({ length: monthCount }, (_, i) => {
    const d = new Date(t0);
    d.setUTCMonth(d.getUTCMonth() + i + 1, 1);
    return d.toISOString().slice(0, 10);
  })
    .filter((d) => d > from && d <= to)
    .filter((_, i) => monthCount <= 7 || i % 2 === 0);
  const barW = Math.max(1.5, Math.min(6, (plotW / (span / DAY)) * 0.7));

  const last = points.at(-1);
  const h = hover === null ? null : points[hover];

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const at = t0 + ((e.clientX - r.left - M.left) / plotW) * span;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(t(p.date) - at) < Math.abs(t(points[best].date) - at)) best = i;
    });
    setHover(points.length ? best : null);
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && linkDays && hover !== null) return router.push(`/health/day/${points[hover].date}`);
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setHover((i) => Math.min(points.length - 1, Math.max(0, (i ?? points.length - 1) + (e.key === 'ArrowLeft' ? -1 : 1))));
  }

  return (
    <div className="rounded-lg border bg-[var(--viz-surface)] p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h3 className="font-semibold text-[var(--viz-ink)]">{title}</h3>
          <p className="text-xs text-[var(--viz-muted)]">{subtitle}</p>
        </div>
        <div className="text-right">
          {last ? (
            <span className="text-lg font-semibold tabular-nums text-[var(--viz-ink)]">{withUnit(last.value)}</span>
          ) : (
            <span className="text-xs text-[var(--viz-muted)]">No data</span>
          )}
        </div>
      </div>
      {band && <div className="mb-1"><LegendItem color="var(--viz-band)" label={band.label} /></div>}
      <div ref={ref} className="relative">
        {points.length === 0 ? (
          <div className="flex h-[150px] items-center justify-center rounded-md bg-[var(--viz-band)] text-xs text-[var(--viz-muted)]">
            No {title.toLowerCase()} in this period.
          </div>
        ) : (
          <svg
            width={width}
            height={H}
            role="img"
            tabIndex={0}
            aria-label={`${title}, ${Math.round(span / DAY) + 1} days. Latest ${last ? `${withUnit(last.value)} on ${fmtDay(last.date)}` : 'none'}. Use arrow keys to read days${linkDays ? ', Enter to open a day' : ''}.`}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            onClick={() => linkDays && hover !== null && router.push(`/health/day/${points[hover].date}`)}
            onKeyDown={onKey}
            onBlur={() => setHover(null)}
            className={`max-w-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--viz-ctl)] ${linkDays ? 'cursor-pointer' : ''}`}
          >
            {band && (
              <rect x={M.left} y={y(Math.min(yMax, band.high))} width={plotW} height={Math.max(0, y(Math.max(yMin, band.low)) - y(Math.min(yMax, band.high)))} fill="var(--viz-band)" />
            )}
            {ticks.map((v) => (
              <g key={v}>
                <line x1={M.left} x2={M.left + plotW} y1={y(v)} y2={y(v)} stroke={v === yMin ? 'var(--viz-axis)' : 'var(--viz-grid)'} strokeWidth={1} />
                <text x={M.left - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-[var(--viz-muted)] text-[11px] tabular-nums">
                  {format === 'duration' ? `${v / 60}h` : v}
                </text>
              </g>
            ))}
            {months.map((d) => (
              <text key={d} x={x(d)} y={H - 6} textAnchor="middle" className="fill-[var(--viz-muted)] text-[11px]">{fmtMonth(d)}</text>
            ))}
            {kind === 'bar'
              ? points.map((p, i) => (
                  <rect
                    key={p.date}
                    x={x(p.date) - barW / 2}
                    y={y(p.value)}
                    width={barW}
                    height={Math.max(0, y(yMin) - y(p.value))}
                    rx={Math.min(2, barW / 2)}
                    fill={i === points.length - 1 ? 'var(--viz-ctl)' : 'var(--viz-axis)'}
                    opacity={hover !== null && hover !== i ? 0.5 : 1}
                  />
                ))
              : segments.map((seg) =>
                  seg.length > 1 ? (
                    <path key={seg[0].date} d={path(seg)} fill="none" stroke="var(--viz-ctl)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  ) : (
                    <circle key={seg[0].date} cx={x(seg[0].date)} cy={y(seg[0].value)} r={2.5} fill="var(--viz-ctl)" />
                  )
                )}
            {kind === 'line' && last && <circle cx={x(last.date)} cy={y(last.value)} r={4} fill="var(--viz-ctl)" stroke="var(--viz-surface)" strokeWidth={2} />}
            {h && (
              <g pointerEvents="none">
                <line x1={x(h.date)} x2={x(h.date)} y1={M.top} y2={M.top + plotH} stroke="var(--viz-ink-2)" strokeWidth={1} opacity={0.5} />
                {kind === 'line' && <circle cx={x(h.date)} cy={y(h.value)} r={4} fill="var(--viz-ctl)" stroke="var(--viz-surface)" strokeWidth={2} />}
              </g>
            )}
          </svg>
        )}
        {h && (
          <ChartTooltip
            x={x(h.date)}
            y={M.top}
            width={width}
            title={fmtDay(h.date)}
            rows={[{ key: 'v', label: unit, value: format === 'duration' ? `${duration(h.value)} h` : fmt(h.value), color: 'var(--viz-ctl)', strong: true }, ...(details?.[h.date] ?? [])]}
          />
        )}
      </div>
    </div>
  );
}
