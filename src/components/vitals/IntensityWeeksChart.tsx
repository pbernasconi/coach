'use client';

import { useState } from 'react';
import { ChartTooltip, LegendItem } from '@/components/charts/ChartTooltip';
import { niceTicks, useMeasure } from '@/components/charts/useMeasure';

export type IntensityWeek = { week: string; moderate: number; vigorous: number; total: number; days: number };

const fmtWeek = (w: string) => new Date(`${w}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * Intensity minutes per week against the 150-minute goal, counted the way Garmin does: vigorous minutes twice.
 * Bars stack moderate and vigorous (×2). The current week is lighter: it is still in progress.
 */
export default function IntensityWeeksChart({ weeks, goal = 150 }: { weeks: IntensityWeek[]; goal?: number }) {
  const [ref, width] = useMeasure<HTMLDivElement>(320);
  const [hover, setHover] = useState<number | null>(null);
  const M = { top: 12, right: 44, bottom: 22, left: 36 };
  const H = 180;
  const plotW = width - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const ticks = niceTicks(Math.max(goal * 1.2, ...weeks.map((w) => w.total)), 3);
  const yMax = ticks[ticks.length - 1];
  const y = (v: number) => M.top + plotH - (v / yMax) * plotH;
  const band = plotW / Math.max(1, weeks.length);
  const barW = Math.min(22, band * 0.6);
  const met = weeks.slice(0, -1).filter((w) => w.total >= goal).length;
  const h = hover === null ? null : weeks[hover];
  const hasData = weeks.some((w) => w.days > 0);

  return (
    <div className="rounded-lg border bg-[var(--viz-surface)] p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-semibold text-[var(--viz-ink)]">Intensity minutes per week</h3>
          <p className="text-xs text-[var(--viz-muted)]">Goal {goal} min. Vigorous minutes count twice, as on Garmin.</p>
        </div>
        {hasData && <span className="text-xs text-[var(--viz-ink-2)]">Goal met {met} of {weeks.length - 1} full weeks</span>}
      </div>
      <div className="mb-1 flex flex-wrap gap-3">
        <LegendItem color="var(--viz-run)" label="Moderate" />
        <LegendItem color="var(--viz-ride)" label="Vigorous (×2)" />
        <LegendItem color="var(--viz-ink-2)" label={`Goal ${goal}`} shape="line" />
      </div>
      <div ref={ref} className="relative" onPointerLeave={() => setHover(null)}>
        {!hasData ? (
          <div className="flex h-[180px] items-center justify-center rounded-md bg-[var(--viz-band)] text-xs text-[var(--viz-muted)]">No intensity minutes from Garmin yet.</div>
        ) : (
          <svg className="max-w-full" width={width} height={H} role="img" aria-label={`Intensity minutes for ${weeks.length} weeks. Goal met ${met} times.`}>
            {ticks.map((v) => (
              <g key={v}>
                <line x1={M.left} x2={M.left + plotW} y1={y(v)} y2={y(v)} stroke={v === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)'} />
                <text x={M.left - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-[var(--viz-muted)] text-[11px] tabular-nums">{v}</text>
              </g>
            ))}
            {weeks.map((w, i) => {
              const cx = M.left + band * i + band / 2;
              const current = i === weeks.length - 1;
              const mod = y(0) - y(w.moderate);
              const vig = y(0) - y(2 * w.vigorous);
              return (
                <g
                  key={w.week}
                  tabIndex={0}
                  role="button"
                  aria-label={`Week of ${fmtWeek(w.week)}: ${Math.round(w.total)} intensity minutes, ${w.total >= goal ? 'goal met' : 'below goal'}${current ? ', in progress' : ''}`}
                  onPointerEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="outline-none"
                  style={{ opacity: hover !== null && hover !== i ? 0.4 : current ? 0.55 : 1 }}
                >
                  <rect x={M.left + band * i} y={M.top} width={band} height={plotH + M.bottom} fill="transparent" />
                  <rect x={cx - barW / 2} y={y(0) - mod} width={barW} height={Math.max(0, mod)} fill="var(--viz-run)" />
                  <rect x={cx - barW / 2} y={y(0) - mod - vig} width={barW} height={Math.max(0, vig - (vig > 1 ? 1 : 0))} fill="var(--viz-ride)" />
                  {(i % 3 === (weeks.length - 1) % 3) && (
                    <text x={cx} y={H - 6} textAnchor="middle" className="fill-[var(--viz-muted)] text-[10px]">{current ? 'This wk' : fmtWeek(w.week)}</text>
                  )}
                </g>
              );
            })}
            <line x1={M.left} x2={M.left + plotW} y1={y(goal)} y2={y(goal)} stroke="var(--viz-ink-2)" strokeDasharray="4 3" />
            <text x={M.left + plotW + 4} y={y(goal)} dy="0.32em" className="fill-[var(--viz-ink-2)] text-[11px]">goal</text>
          </svg>
        )}
        {h && hover !== null && (
          <ChartTooltip
            x={M.left + band * hover + band / 2}
            y={M.top}
            width={width}
            title={`Week of ${fmtWeek(h.week)}${hover === weeks.length - 1 ? ' (in progress)' : ''}`}
            rows={[
              { key: 't', label: h.total >= goal ? 'goal met' : `of ${goal}`, value: String(Math.round(h.total)), strong: true },
              { key: 'm', label: 'moderate', value: String(Math.round(h.moderate)), color: 'var(--viz-run)' },
              { key: 'v', label: 'vigorous (counted ×2)', value: String(Math.round(h.vigorous)), color: 'var(--viz-ride)' },
            ]}
          />
        )}
      </div>
    </div>
  );
}
