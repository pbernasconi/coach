'use client';

import { useState } from 'react';
import { ChartTooltip, LegendItem } from '@/components/charts/ChartTooltip';
import { niceTicks, useMeasure } from '@/components/charts/useMeasure';

export type TimePoint = { t: number; v: number }; // t: local ms (see garmin-day.mjs)
export type TimeEvent = { start: number; end: number; label: string; impact: number | null };

const clock = (t: number) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
const hourLabel = (t: number) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', timeZone: 'UTC' });

/**
 * One measure over a time window (a night or a day) on its own axis. A line, or bars for stress. Gaps over
 * `gapMin` minutes break the line. Optional: a shaded band (a baseline), and events drawn as labelled spans
 * under the plot (Body Battery events). Hover or arrow keys read a point.
 */
export default function TimeChart({
  title, subtitle, points, from, to, unit, color = 'var(--viz-ctl)', kind = 'line', yMin, yMax, band, events, gapMin = 20, height = 140, empty, avg: givenAvg,
}: {
  title: string;
  subtitle?: string;
  points: TimePoint[];
  from: number;
  to: number;
  unit: string;
  color?: string;
  kind?: 'line' | 'bars' | 'dots';
  yMin?: number;
  yMax?: number;
  band?: { low: number; high: number; label: string } | null;
  events?: TimeEvent[];
  gapMin?: number;
  height?: number;
  empty: string; // shown when there are no points
  avg?: number | null; // the source's own average (Garmin's sleep stress), so the chart and the tile agree
}) {
  const [ref, width] = useMeasure<HTMLDivElement>(320);
  const [hover, setHover] = useState<number | null>(null);
  const pts = points.filter((p) => p.t >= from && p.t <= to);
  const evs = (events ?? []).filter((e) => e.end >= from && e.start <= to);
  const M = { top: 8, right: 10, bottom: 20 + (evs.length ? 12 : 0), left: 36 }; // events: a track of bars, named in the list below
  const plotW = width - M.left - M.right;
  const plotH = height - M.top - 20;
  const span = Math.max(1, to - from);
  const x = (t: number) => M.left + ((Math.min(to, Math.max(from, t)) - from) / span) * plotW;
  const values = pts.map((p) => p.v);
  const lo = yMin ?? Math.max(0, Math.min(...values, band?.low ?? Infinity) - 5);
  const hi = yMax ?? Math.max(...values, band?.high ?? -Infinity) + 5;
  const ticks = pts.length ? niceTicks(hi, 3, lo) : [0, 1];
  const t0 = ticks[0];
  const t1 = ticks[ticks.length - 1];
  const y = (v: number) => M.top + plotH - ((v - t0) / Math.max(1e-9, t1 - t0)) * plotH;
  const H = M.top + plotH + M.bottom;

  const segs: TimePoint[][] = [];
  for (const p of pts) {
    const s = segs.at(-1);
    if (s && p.t - s[s.length - 1].t <= gapMin * 60_000) s.push(p);
    else segs.push([p]);
  }
  const path = (s: TimePoint[]) => s.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const hours = Math.max(1, Math.round(span / 3600_000));
  // A label needs about 40 px ("12 AM"): a phone gets fewer labels than the hours alone would give.
  const step = [1, 2, 3, 4, 6, 12].find((s) => s >= (hours > 12 ? 6 : hours > 6 ? 2 : 1) && (s * plotW) / hours >= 40) ?? 12;
  const firstHour = Math.ceil(from / 3600_000) * 3600_000;
  const hourTicks: number[] = [];
  for (let t = firstHour; t <= to; t += 3600_000) if (new Date(t).getUTCHours() % step === 0) hourTicks.push(t);
  const barW = Math.max(1, plotW / Math.max(1, span / (3 * 60_000)) - 0.5);

  const h = hover === null ? null : pts[hover];
  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const at = from + ((e.clientX - r.left - M.left) / plotW) * span;
    let best = 0;
    for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i].t - at) < Math.abs(pts[best].t - at)) best = i;
    setHover(pts.length ? best : null);
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const jump = Math.max(1, Math.round(pts.length / 48));
    setHover((i) => Math.min(pts.length - 1, Math.max(0, (i ?? pts.length - 1) + (e.key === 'ArrowLeft' ? -jump : jump))));
  }
  const avg = !values.length ? null : givenAvg != null ? givenAvg : values.reduce((a, b) => a + b, 0) / values.length;

  return (
    <div className="rounded-lg border bg-[var(--viz-surface)] p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h3 className="font-semibold text-[var(--viz-ink)]">{title}</h3>
          {subtitle && <p className="text-xs text-[var(--viz-muted)]">{subtitle}</p>}
        </div>
        {avg !== null && (
          <span className="text-xs tabular-nums text-[var(--viz-ink-2)]">
            avg <b className="font-semibold text-[var(--viz-ink)]">{Math.round(avg)}</b> {unit} · {Math.round(Math.min(...values))}–{Math.round(Math.max(...values))}
          </span>
        )}
      </div>
      {(band || evs.length > 0) && (
        <div className="mb-1 flex flex-wrap gap-3">
          {band && <LegendItem color="var(--viz-band)" label={band.label} />}
          {evs.length > 0 && <LegendItem color="var(--viz-axis)" label="Body Battery events (± impact)" />}
        </div>
      )}
      <div ref={ref} className="relative">
        {pts.length === 0 ? (
          <div className="flex items-center justify-center rounded-md bg-[var(--viz-band)] px-3 text-center text-xs text-[var(--viz-muted)]" style={{ height }}>
            {empty}
          </div>
        ) : (
          <svg
            width={width}
            height={H}
            role="img"
            tabIndex={0}
            aria-label={`${title}: ${pts.length} readings, average ${avg === null ? '-' : Math.round(avg)} ${unit}. Use arrow keys to read.`}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            onKeyDown={onKey}
            onBlur={() => setHover(null)}
            className="max-w-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--viz-ctl)]"
          >
            {band && <rect x={M.left} y={y(Math.min(t1, band.high))} width={plotW} height={Math.max(0, y(Math.max(t0, band.low)) - y(Math.min(t1, band.high)))} fill="var(--viz-band)" />}
            {ticks.map((v) => (
              <g key={v}>
                <line x1={M.left} x2={M.left + plotW} y1={y(v)} y2={y(v)} stroke={v === t0 ? 'var(--viz-axis)' : 'var(--viz-grid)'} />
                <text x={M.left - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-[var(--viz-muted)] text-[11px] tabular-nums">{v}</text>
              </g>
            ))}
            {hourTicks.map((t) => (
              <text key={t} x={x(t)} y={M.top + plotH + 14} textAnchor={x(t) > M.left + plotW - 16 ? 'end' : x(t) < M.left + 16 ? 'start' : 'middle'} className="fill-[var(--viz-muted)] text-[10px]">{hourLabel(t)}</text>
            ))}
            {kind === 'bars'
              ? pts.map((p) => <rect key={p.t} x={x(p.t) - barW / 2} y={y(p.v)} width={barW} height={Math.max(0, y(t0) - y(p.v))} fill={color} opacity={0.75} />)
              : kind === 'dots'
                ? pts.map((p) => <circle key={p.t} cx={x(p.t)} cy={y(p.v)} r={3} fill={color} />)
                : segs.map((s) =>
                    s.length > 1 ? (
                      <path key={s[0].t} d={path(s)} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
                    ) : (
                      <circle key={s[0].t} cx={x(s[0].t)} cy={y(s[0].v)} r={2} fill={color} />
                    )
                  )}
            {evs.map((e) => {
              const a = x(e.start);
              const w = Math.max(3, x(e.end) - a);
              const yy = M.top + plotH + 22;
              return (
                <g key={`${e.start}-${e.label}`}>
                  <rect x={a} y={yy} width={w} height={8} rx={2} fill="var(--viz-axis)" />
                  <title>{`${e.label}, ${clock(e.start)}–${clock(e.end)}${e.impact !== null ? `, Body Battery ${e.impact > 0 ? '+' : ''}${e.impact}` : ''}`}</title>
                </g>
              );
            })}
            {h && (
              <g pointerEvents="none">
                <line x1={x(h.t)} x2={x(h.t)} y1={M.top} y2={M.top + plotH} stroke="var(--viz-ink-2)" opacity={0.5} />
                <circle cx={x(h.t)} cy={y(h.v)} r={4} fill={color} stroke="var(--viz-surface)" strokeWidth={2} />
              </g>
            )}
          </svg>
        )}
        {h && <ChartTooltip x={x(h.t)} y={M.top} width={width} title={clock(h.t)} rows={[{ key: 'v', label: unit, value: String(Math.round(h.v)), color, strong: true }]} />}
      </div>
      {evs.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--viz-ink-2)]">
          {evs.map((e) => (
            <li key={`l${e.start}`}>
              {clock(e.start)} {e.label}
              {e.impact !== null && <span className="tabular-nums"> {e.impact > 0 ? '+' : ''}{e.impact}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
