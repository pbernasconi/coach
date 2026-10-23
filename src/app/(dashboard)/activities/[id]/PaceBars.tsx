'use client';

import { useMemo, useState } from 'react';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { useMeasure } from '@/components/charts/useMeasure';
import { duration, kmh, pace } from '@/lib/activity/format.mjs';
import { smooth } from '@/lib/activity/streams.mjs';
import type { Lap, Layout, Series, Split } from '@/lib/activity/queries';

type Bar = { key: string; label: string; width: number; speed: number | null; gap: number | null; hr: number | null; time: number; distance: number };

/**
 * Pace analysis as Strava draws it: one bar per split or lap, as wide as its distance and as tall as its speed
 * (faster is taller), labeled in pace. Pace or GAP (runs), speed (rides). "Smoothed" shows the 60 s pace line.
 */
export default function PaceBars({ splits, laps, series, layout, color }: { splits: Split[]; laps: Lap[]; series: Series | null; layout: Layout; color: string }) {
  const foot = layout === 'run';
  const modes = [
    ...(splits.length ? (['splits'] as const) : []),
    ...(laps.length > 1 ? (['laps'] as const) : []),
    ...(series?.speed ? (['smoothed'] as const) : []),
  ];
  const [mode, setMode] = useState<(typeof modes)[number] | undefined>(modes[0]);
  const hasGap = foot && (splits.some((s) => s.gapSpeed) || laps.some((l) => l.gapSpeed));
  const [metric, setMetric] = useState<'pace' | 'gap'>('pace');
  const [ref, width] = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const bars: Bar[] = useMemo(() => {
    if (mode === 'splits') return splits.map((s) => ({ key: `s${s.index}`, label: `Km ${s.index}`, width: s.distance, speed: s.speed, gap: s.gapSpeed, hr: s.hr, time: s.moving, distance: s.distance }));
    if (mode === 'laps') return laps.map((l) => ({ key: `l${l.index}`, label: l.name || `Lap ${l.index}`, width: l.distance || l.moving, speed: l.speed, gap: l.gapSpeed, hr: l.hr, time: l.moving, distance: l.distance }));
    return [];
  }, [mode, splits, laps]);

  const line = useMemo(() => {
    if (mode !== 'smoothed' || !series?.speed) return null;
    const src = metric === 'gap' && series.gap ? series.gap : series.speed;
    return smooth(src, series.t, 60);
  }, [mode, series, metric]);

  if (!mode) return null;
  const valueOf = (b: Bar) => (metric === 'gap' ? b.gap : b.speed);
  const vals = mode === 'smoothed' ? (line ?? []).filter((v): v is number => typeof v === 'number' && v > 0.5) : bars.map(valueOf).filter((v): v is number => typeof v === 'number');
  if (!vals.length) return null;
  const sorted = [...vals].sort((a, b) => a - b);
  const lo = Math.max(0, sorted[Math.floor(sorted.length * 0.02)] * 0.85);
  const hi = sorted[Math.floor((sorted.length - 1) * 0.99)] * 1.04;

  const M = { left: 44, right: 8, top: 10, bottom: 22 };
  const PH = 160;
  const plotW = width - M.left - M.right;
  const y = (v: number) => M.top + PH - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * PH;
  const total = bars.reduce((n, b) => n + Math.max(0, b.width), 0) || 1;
  const geo = bars.reduce<{ x0: number; x1: number; acc: number }[]>((out, b) => {
    const from = out.length ? out[out.length - 1].acc : 0;
    const acc = from + Math.max(0, b.width);
    out.push({ x0: M.left + (from / total) * plotW, x1: M.left + (acc / total) * plotW, acc });
    return out;
  }, []);
  const fmt = (v: number) => (foot ? pace(v) : kmh(v));
  const ticks = [lo + (hi - lo) * 0.2, lo + (hi - lo) * 0.55, lo + (hi - lo) * 0.9];
  const unit = foot ? '/km' : 'km/h';
  // Bars: weighted by each bar's time, so a 40 m last split does not count as much as a full km (for pace that is
  // distance over time, the activity's own average).
  const weighted = bars.map((b) => ({ v: valueOf(b), t: b.time })).filter((x): x is { v: number; t: number } => typeof x.v === 'number' && x.t > 0);
  const wt = weighted.reduce((n, x) => n + x.t, 0);
  const avg = mode !== 'smoothed' && wt > 0 ? weighted.reduce((n, x) => n + x.v * x.t, 0) / wt : vals.reduce((a, b) => a + b, 0) / vals.length;
  const H = M.top + PH + M.bottom;

  const linePath =
    line && series
      ? (() => {
          const t0 = series.t[0];
          const span = Math.max(1, series.t[series.t.length - 1] - t0);
          let d = '';
          let pen = false;
          line.forEach((v, i) => {
            if (typeof v !== 'number' || v < 0.5) { pen = false; return; }
            d += `${pen ? 'L' : 'M'}${(M.left + ((series.t[i] - t0) / span) * plotW).toFixed(1)},${y(v).toFixed(1)}`;
            pen = true;
          });
          return d;
        })()
      : '';

  const h = hover != null ? bars[hover] : null;
  return (
    <div className="rounded-lg border bg-[var(--viz-surface)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-md border p-0.5 text-xs" role="group" aria-label="Bars by">
          {modes.map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => { setMode(m); setHover(null); }}
              className={`rounded px-2 py-0.5 capitalize ${mode === m ? 'bg-muted font-medium text-[var(--viz-ink)]' : 'text-[var(--viz-muted)]'}`}>
              {m}
            </button>
          ))}
        </div>
        {hasGap && (
          <div className="inline-flex rounded-md border p-0.5 text-xs" role="group" aria-label="Metric">
            {(['pace', 'gap'] as const).map((m) => (
              <button key={m} type="button" aria-pressed={metric === m} onClick={() => setMetric(m)}
                className={`rounded px-2 py-0.5 ${metric === m ? 'bg-muted font-medium text-[var(--viz-ink)]' : 'text-[var(--viz-muted)]'}`}>
                {m === 'pace' ? 'Pace' : 'GAP'}
              </button>
            ))}
          </div>
        )}
      </div>
      <div ref={ref} className="relative">
        <svg
          width={width}
          height={H}
          role="img"
          tabIndex={0}
          aria-label={`${foot ? (metric === 'gap' ? 'Grade-adjusted pace' : 'Pace') : 'Speed'} by ${mode}. Average ${fmt(avg)} ${unit}. Use the arrow keys to read each bar.`}
          onKeyDown={(e) => {
            if (!bars.length) return;
            const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
            if (!step) return;
            e.preventDefault();
            setHover((v) => Math.min(bars.length - 1, Math.max(0, (v ?? -1) + step)));
          }}
          onBlur={() => setHover(null)}
          onPointerLeave={() => setHover(null)}
          className="max-w-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--viz-ctl)]"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={M.left + plotW} y1={y(t)} y2={y(t)} stroke="var(--viz-grid)" />
              <text x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[var(--viz-muted)] text-[10px] tabular-nums">{fmt(t)}</text>
            </g>
          ))}
          {bars.map((b, i) => {
            const v = valueOf(b);
            if (v == null) return null;
            const { x0, x1 } = geo[i];
            const w = Math.max(1, x1 - x0 - 2);
            const top = y(v);
            return (
              <g key={b.key} onPointerEnter={() => setHover(i)}>
                <rect x={x0} y={M.top} width={Math.max(1, x1 - x0)} height={PH} fill="transparent" />
                <path
                  d={`M${x0 + 1},${M.top + PH}V${top + 2}a2,2 0 0 1 2,-2H${x0 + 1 + w - 2}a2,2 0 0 1 2,2V${M.top + PH}Z`}
                  fill={color}
                  opacity={hover == null || hover === i ? 1 : 0.55}
                />
              </g>
            );
          })}
          {linePath && <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />}
          <line x1={M.left} x2={M.left + plotW} y1={y(avg)} y2={y(avg)} stroke="var(--viz-ink-2)" strokeDasharray="4 3" strokeWidth={1} />
          <text x={M.left + plotW} y={y(avg) - 4} textAnchor="end" stroke="var(--viz-surface)" strokeWidth={3} paintOrder="stroke" className="fill-[var(--viz-ink-2)] text-[10px]">avg {fmt(avg)}</text>
          <line x1={M.left} x2={M.left + plotW} y1={M.top + PH} y2={M.top + PH} stroke="var(--viz-axis)" />
          {bars.length > 0 && bars.length <= 30 &&
            bars.map((b, i) => (i % Math.ceil(bars.length / 12) === 0 ? (
              <text key={`x${b.key}`} x={(geo[i].x0 + geo[i].x1) / 2} y={H - 6} textAnchor="middle" className="fill-[var(--viz-muted)] text-[10px]">{mode === 'splits' ? i + 1 : i + 1}</text>
            ) : null))}
        </svg>
        {h && hover != null && (
          <ChartTooltip
            x={(geo[hover].x0 + geo[hover].x1) / 2}
            y={M.top}
            width={width}
            title={h.label}
            rows={[
              { key: 'v', label: foot ? 'pace /km' : 'km/h', value: h.speed ? fmt(h.speed) : '–', color, strong: metric === 'pace' },
              ...(hasGap ? [{ key: 'g', label: 'GAP /km', value: h.gap ? fmt(h.gap) : '–', strong: metric === 'gap' }] : []),
              { key: 't', label: 'time', value: duration(h.time) },
              { key: 'd', label: 'km', value: (h.distance / 1000).toFixed(2) },
              ...(h.hr ? [{ key: 'hr', label: 'bpm', value: String(Math.round(h.hr)) }] : []),
            ]}
          />
        )}
      </div>
    </div>
  );
}
