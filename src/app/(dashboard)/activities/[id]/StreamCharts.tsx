'use client';

import { useMemo, useState } from 'react';
import { ChartTooltip, LegendItem } from '@/components/charts/ChartTooltip';
import { niceTicks, useMeasure } from '@/components/charts/useMeasure';
import { duration } from '@/lib/activity/format.mjs';
import { smooth } from '@/lib/activity/streams.mjs';
import type { Layout, Series } from '@/lib/activity/queries';
import { useActivityHover } from './ActivityHover';

type Vals = (number | null)[];
type Panel = {
  key: string;
  label: string;
  unit: string;
  color: string;
  values: Vals;
  overlay?: { key: string; label: string; values: Vals; color: string };
  invert?: boolean; // pace: faster (smaller) at the top
  area?: boolean;
  fmt: (v: number) => string;
  avg: number | null;
  overlayAvg?: number | null;
};

const paceOf = (v: number | null) => (typeof v === 'number' && v > 0.5 ? 1000 / v : null);
const round = (v: number) => String(Math.round(v));
const SMOOTHING = [
  { s: 0, label: 'Off' },
  { s: 15, label: '15 s' },
  { s: 30, label: '30 s' },
  { s: 60, label: '60 s' },
];

function percentile(vs: number[], p: number) {
  const s = [...vs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))];
}

/** The y range of a panel: robust for pace (stops make huge paces), padded min–max for the rest. */
function domain(p: Panel) {
  const vs = [...p.values, ...(p.overlay?.values ?? [])].filter((v): v is number => typeof v === 'number');
  if (vs.length < 2) return null;
  let lo = p.invert ? percentile(vs, 0.02) : Math.min(...vs);
  let hi = p.invert ? percentile(vs, 0.98) : Math.max(...vs);
  if (p.area) lo = Math.min(lo, hi - 10);
  if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.08;
  return { lo: p.area ? lo - pad : lo - pad, hi: hi + pad };
}

function pathOf(values: Vals, x: (i: number) => number, y: (v: number) => number) {
  let d = '';
  let pen = false;
  values.forEach((v, i) => {
    if (typeof v !== 'number') { pen = false; return; }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    pen = true;
  });
  return d;
}

/**
 * The streams over distance or time as small multiples: one panel and one y-axis per stream, a shared x-axis and
 * one crosshair through all panels. The crosshair also moves the dot on the route map. Toggles per stream, a
 * smoothing window, and keyboard reading (arrows; Shift for 10 points).
 */
export default function StreamCharts({
  series, layout, sportColor, avgs,
}: {
  series: Series;
  layout: Layout;
  sportColor: string;
  avgs: { speed: number | null; gap: number | null; hr: number | null; cad: number | null; watts: number | null; temp: number | null };
}) {
  const [ref, width] = useMeasure<HTMLDivElement>();
  const { index: hover, setIndex: setHover, range, pinned, togglePin } = useActivityHover();
  const hasDistance = Boolean(series.d?.some((v) => typeof v === 'number' && v > 0));
  const [xMode, setXMode] = useState<'distance' | 'time'>(hasDistance ? 'distance' : 'time');
  const [smoothS, setSmoothS] = useState(30);
  const [off, setOff] = useState<Set<string>>(new Set());

  const panels = useMemo(() => {
    const t = series.t;
    const sm = (v: Vals | null) => (v ? (smoothS ? smooth(v, t, smoothS) : v) : null);
    const foot = layout === 'run';
    const list: (Panel | null)[] = [
      foot && series.speed
        ? {
            key: 'pace', label: 'Pace', unit: '/km', color: sportColor, values: sm(series.speed)!.map(paceOf), invert: true, fmt: duration,
            avg: avgs.speed ? 1000 / avgs.speed : null,
            overlay: series.gap ? { key: 'gap', label: 'GAP', values: sm(series.gap)!.map(paceOf), color: 'var(--viz-gap)' } : undefined,
            overlayAvg: avgs.gap ? 1000 / avgs.gap : null,
          }
        : null,
      !foot && series.speed && series.speed.some((v) => (v ?? 0) > 0)
        ? { key: 'speed', label: 'Speed', unit: 'km/h', color: sportColor, values: sm(series.speed)!.map((v) => (v == null ? null : v * 3.6)), fmt: (v) => v.toFixed(1), avg: avgs.speed ? avgs.speed * 3.6 : null }
        : null,
      layout === 'ride' && series.watts ? { key: 'watts', label: 'Power', unit: 'W', color: 'var(--viz-power)', values: sm(series.watts)!, fmt: round, avg: avgs.watts } : null,
      series.hr ? { key: 'hr', label: 'Heart rate', unit: 'bpm', color: 'var(--viz-hr)', values: sm(series.hr)!, fmt: round, avg: avgs.hr } : null,
      series.cad ? { key: 'cad', label: 'Cadence', unit: foot ? 'spm' : 'rpm', color: 'var(--viz-cadence)', values: sm(series.cad)!, fmt: round, avg: avgs.cad } : null,
      layout === 'run' && series.watts ? { key: 'watts', label: 'Power', unit: 'W', color: 'var(--viz-power)', values: sm(series.watts)!, fmt: round, avg: avgs.watts } : null,
      series.temp ? { key: 'temp', label: 'Temperature', unit: '°C', color: 'var(--viz-temp)', values: series.temp, fmt: (v) => v.toFixed(0), avg: avgs.temp } : null,
      series.alt ? { key: 'alt', label: 'Elevation', unit: 'm', color: 'var(--viz-elev)', values: series.alt, area: true, fmt: round, avg: null } : null,
    ];
    return list.filter((p): p is Panel => p !== null && p.values.filter((v) => typeof v === 'number').length > 1);
  }, [series, layout, sportColor, avgs, smoothS]);

  const shown = panels.filter((p) => !off.has(p.key));
  const n = series.t.length;
  const xs: number[] = useMemo(() => {
    if (xMode === 'time') return series.t.map((t) => t - series.t[0]);
    let last = 0;
    return (series.d ?? []).map((v) => (typeof v === 'number' ? (last = v / 1000) : last));
  }, [series, xMode]);
  const xMax = Math.max(1e-6, xs[xs.length - 1] ?? 1);

  const narrow = width < 520;

  const M = { left: narrow ? 40 : 48, right: 12, top: 8 };
  const PH = narrow ? 72 : 88;
  const HEAD = 20;
  const GAP = 10;
  const XAX = 22;
  const plotW = width - M.left - M.right;
  const x = (i: number) => M.left + (xs[i] / xMax) * plotW;
  const H = M.top + shown.length * (HEAD + PH + GAP) + XAX;
  // The highlighted lap, split or segment (from a table row), as x positions.
  const band = range && range.from < n ? { x0: x(range.from), x1: x(Math.min(n - 1, range.to)) } : null;

  const xTicks =
    xMode === 'distance'
      ? niceTicks(xMax, narrow ? 4 : 8).filter((v) => v <= xMax)
      : (() => {
          const step = [300, 600, 900, 1200, 1800, 3600, 7200].find((s) => xMax / s <= (narrow ? 4 : 8)) ?? 7200;
          const out: number[] = [];
          for (let v = 0; v <= xMax; v += step) out.push(v);
          return out;
        })();
  const xLabel = (v: number) => (xMode === 'distance' ? `${Math.round(v * 10) / 10} km` : duration(v));

  function indexAt(px: number) {
    const target = ((px - M.left) / plotW) * xMax;
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    setHover(px < M.left - 4 || px > M.left + plotW + 4 ? null : indexAt(px));
  }
  function onKey(e: React.KeyboardEvent) {
    const big = e.shiftKey ? 10 : 1;
    const step = e.key === 'ArrowLeft' ? -big : e.key === 'ArrowRight' ? big : 0;
    if (e.key === 'Home') { e.preventDefault(); setHover(0); return; }
    if (e.key === 'End') { e.preventDefault(); setHover(n - 1); return; }
    if (e.key === 'Escape') { setHover(null); return; }
    if (!step) return;
    e.preventDefault();
    setHover(Math.min(n - 1, Math.max(0, (hover ?? -1) + step)));
  }

  const toggle = (k: string) =>
    setOff((s) => {
      const next = new Set(s);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const at = hover != null && hover < n ? hover : null;
  const rows =
    at == null
      ? []
      : shown.flatMap((p) => {
          const v = p.values[at];
          const o = p.overlay && !off.has(p.overlay.key) ? p.overlay.values[at] : null;
          return [
            ...(typeof v === 'number' ? [{ key: p.key, label: `${p.label.toLowerCase()} ${p.unit}`, value: p.fmt(v), color: p.color, strong: p.key === 'pace' || p.key === 'speed' }] : []),
            ...(p.overlay && typeof o === 'number' ? [{ key: p.overlay.key, label: `${p.overlay.label} ${p.unit}`, value: p.fmt(o), color: p.overlay.color }] : []),
          ];
        });
  const title =
    at == null ? '' : `${hasDistance && series.d?.[at] != null ? `${((series.d[at] as number) / 1000).toFixed(2)} km · ` : ''}${duration(series.t[at] - series.t[0])}`;

  const aria = `Streams over ${xMode}: ${shown.map((p) => `${p.label}${p.avg != null ? ` average ${p.fmt(p.avg)} ${p.unit}` : ''}`).join('; ')}. Use the arrow keys to read the values, Shift for bigger steps.`;

  return (
    <div className="rounded-lg border bg-[var(--viz-surface)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Streams">
          {panels.flatMap((p) => [{ key: p.key, label: p.label, color: p.color }, ...(p.overlay ? [{ key: p.overlay.key, label: p.overlay.label, color: p.overlay.color }] : [])]).map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={!off.has(p.key)}
              onClick={() => toggle(p.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${off.has(p.key) ? 'text-[var(--viz-muted)] opacity-70' : 'bg-muted/60 text-[var(--viz-ink)]'}`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: off.has(p.key) ? 'transparent' : p.color, border: `1.5px solid ${p.color}` }} />
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {hasDistance && (
            <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="X axis">
              {(['distance', 'time'] as const).map((m) => (
                <button key={m} type="button" aria-pressed={xMode === m} onClick={() => setXMode(m)}
                  className={`rounded px-2 py-0.5 capitalize ${xMode === m ? 'bg-muted font-medium text-[var(--viz-ink)]' : 'text-[var(--viz-muted)]'}`}>
                  {m}
                </button>
              ))}
            </div>
          )}
          <label className="inline-flex items-center gap-1 text-[var(--viz-muted)]">
            Smoothing
            <select value={smoothS} onChange={(e) => setSmoothS(Number(e.target.value))} className="rounded border bg-background px-1 py-0.5 text-[var(--viz-ink)]">
              {SMOOTHING.map((s) => <option key={s.s} value={s.s}>{s.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      {range && (
        <p className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--viz-ink-2)]" role="status">
          <span className="inline-block h-2.5 w-4 rounded-[2px] border border-[var(--viz-ink-2)] bg-[var(--viz-band)]" aria-hidden />
          {range.label}
          {pinned === range.key && (
            <button type="button" onClick={() => togglePin(range)} className="rounded border px-1.5 py-0.5 text-[var(--viz-ink)] hover:bg-accent">
              Unpin
            </button>
          )}
        </p>
      )}
      <div ref={ref} className="relative">
        <svg
          width={width}
          height={H}
          role="img"
          aria-label={aria}
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          className="touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-[var(--viz-ctl)]"
        >
          {shown.map((p, k) => {
            const top = M.top + k * (HEAD + PH + GAP) + HEAD;
            const dom = domain(p);
            if (!dom) return null;
            const y = (v: number) => (p.invert ? top + ((v - dom.lo) / (dom.hi - dom.lo)) * PH : top + PH - ((v - dom.lo) / (dom.hi - dom.lo)) * PH);
            const clampY = (v: number) => Math.max(top, Math.min(top + PH, y(v)));
            const ticks = p.invert ? [dom.lo + (dom.hi - dom.lo) * 0.15, (dom.lo + dom.hi) / 2, dom.hi - (dom.hi - dom.lo) * 0.15] : niceTicks(dom.hi, 2, dom.lo).filter((t) => t >= dom.lo && t <= dom.hi);
            const line = pathOf(p.values, x, clampY);
            const area = p.area && line ? `${line}L${x(n - 1).toFixed(1)},${top + PH}L${x(0).toFixed(1)},${top + PH}Z` : '';
            const v = at != null ? p.values[at] : null;
            const ov = at != null && p.overlay ? p.overlay.values[at] : null;
            const overlayOn = p.overlay && !off.has(p.overlay.key);
            return (
              <g key={p.key}>
                {band && (
                  <g pointerEvents="none">
                    <rect x={band.x0} y={top} width={Math.max(2, band.x1 - band.x0)} height={PH} fill="var(--viz-ink)" opacity={0.08} />
                    <line x1={band.x0} x2={band.x0} y1={top} y2={top + PH} stroke="var(--viz-ink-2)" strokeWidth={1} opacity={0.7} />
                    <line x1={band.x1} x2={band.x1} y1={top} y2={top + PH} stroke="var(--viz-ink-2)" strokeWidth={1} opacity={0.7} />
                  </g>
                )}
                <text x={M.left} y={top - 6} className="fill-[var(--viz-ink)] text-[12px] font-medium">
                  {p.label}
                  <tspan className="fill-[var(--viz-ink-2)] font-normal" dx={8}>
                    {typeof v === 'number' ? `${p.fmt(v)} ${p.unit}` : p.avg != null ? `avg ${p.fmt(p.avg)} ${p.unit}` : p.unit}
                  </tspan>
                  {overlayOn && (
                    <tspan className="fill-[var(--viz-muted)] font-normal" dx={8}>
                      {typeof ov === 'number' ? `GAP ${p.fmt(ov)}` : p.overlayAvg != null ? `GAP avg ${p.fmt(p.overlayAvg)}` : ''}
                    </tspan>
                  )}
                </text>
                <line x1={M.left} x2={M.left + plotW} y1={top + PH} y2={top + PH} stroke="var(--viz-axis)" strokeWidth={1} />
                {ticks.map((t) => (
                  <g key={t}>
                    <line x1={M.left} x2={M.left + plotW} y1={y(t)} y2={y(t)} stroke="var(--viz-grid)" strokeWidth={1} />
                    <text x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[var(--viz-muted)] text-[10px] tabular-nums">{p.fmt(t)}</text>
                  </g>
                ))}
                {area && <path d={area} fill="var(--viz-elev)" opacity={0.7} />}
                {overlayOn && p.overlay && (
                  <path d={pathOf(p.overlay.values, x, clampY)} fill="none" stroke={p.overlay.color} strokeWidth={1.25} strokeLinejoin="round" opacity={0.75} />
                )}
                {!p.area && <path d={line} fill="none" stroke={p.color} strokeWidth={1.75} strokeLinejoin="round" />}
                {at != null && typeof v === 'number' && (
                  <circle cx={x(at)} cy={clampY(v)} r={4} fill={p.area ? 'var(--viz-ink-2)' : p.color} stroke="var(--viz-surface)" strokeWidth={2} pointerEvents="none" />
                )}
              </g>
            );
          })}
          {xTicks.map((t) => (
            <text key={t} x={M.left + (t / xMax) * plotW} y={H - 6} textAnchor="middle" className="fill-[var(--viz-muted)] text-[10px] tabular-nums">{xLabel(t)}</text>
          ))}
          {at != null && (
            <line x1={x(at)} x2={x(at)} y1={M.top + HEAD} y2={H - XAX} stroke="var(--viz-ink-2)" strokeWidth={1} opacity={0.6} pointerEvents="none" />
          )}
        </svg>
        {at != null && rows.length > 0 && <ChartTooltip x={x(at)} y={M.top + HEAD} width={width} title={title} rows={rows} />}
      </div>
      {shown.length === 0 && <p className="text-sm text-[var(--viz-muted)]">Every stream is off. Turn one on above.</p>}
      {panels.some((p) => p.overlay) && (
        <div className="mt-2 flex flex-wrap gap-3">
          <LegendItem color={sportColor} label="Pace" shape="line" />
          <LegendItem color="var(--viz-gap)" label="Grade-adjusted pace (GAP)" shape="line" />
        </div>
      )}
    </div>
  );
}
