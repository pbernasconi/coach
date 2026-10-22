'use client';

import { useMemo } from 'react';
import { useMeasure } from '@/components/charts/useMeasure';
import { int, pace } from '@/lib/activity/format.mjs';
import { profileAt, profileSeries } from '@/lib/activity/profile.mjs';
import type { Series } from '@/lib/activity/queries';
import { useActivityHover } from './ActivityHover';

/**
 * Elevation (grey area) with pace or speed (line) over distance, made to sit under the route map, as on Strava.
 * Pointing at it, or dragging a finger across it, moves the dot on the map and shows time, distance, elevation,
 * grade, pace and heart rate there. The arrow keys step through it.
 */
export default function RouteProfile({ series, foot, color, height = 150 }: { series: Series; foot: boolean; color: string; height?: number }) {
  const [ref, width] = useMeasure<HTMLDivElement>(640, 200);
  const { index, setIndex, range } = useActivityHover();
  // Slower than this is a stop (lights, a walk break): the line breaks there instead of diving to the bottom.
  const moving = foot ? 1.6 : 1.0;
  const { speed } = useMemo(() => profileSeries(series, moving), [series, moving]);
  const d = series.d;
  const n = series.t.length;

  const view = useMemo(() => {
    if (!d) return null;
    let last = 0;
    const xs = d.map((v) => (typeof v === 'number' ? (last = v) : last));
    const xMax = Math.max(1, xs[xs.length - 1]);
    const alts = (series.alt ?? []).filter((v): v is number => typeof v === 'number');
    const aLo = alts.length ? Math.min(...alts) : 0;
    const aHi = alts.length ? Math.max(...alts) : 1;
    const aSpan = Math.max(20, aHi - aLo);
    // Pace: robust range (stops make huge paces), faster at the top.
    const paces = (speed ?? []).filter((v): v is number => typeof v === 'number' && v >= moving).map((v) => (foot ? 1000 / v : v * 3.6)).sort((a, b) => a - b);
    const p1 = paces.length ? paces[Math.floor(paces.length * 0.01)] : 0;
    const p99 = paces.length ? paces[Math.floor(paces.length * 0.99)] : 1;
    const pad = (p99 - p1) * 0.08;
    const pLo = Math.max(0, p1 - pad);
    const pHi = p99 + pad;
    return { xs, xMax, aLo, aHi, aSpan, pLo, pHi: Math.max(pHi, pLo + 1) };
  }, [d, series.alt, speed, foot, moving]);

  if (!view || n < 10) return null;
  const M = { l: 4, r: 4, t: 8, b: 18 };
  const plotW = width - M.l - M.r;
  const plotH = height - M.t - M.b;
  const x = (i: number) => M.l + (view.xs[i] / view.xMax) * plotW;
  const yA = (a: number) => M.t + plotH - ((a - view.aLo) / view.aSpan) * plotH * 0.6;
  const val = (v: number) => (foot ? 1000 / v : v * 3.6);
  const yP = (v: number) => {
    const p = Math.max(view.pLo, Math.min(view.pHi, val(v)));
    const f = (p - view.pLo) / (view.pHi - view.pLo);
    return M.t + (foot ? f : 1 - f) * plotH;
  };

  let area = '';
  if (series.alt) {
    let pen = false;
    let first = -1;
    let lastI = -1;
    series.alt.forEach((a, i) => {
      if (typeof a !== 'number') return;
      if (first < 0) first = i;
      lastI = i;
      area += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${yA(a).toFixed(1)}`;
      pen = true;
    });
    if (first >= 0) area += `L${x(lastI).toFixed(1)},${M.t + plotH}L${x(first).toFixed(1)},${M.t + plotH}Z`;
  }
  let line = '';
  if (speed) {
    let pen = false;
    speed.forEach((v, i) => {
      if (typeof v !== 'number' || v < moving) { pen = false; return; }
      line += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${yP(v).toFixed(1)}`;
      pen = true;
    });
  }

  function indexAt(px: number) {
    const target = ((px - M.l) / plotW) * view!.xMax;
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (view!.xs[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setIndex(indexAt(Math.max(M.l, Math.min(M.l + plotW, e.clientX - r.left))));
  };
  const onKey = (e: React.KeyboardEvent) => {
    const step = (e.shiftKey ? 10 : 1) * (e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0);
    if (e.key === 'Escape') return setIndex(null);
    if (!step) return;
    e.preventDefault();
    setIndex(Math.min(n - 1, Math.max(0, (index ?? -1) + step)));
  };

  const at = index != null && index < n ? index : null;
  const tip = at != null ? profileAt(series, speed, at, foot) : null;
  const band = range && range.from < n ? { x0: x(range.from), x1: x(Math.min(n - 1, range.to)) } : null;
  const km = view.xMax / 1000;
  const step = [0.5, 1, 2, 5, 10, 20, 50].find((s) => km / s <= (width < 480 ? 4 : 9)) ?? 50;
  const ticks: number[] = [];
  for (let k = 0; k <= km + 1e-9; k += step) ticks.push(k);
  const W = 168;
  const tipLeft = at != null ? (x(at) + 10 + W > width ? x(at) - 10 - W : x(at) + 10) : 0;

  return (
    <div className="rounded-lg border bg-[var(--viz-surface)] px-3 pb-1 pt-2">
      <div className="mb-1 flex items-center justify-between text-xs text-[var(--viz-muted)]">
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-3 rounded-[2px] bg-[var(--viz-elev)]" />Elevation</span>
          {line && <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 rounded-full" style={{ background: color }} />{foot ? 'Pace' : 'Speed'}</span>}
        </span>
        <span className="tabular-nums">
          {int(view.aLo)}–{int(view.aHi)} m
          {line && ` · ${foot ? `${pace(1000 / view.pLo)}–${pace(1000 / view.pHi)} /km` : `${view.pLo.toFixed(0)}–${view.pHi.toFixed(0)} km/h`}`}
        </span>
      </div>
      <div
        ref={ref}
        className="relative cursor-crosshair touch-pan-y select-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--viz-ctl)]"
        tabIndex={0}
        role="img"
        aria-label={`Elevation${line ? ` and ${foot ? 'pace' : 'speed'}` : ''} over ${km.toFixed(1)} km. Point at it or use the arrow keys to show a point on the map.`}
        onPointerDown={move}
        onPointerMove={move}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') setIndex(null); }}
        onKeyDown={onKey}
        onBlur={() => setIndex(null)}
      >
        <svg width={width} height={height} className="block max-w-full" aria-hidden>
          {band && <rect x={band.x0} y={M.t} width={Math.max(2, band.x1 - band.x0)} height={plotH} fill="var(--viz-band)" stroke="var(--viz-ink-2)" strokeOpacity={0.4} />}
          {area && <path d={area} fill="var(--viz-elev)" fillOpacity={0.8} />}
          {line && <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />}
          <line x1={M.l} x2={M.l + plotW} y1={M.t + plotH} y2={M.t + plotH} stroke="var(--viz-axis)" />
          {ticks.map((k) => {
            const tx = M.l + ((k * 1000) / view.xMax) * plotW;
            return (
              <text key={k} x={Math.min(Math.max(tx, M.l + 12), M.l + plotW - 14)} y={height - 4} textAnchor="middle" fontSize={10} fill="var(--viz-muted)" className="tabular-nums">
                {k} km
              </text>
            );
          })}
          {at != null && (
            <g pointerEvents="none">
              <line x1={x(at)} x2={x(at)} y1={M.t} y2={M.t + plotH} stroke="var(--viz-ink)" strokeWidth={1} />
              {typeof speed?.[at] === 'number' && speed[at]! >= moving && <circle cx={x(at)} cy={yP(speed[at]!)} r={3.5} fill={color} stroke="var(--viz-surface)" strokeWidth={1.5} />}
            </g>
          )}
        </svg>
        {tip && (
          <div role="status" className="pointer-events-none absolute top-1 z-10 rounded-md border bg-[var(--viz-surface)] px-2.5 py-1.5 text-xs shadow-md" style={{ left: Math.max(0, tipLeft), width: W }}>
            <div className="mb-0.5 font-medium tabular-nums text-[var(--viz-ink-2)]">{tip.title}</div>
            {tip.rows.map((r) => (
              <div key={r.key} className="flex justify-between gap-2 tabular-nums">
                <span className="text-[var(--viz-muted)]">{r.label}</span>
                <span className="font-semibold text-[var(--viz-ink)]">{r.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
