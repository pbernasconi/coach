'use client';

import { useState } from 'react';
import { LegendItem } from './ChartTooltip';
import { decimalText as fmt, muscleLabel as label, muscleStatusText } from '@/lib/performance/display.mjs';

export type MuscleBar = { muscle: string; week: number; avg: number };


/**
 * Hard sets per muscle this week as bars, the 4-week average as a tick, and the 10-20 target band
 * shaded behind them (LiftCore's WeeklyVolume). Each row is focusable and reads out its numbers.
 */
export default function MuscleSetsChart({ rows }: { rows: MuscleBar[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const MAX = Math.max(24, ...rows.map((r) => Math.max(r.week, r.avg)) );
  const pct = (v: number) => `${(Math.min(v, MAX) / MAX) * 100}%`;
  return (
    <div className="rounded-lg border bg-[var(--viz-surface)] p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-semibold text-[var(--viz-ink)]">Hard sets per muscle</h2>
          <p className="text-xs text-[var(--viz-muted)]">This week. A set counts 1 for a primary muscle and 0.5 for a secondary one.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <LegendItem color="var(--viz-ride)" label="This week" />
          <LegendItem color="var(--viz-ink-2)" label="4-week average" shape="line" />
          <LegendItem color="var(--viz-band)" label="Target 10–20" />
        </div>
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => {
          const status = muscleStatusText(r.week);
          const on = hover === r.muscle;
          return (
            <div
              key={r.muscle}
              tabIndex={0}
              onPointerEnter={() => setHover(r.muscle)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(r.muscle)}
              onBlur={() => setHover(null)}
              aria-label={`${label(r.muscle)}: ${fmt(r.week)} sets this week, ${fmt(r.avg)} on average, ${status}`}
              className={`grid grid-cols-[5.5rem_1fr_5.5rem] sm:grid-cols-[7.5rem_1fr_7rem] items-center gap-3 rounded px-1 py-0.5 text-xs outline-none ${on ? 'bg-[var(--viz-band)]' : ''}`}
            >
              <span className="truncate text-[var(--viz-ink)]">{label(r.muscle)}</span>
              <div className="relative h-3">
                <div className="absolute inset-y-0 rounded-sm bg-[var(--viz-band)]" style={{ left: pct(10), width: `calc(${pct(20)} - ${pct(10)})` }} />
                <div className="absolute inset-y-0.5 left-0 rounded-r-[4px] bg-[var(--viz-ride)]" style={{ width: pct(r.week) }} />
                <div className="absolute -inset-y-0.5 w-0.5 rounded-full bg-[var(--viz-ink-2)]" style={{ left: pct(r.avg) }} />
              </div>
              <span className="whitespace-nowrap text-right tabular-nums text-[var(--viz-ink-2)]">
                <b className="font-semibold text-[var(--viz-ink)]">{fmt(r.week)}</b>
                {` · avg ${fmt(r.avg)}`}
                {on && <span className="hidden sm:inline">{` · ${status}`}</span>}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-1 grid grid-cols-[5.5rem_1fr_5.5rem] sm:grid-cols-[7.5rem_1fr_7rem] gap-3 px-1 text-[10px] text-[var(--viz-muted)]">
        <span />
        <div className="relative h-3">
          {[0, 10, 20].map((t) => (
            <span key={t} className="absolute -translate-x-1/2 tabular-nums" style={{ left: pct(t) }}>{t}</span>
          ))}
        </div>
        <span />
      </div>
    </div>
  );
}
