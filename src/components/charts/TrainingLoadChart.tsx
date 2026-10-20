'use client';

import { useState } from 'react';
import { ChartTooltip, LegendItem } from './ChartTooltip';
import { niceTicks, useMeasure } from './useMeasure';
import { FORM_ZONES as ZONES, zoneOf } from '@/lib/performance/form';

export type LoadDay = { date: string; ctl: number; atl: number; tsb: number; tss: number };

const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const signed = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n)}`;

/**
 * Fitness (CTL) and fatigue (ATL) on one TSS-per-day scale, and form (TSB = CTL - ATL) in its own panel
 * under it with the zone bands. One crosshair runs through both; the tooltip lists every value.
 */
export default function TrainingLoadChart({ days }: { days: LoadDay[] }) {
  const [ref, width] = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  if (days.length < 2) return null;

  const M = { top: 16, right: 92, left: 40 };
  const H1 = 210;
  const GAPP = 26;
  const H2 = 120;
  const XAX = 26;
  const plotW = width - M.left - M.right;
  const x = (i: number) => M.left + (i / (days.length - 1)) * plotW;

  const t1 = niceTicks(Math.max(...days.map((d) => Math.max(d.ctl, d.atl))), 5);
  const y1 = (v: number) => M.top + H1 - (v / t1[t1.length - 1]) * H1;

  const tsbLo = Math.min(-35, ...days.map((d) => d.tsb));
  const tsbHi = Math.max(20, ...days.map((d) => d.tsb));
  const top2 = M.top + H1 + GAPP;
  const y2 = (v: number) => top2 + H2 - ((v - tsbLo) / (tsbHi - tsbLo)) * H2;
  const t2 = [-30, -10, 0, 20].filter((t) => t >= tsbLo && t <= tsbHi);

  const line = (pts: [number, number][]) => pts.map(([a, b], i) => `${i ? 'L' : 'M'}${a.toFixed(1)},${b.toFixed(1)}`).join('');
  const ctlPath = line(days.map((d, i) => [x(i), y1(d.ctl)]));
  const atlPath = line(days.map((d, i) => [x(i), y1(d.atl)]));
  const ctlArea = `${ctlPath}L${x(days.length - 1)},${y1(0)}L${x(0)},${y1(0)}Z`;
  const tsbPath = line(days.map((d, i) => [x(i), y2(d.tsb)]));
  const zeroY = y2(0);
  const tsbArea = `${tsbPath}L${x(days.length - 1)},${zeroY}L${x(0)},${zeroY}Z`;

  // Month ticks on the 1st, and a faint line each Monday.
  const months = days.map((d, i) => ({ d, i })).filter(({ d }) => d.date.endsWith('-01'));
  const mondays = days.map((d, i) => ({ d, i })).filter(({ d }) => new Date(`${d.date}T12:00:00Z`).getUTCDay() === 1);

  const last = days[days.length - 1];
  const H = top2 + H2 + XAX;
  const endLabels = Math.abs(y1(last.ctl) - y1(last.atl)) >= 14;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.round(((px - M.left) / plotW) * (days.length - 1));
    setHover(i < 0 || i >= days.length ? null : i);
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setHover((h) => Math.min(days.length - 1, Math.max(0, (h ?? days.length - 1) + (e.key === 'ArrowLeft' ? -1 : 1))));
  }
  const h = hover === null ? null : days[hover];

  return (
    <div className="rounded-lg border bg-[var(--viz-surface)] p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-semibold text-[var(--viz-ink)]">Fitness, fatigue and form</h2>
          <p className="text-xs text-[var(--viz-muted)]">Daily training load from Strava (power, else heart rate). Form = fitness − fatigue.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <LegendItem color="var(--viz-ctl)" label="Fitness (CTL, 42-day)" shape="line" />
          <LegendItem color="var(--viz-atl)" label="Fatigue (ATL, 7-day)" shape="line" />
          <LegendItem color="var(--viz-tsb)" label="Form (TSB)" shape="line" />
        </div>
      </div>
      <div ref={ref} className="relative">
        <svg
          width={width}
          height={H}
          role="img"
          aria-label={`Training load. Latest: fitness ${Math.round(last.ctl)}, fatigue ${Math.round(last.atl)}, form ${signed(last.tsb)} (${zoneOf(last.tsb)}). Use arrow keys to read days.`}
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          className="outline-none focus-visible:ring-2 focus-visible:ring-[var(--viz-ctl)]"
        >
          {/* Panel 1 grid */}
          {mondays.map(({ i, d }) => <line key={`m${d.date}`} x1={x(i)} x2={x(i)} y1={M.top} y2={M.top + H1} stroke="var(--viz-grid)" strokeWidth={1} opacity={0.6} />)}
          {t1.map((t) => (
            <g key={`t1${t}`}>
              <line x1={M.left} x2={M.left + plotW} y1={y1(t)} y2={y1(t)} stroke={t === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)'} strokeWidth={1} />
              <text x={M.left - 8} y={y1(t)} dy="0.32em" textAnchor="end" className="fill-[var(--viz-muted)] text-[11px] tabular-nums">{t}</text>
            </g>
          ))}
          <path d={ctlArea} fill="var(--viz-ctl)" opacity={0.1} />
          <path d={atlPath} fill="none" stroke="var(--viz-atl)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <path d={ctlPath} fill="none" stroke="var(--viz-ctl)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(days.length - 1)} cy={y1(last.ctl)} r={4} fill="var(--viz-ctl)" stroke="var(--viz-surface)" strokeWidth={2} />
          <circle cx={x(days.length - 1)} cy={y1(last.atl)} r={4} fill="var(--viz-atl)" stroke="var(--viz-surface)" strokeWidth={2} />
          {endLabels && (
            <>
              <text x={M.left + plotW + 10} y={y1(last.ctl)} dy="0.32em" className="fill-[var(--viz-ink)] text-[11px] font-medium">Fitness {Math.round(last.ctl)}</text>
              <text x={M.left + plotW + 10} y={y1(last.atl)} dy="0.32em" className="fill-[var(--viz-ink-2)] text-[11px]">Fatigue {Math.round(last.atl)}</text>
            </>
          )}

          {/* Panel 2: form with zone bands */}
          {ZONES.filter((z) => z.shade).map((z) => {
            const a = y2(Math.min(tsbHi, z.to));
            const b = y2(Math.max(tsbLo, z.from));
            return <rect key={z.label} x={M.left} y={a} width={plotW} height={Math.max(0, b - a)} fill="var(--viz-band)" />;
          })}
          {ZONES.map((z) => {
            const mid = (Math.max(tsbLo, z.from) + Math.min(tsbHi, z.to)) / 2;
            return (
              <text key={`zl${z.label}`} x={M.left + plotW + 10} y={y2(mid)} dy="0.32em" className="fill-[var(--viz-muted)] text-[10px]">{z.label}</text>
            );
          })}
          {t2.map((t) => (
            <text key={`t2${t}`} x={M.left - 8} y={y2(t)} dy="0.32em" textAnchor="end" className="fill-[var(--viz-muted)] text-[11px] tabular-nums">{signed(t)}</text>
          ))}
          <line x1={M.left} x2={M.left + plotW} y1={zeroY} y2={zeroY} stroke="var(--viz-axis)" strokeWidth={1} />
          <path d={tsbArea} fill="var(--viz-tsb)" opacity={0.08} />
          <path d={tsbPath} fill="none" stroke="var(--viz-tsb)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(days.length - 1)} cy={y2(last.tsb)} r={4} fill="var(--viz-tsb)" stroke="var(--viz-surface)" strokeWidth={2} />

          {/* Shared x axis */}
          {months.map(({ i, d }) => (
            <text key={`mo${d.date}`} x={x(i)} y={top2 + H2 + 18} textAnchor="middle" className="fill-[var(--viz-muted)] text-[11px]">
              {new Date(`${d.date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}
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
            title={fmtDay(h.date)}
            rows={[
              { key: 'ctl', label: 'fitness (CTL)', value: String(Math.round(h.ctl)), color: 'var(--viz-ctl)', strong: true },
              { key: 'atl', label: 'fatigue (ATL)', value: String(Math.round(h.atl)), color: 'var(--viz-atl)' },
              { key: 'tsb', label: `form · ${zoneOf(h.tsb).toLowerCase()}`, value: signed(h.tsb), color: 'var(--viz-tsb)' },
              { key: 'tss', label: 'TSS that day', value: String(Math.round(h.tss)) },
            ]}
          />
        )}
      </div>
    </div>
  );
}
