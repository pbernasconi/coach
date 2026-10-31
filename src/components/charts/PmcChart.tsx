'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import { HelpTooltip, Tabs, TabsContent, TabsList, TabsTrigger, useStoredValue } from '@kobo/web';
import { ChartTooltip, LegendItem } from './ChartTooltip';
import { niceTicks, useMeasure } from './useMeasure';
import { FORM_ZONES as ZONES, zoneOf } from '@/lib/performance/form';
import { DEFAULT_PMC_RANGE, PMC_RANGES, daysInRange, isPmcRange, pmcAxis } from '@/lib/performance/pmc-range.mjs';

export type PmcChartDay = { date: string; ctl: number; atl: number; tsb: number; tss: number; projected: boolean };
export type PmcChartEvent = { id: string; name: string; date: string; priority: 'A' | 'B' | 'C' };

const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const signed = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n)}`;
const line = (pts: [number, number][]) => pts.map(([a, b], i) => `${i ? 'L' : 'M'}${a.toFixed(1)},${b.toFixed(1)}`).join('');
const DASH = '5 4';

/**
 * The Performance Management Chart with the plan's projection: fitness (CTL) and fatigue (ATL) on one TSS-per-day
 * scale, form (TSB) in its own panel under it. Days after today are dashed on a shaded background; a line marks
 * today, and thin vertical lines mark events (A events are labeled). One crosshair runs through both panels.
 * A timeframe control (90 days, 180 days, 1 year, all; remembered in this browser) sets how far back it reaches;
 * the projection always shows.
 */
export default function PmcChart({ days: allDays, today, events = [], note }: { days: PmcChartDay[]; today: string; events?: PmcChartEvent[]; note?: string | null }) {
  const [ref, width] = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [range, setRange] = useStoredValue('coach.pmc.range', DEFAULT_PMC_RANGE, isPmcRange);
  const days = daysInRange(allDays, today, range);
  if (days.length < 2) return null;

  const narrow = width < 520;
  const M = { top: 30, right: narrow ? 12 : 92, left: 36 };
  const H1 = narrow ? 170 : 210;
  const GAPP = 26;
  const H2 = narrow ? 100 : 120;
  const XAX = 26;
  const plotW = width - M.left - M.right;
  const x = (i: number) => M.left + (i / (days.length - 1)) * plotW;
  const index = new Map(days.map((d, i) => [d.date, i]));

  const t1 = niceTicks(Math.max(10, ...days.map((d) => Math.max(d.ctl, d.atl))), 5);
  const y1 = (v: number) => M.top + H1 - (v / t1[t1.length - 1]) * H1;
  const tsbLo = Math.min(-35, ...days.map((d) => d.tsb));
  const tsbHi = Math.max(20, ...days.map((d) => d.tsb));
  const top2 = M.top + H1 + GAPP;
  const y2 = (v: number) => top2 + H2 - ((v - tsbLo) / (tsbHi - tsbLo)) * H2;
  const t2 = (narrow ? [-30, 0, 20] : [-30, -10, 0, 20]).filter((t) => t >= tsbLo && t <= tsbHi);
  const zeroY = y2(0);

  // The last actual day; the projection starts there so both segments join.
  const lastActual = days.reduce((k, d, i) => (d.projected ? k : i), -1);
  const split = Math.max(0, lastActual);
  const actual = days.slice(0, split + 1).map((d, i) => ({ d, i }));
  const future = lastActual < days.length - 1 ? days.slice(split).map((d, k) => ({ d, i: split + k })) : [];
  const path = (pts: { d: PmcChartDay; i: number }[], f: (d: PmcChartDay) => number, y: (v: number) => number) =>
    line(pts.map(({ d, i }) => [x(i), y(f(d))]));
  const ctlArea = actual.length > 1 ? `${path(actual, (d) => d.ctl, y1)}L${x(split)},${y1(0)}L${x(0)},${y1(0)}Z` : '';
  const tsbArea = actual.length > 1 ? `${path(actual, (d) => d.tsb, y2)}L${x(split)},${zeroY}L${x(0)},${zeroY}Z` : '';

  const todayI = index.get(today) ?? (today > days[days.length - 1].date ? null : 0);
  const futureX = future.length ? x(split) : null;
  const marks = events.filter((e) => index.has(e.date)).map((e) => ({ ...e, i: index.get(e.date)! }));

  const axis = pmcAxis(days, plotW);
  const H = top2 + H2 + XAX;
  const end = days[days.length - 1];
  const now = days[split];
  const endLabels = !narrow && Math.abs(y1(end.ctl) - y1(end.atl)) >= 14;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left - M.left) / plotW) * (days.length - 1));
    setHover(i < 0 || i >= days.length ? null : i);
  }
  function onKey(e: React.KeyboardEvent) {
    const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : e.key === 'PageUp' ? -7 : e.key === 'PageDown' ? 7 : 0;
    if (e.key === 'Home') { e.preventDefault(); setHover(split); return; }
    if (!step) return;
    e.preventDefault();
    setHover((h) => Math.min(days.length - 1, Math.max(0, (h ?? split) + step)));
  }
  const h = hover === null ? null : days[hover];
  const hoverEvents = h ? events.filter((e) => e.date === h.date) : [];
  const nextA = marks.find((m) => m.priority === 'A');

  const aria =
    `Fitness, fatigue and form. Today: fitness ${Math.round(now.ctl)}, fatigue ${Math.round(now.atl)}, form ${signed(now.tsb)} (${zoneOf(now.tsb)}).` +
    (future.length ? ` Projected to ${fmtDay(end.date)}: fitness ${Math.round(end.ctl)}, form ${signed(end.tsb)}.` : '') +
    (nextA ? ` ${nextA.name} on ${fmtDay(nextA.date)}: projected form ${signed(days[nextA.i].tsb)}.` : '') +
    ' Use arrow keys to read days, Page Up and Page Down for weeks, Home for today.';

  return (
    <Tabs value={range} onValueChange={(v) => { if (isPmcRange(v)) { setRange(v); setHover(null); } }} className="rounded-lg border bg-[var(--viz-surface)] p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="inline-flex items-center gap-1.5 font-semibold text-[var(--viz-ink)]">
          Fitness, fatigue and form
          <HelpTooltip label="About this chart" icon={<Info aria-hidden />}>
            Daily training load from Strava. {future.length ? 'Dashed: projected from the planned workouts. ' : ''}Form = fitness − fatigue.
            {note ? ` ${note}` : ''}
          </HelpTooltip>
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <LegendItem color="var(--viz-ctl)" label="Fitness (CTL)" shape="line" />
          <LegendItem color="var(--viz-atl)" label="Fatigue (ATL)" shape="line" />
          <LegendItem color="var(--viz-tsb)" label="Form (TSB)" shape="line" />
          {future.length > 0 && (
            <LegendItem
              label="Projected"
              icon={<svg width={14} height={4} aria-hidden><line x1={0} x2={14} y1={2} y2={2} stroke="var(--viz-ink-2)" strokeWidth={2} strokeDasharray="3 2" /></svg>}
            />
          )}
          <TabsList aria-label="Timeframe" className="ml-1 h-8">
            {PMC_RANGES.map((r) => (
              <TabsTrigger key={r.id} value={r.id} className="px-2.5 py-0.5 text-[12px]">{r.label}</TabsTrigger>
            ))}
          </TabsList>
        </div>
      </div>
      <TabsContent value={range} className="mt-0">
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
          className="max-w-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--viz-ctl)]"
        >
          {/* The future: a shaded background behind both panels */}
          {futureX !== null && (
            <>
              <rect x={futureX} y={M.top} width={M.left + plotW - futureX} height={H1} fill="var(--viz-band)" opacity={0.6} />
              <rect x={futureX} y={top2} width={M.left + plotW - futureX} height={H2} fill="var(--viz-band)" opacity={0.6} />
            </>
          )}

          {/* Panel 1 grid */}
          {axis.grid.map((i) => <line key={`g${days[i].date}`} x1={x(i)} x2={x(i)} y1={M.top} y2={M.top + H1} stroke="var(--viz-grid)" strokeWidth={1} opacity={0.6} />)}
          {t1.map((t) => (
            <g key={`t1${t}`}>
              <line x1={M.left} x2={M.left + plotW} y1={y1(t)} y2={y1(t)} stroke={t === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)'} strokeWidth={1} />
              <text x={M.left - 8} y={y1(t)} dy="0.32em" textAnchor="end" className="fill-[var(--viz-muted)] text-[11px] tabular-nums">{t}</text>
            </g>
          ))}

          {/* Panel 2: form zones */}
          {ZONES.filter((z) => z.shade).map((z) => {
            const a = y2(Math.min(tsbHi, z.to));
            const b = y2(Math.max(tsbLo, z.from));
            return <rect key={z.label} x={M.left} y={a} width={plotW} height={Math.max(0, b - a)} fill="var(--viz-band)" />;
          })}
          {!narrow && ZONES.map((z) => {
            const mid = (Math.max(tsbLo, z.from) + Math.min(tsbHi, z.to)) / 2;
            return <text key={`zl${z.label}`} x={M.left + plotW + 10} y={y2(mid)} dy="0.32em" className="fill-[var(--viz-muted)] text-[10px]">{z.label}</text>;
          })}
          {t2.map((t) => (
            <text key={`t2${t}`} x={M.left - 8} y={y2(t)} dy="0.32em" textAnchor="end" className="fill-[var(--viz-muted)] text-[11px] tabular-nums">{signed(t)}</text>
          ))}
          <line x1={M.left} x2={M.left + plotW} y1={zeroY} y2={zeroY} stroke="var(--viz-axis)" strokeWidth={1} />

          {/* Event markers: A solid, B and C dashed; labels for A events only */}
          {marks.map((m) => (
            <g key={m.id} pointerEvents="none">
              <line
                x1={x(m.i)} x2={x(m.i)} y1={M.top - 6} y2={top2 + H2}
                stroke={m.priority === 'A' ? 'var(--viz-ink-2)' : 'var(--viz-axis)'}
                strokeWidth={1}
                strokeDasharray={m.priority === 'A' ? undefined : '2 3'}
              />
              <circle cx={x(m.i)} cy={M.top - 6} r={3} fill={m.priority === 'A' ? 'var(--viz-ink)' : 'var(--viz-surface)'} stroke="var(--viz-ink-2)" strokeWidth={1.5} />
            </g>
          ))}
          {marks.filter((m) => m.priority === 'A').map((m) => {
            const anchor = x(m.i) > M.left + plotW - 80 ? 'end' : 'start';
            return (
              <text key={`el${m.id}`} x={x(m.i) + (anchor === 'end' ? -6 : 6)} y={M.top - 6} dy="0.32em" textAnchor={anchor} stroke="var(--viz-surface)" strokeWidth={4} paintOrder="stroke" strokeLinejoin="round" className="fill-[var(--viz-ink)] text-[11px] font-medium">
                {m.name.length > 22 ? `${m.name.slice(0, 21)}…` : m.name}
              </text>
            );
          })}

          {/* Today */}
          {todayI !== null && (
            <g pointerEvents="none">
              <line x1={x(todayI)} x2={x(todayI)} y1={M.top} y2={top2 + H2} stroke="var(--viz-ink)" strokeWidth={1} opacity={0.6} />
              <text x={x(todayI)} y={top2 + H2 + 18} textAnchor="middle" className="fill-[var(--viz-ink)] text-[11px] font-medium">Today</text>
            </g>
          )}

          {/* Series: actual solid, projected dashed and lighter */}
          {ctlArea && <path d={ctlArea} fill="var(--viz-ctl)" opacity={0.1} />}
          {tsbArea && <path d={tsbArea} fill="var(--viz-tsb)" opacity={0.08} />}
          <path d={path(actual, (d) => d.atl, y1)} fill="none" stroke="var(--viz-atl)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <path d={path(actual, (d) => d.ctl, y1)} fill="none" stroke="var(--viz-ctl)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          <path d={path(actual, (d) => d.tsb, y2)} fill="none" stroke="var(--viz-tsb)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {future.length > 0 && (
            <g opacity={0.75}>
              <path d={path(future, (d) => d.atl, y1)} fill="none" stroke="var(--viz-atl)" strokeWidth={2} strokeDasharray={DASH} strokeLinecap="round" />
              <path d={path(future, (d) => d.ctl, y1)} fill="none" stroke="var(--viz-ctl)" strokeWidth={2.5} strokeDasharray={DASH} strokeLinecap="round" />
              <path d={path(future, (d) => d.tsb, y2)} fill="none" stroke="var(--viz-tsb)" strokeWidth={2} strokeDasharray={DASH} strokeLinecap="round" />
            </g>
          )}
          {lastActual >= 0 && (
            <>
              <circle cx={x(split)} cy={y1(now.ctl)} r={4} fill="var(--viz-ctl)" stroke="var(--viz-surface)" strokeWidth={2} />
              <circle cx={x(split)} cy={y1(now.atl)} r={4} fill="var(--viz-atl)" stroke="var(--viz-surface)" strokeWidth={2} />
              <circle cx={x(split)} cy={y2(now.tsb)} r={4} fill="var(--viz-tsb)" stroke="var(--viz-surface)" strokeWidth={2} />
            </>
          )}
          {endLabels && (
            <>
              <text x={M.left + plotW + 10} y={y1(end.ctl)} dy="0.32em" className="fill-[var(--viz-ink)] text-[11px] font-medium">Fitness {Math.round(end.ctl)}</text>
              <text x={M.left + plotW + 10} y={y1(end.atl)} dy="0.32em" className="fill-[var(--viz-ink-2)] text-[11px]">Fatigue {Math.round(end.atl)}</text>
            </>
          )}

          {/* Shared x axis (month labels, skipped next to the today label) */}
          {axis.labels
            .filter(({ i }) => x(i) >= M.left + 14 && (todayI === null || Math.abs(x(i) - x(todayI)) > 30))
            .map(({ i, text }) => (
              <text key={`mo${days[i].date}`} x={x(i)} y={top2 + H2 + 18} textAnchor="middle" className="fill-[var(--viz-muted)] text-[11px]">
                {text}
              </text>
            ))}

          {/* Crosshair */}
          {h && hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={top2 + H2} stroke="var(--viz-ink-2)" strokeWidth={1} opacity={0.5} />
              <circle cx={x(hover)} cy={y1(h.ctl)} r={4} fill="var(--viz-ctl)" stroke="var(--viz-surface)" strokeWidth={2} />
              <circle cx={x(hover)} cy={y1(h.atl)} r={4} fill="var(--viz-atl)" stroke="var(--viz-surface)" strokeWidth={2} />
              <circle cx={x(hover)} cy={y2(h.tsb)} r={4} fill="var(--viz-tsb)" stroke="var(--viz-surface)" strokeWidth={2} />
            </g>
          )}
        </svg>
        {h && hover !== null && (
          <ChartTooltip
            x={x(hover)}
            y={M.top}
            width={width}
            title={`${fmtDay(h.date)}${h.projected ? ' · projected' : h.date === today ? ' · today' : ''}`}
            rows={[
              ...hoverEvents.map((e) => ({ key: `ev${e.id}`, label: `${e.priority} event`, value: e.name, strong: true })),
              { key: 'ctl', label: 'fitness (CTL)', value: String(Math.round(h.ctl)), color: 'var(--viz-ctl)', strong: !hoverEvents.length },
              { key: 'atl', label: 'fatigue (ATL)', value: String(Math.round(h.atl)), color: 'var(--viz-atl)' },
              { key: 'tsb', label: `form · ${zoneOf(h.tsb).toLowerCase()}`, value: signed(h.tsb), color: 'var(--viz-tsb)' },
              { key: 'tss', label: h.projected ? 'planned TSS' : 'TSS that day', value: String(Math.round(h.tss)) },
            ]}
          />
        )}
      </div>
      </TabsContent>
    </Tabs>
  );
}
