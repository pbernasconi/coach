'use client';

import { useState } from 'react';
import SportIcon from '@/components/SportIcon';
import type { SportWeek } from '@/lib/performance/queries';
import { SPORTS, sport, type SportId } from '@/lib/sports';
import { ChartTooltip, LegendItem, type TooltipRow } from './ChartTooltip';
import { niceTicks, useMeasure } from './useMeasure';

export type HoursWeek = {
  week: string; // Monday, YYYY-MM-DD
  sports: Partial<Record<SportId, SportWeek>>;
  strength: number; // strength sessions (Lift and Strava), one per day
  tss: number;
};

const fmtWeek = (w: string) => new Date(`${w}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const hm = (h: number) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

/** A path for a bar segment with 4px rounded top corners (square at the bottom). */
function topRounded(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

const hoursOf = (w: HoursWeek, id: SportId) => w.sports[id]?.hours ?? 0;

/** The tooltip text for one sport: its exact Strava types where they differ from the sport ("Hike", "Virtual ride"), and km. */
function detail(id: SportId, sw: SportWeek) {
  const types = Object.entries(sw.types).sort((a, b) => b[1] - a[1]).map(([t]) => t);
  const named = types.filter((t) => t !== sport(id).label);
  const parts = [named.length || id === 'other' ? types.join(', ') : sport(id).label];
  if (sw.km >= 0.5 && id !== 'strength') parts.push(id === 'ride' ? `${Math.round(sw.km)} km` : `${sw.km.toFixed(1)} km`);
  return parts.join(' · ');
}

/**
 * Hours per week, stacked by sport in the design/sports.json order, with strength sessions as a dot row under
 * the axis and a 12-week average line. Only sports with hours in the window get a series. The current week is
 * drawn lighter: it is still in progress.
 */
export default function WeeklyHoursChart({ weeks, currentWeek }: { weeks: HoursWeek[]; currentWeek: string }) {
  const [ref, width] = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const narrow = width < 480; // a phone: a smaller right margin, and a week label on every second or third bar
  const M = { top: 22, right: narrow ? 52 : 64, bottom: 54, left: narrow ? 34 : 40 };
  const H = 300;
  const plotW = width - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const series = SPORTS.filter((s) => s.id !== 'rest' && weeks.some((w) => hoursOf(w, s.id) > 0));
  const total = (w: HoursWeek) => series.reduce((n, s) => n + hoursOf(w, s.id), 0);
  const ticks = niceTicks(Math.max(4, ...weeks.map(total)));
  const yMax = ticks[ticks.length - 1];
  const y = (v: number) => M.top + plotH - (v / yMax) * plotH;
  const band = plotW / weeks.length;
  const barW = Math.min(24, band * 0.56);
  const cx = (i: number) => M.left + band * i + band / 2;
  const complete = weeks.filter((w) => w.week !== currentWeek);
  const avg = complete.length ? complete.reduce((n, w) => n + total(w), 0) / complete.length : 0;
  const maxIdx = weeks.reduce((best, w, i) => (total(w) > total(weeks[best]) ? i : best), 0);
  const lastComplete = weeks.findLastIndex((w) => w.week !== currentWeek);
  const labelled = new Set([maxIdx, lastComplete]);
  // Week labels need about 44 px each. Count back from the current week, so it always has its label.
  const every = Math.max(1, Math.ceil(44 / band));
  const dated = (i: number) => (weeks.length - 1 - i) % every === 0;
  const GAP = 2;

  const h = hover === null ? null : weeks[hover];
  return (
    <div className="rounded-lg border bg-[var(--viz-surface)] p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-semibold text-[var(--viz-ink)]">Training hours per week</h2>
          <p className="text-xs text-[var(--viz-muted)]">Moving time from Strava. Strength counts Lift and Strava sessions, one per day.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {series.map((s) => <LegendItem key={s.id} icon={<SportIcon id={s.id} />} label={s.label} />)}
          <LegendItem color="var(--sport-strength)" label="Strength session" shape="dot" />
        </div>
      </div>
      <div ref={ref} className="relative" onPointerLeave={() => setHover(null)}>
        <svg className="max-w-full" width={width} height={H} role="img" aria-label="Training hours per week, by sport">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)'} strokeWidth={1} />
              <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[var(--viz-muted)] text-[11px] tabular-nums">{t}h</text>
            </g>
          ))}
          {avg > 0 && (
            <g>
              <line x1={M.left} x2={width - M.right} y1={y(avg)} y2={y(avg)} stroke="var(--viz-ink-2)" strokeWidth={1} opacity={0.55} />
              <text x={width - M.right + 6} y={y(avg)} dy="0.32em" className="fill-[var(--viz-ink-2)] text-[11px]">avg {hm(avg)}</text>
            </g>
          )}
          {weeks.map((w, i) => {
            let base = 0;
            const current = w.week === currentWeek;
            const dim = hover !== null && hover !== i;
            const visible = series.filter((s) => hoursOf(w, s.id) > 0);
            return (
              <g
                key={w.week}
                tabIndex={0}
                role="button"
                aria-label={`${fmtWeek(w.week)}: ${hm(total(w))} hours, ${visible.map((s) => `${s.label.toLowerCase()} ${hm(hoursOf(w, s.id))}`).join(', ')}, strength sessions ${w.strength}`}
                onPointerEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="outline-none"
                style={{ opacity: dim ? 0.35 : current ? 0.55 : 1, transition: 'opacity 120ms' }}
              >
                <rect x={M.left + band * i} y={M.top} width={band} height={plotH + M.bottom} fill="transparent" />
                {visible.map((s, k) => {
                  const v = hoursOf(w, s.id);
                  const top = y(base + v);
                  const bottom = y(base);
                  base += v;
                  const isTop = k === visible.length - 1;
                  const hgt = Math.max(0, bottom - top - (k > 0 ? GAP : 0));
                  return isTop ? (
                    <path key={s.id} d={topRounded(cx(i) - barW / 2, top, barW, hgt, 4)} fill={s.color} />
                  ) : (
                    <rect key={s.id} x={cx(i) - barW / 2} y={top} width={barW} height={hgt} fill={s.color} />
                  );
                })}
                {labelled.has(i) && total(w) > 0 && (
                  <text x={cx(i)} y={y(total(w)) - 6} textAnchor="middle" className="fill-[var(--viz-ink)] text-[11px] font-medium tabular-nums">{hm(total(w))}</text>
                )}
                {dated(i) && (
                  <text x={cx(i)} y={M.top + plotH + 16} textAnchor="middle" className="fill-[var(--viz-muted)] text-[11px]">
                    {current ? 'This wk' : fmtWeek(w.week)}
                  </text>
                )}
                {Array.from({ length: Math.min(w.strength, 4) }, (_, d) => (
                  <circle key={d} cx={cx(i) + (d - (Math.min(w.strength, 4) - 1) / 2) * Math.min(10, band / 3.5)} cy={M.top + plotH + 36} r={narrow ? 2.5 : 3.5} fill="var(--viz-surface)" stroke="var(--sport-strength)" strokeWidth={2} />
                ))}
              </g>
            );
          })}
          <text x={M.left - 8} y={M.top + plotH + 36} dy="0.32em" textAnchor="end" className="fill-[var(--viz-muted)] text-[10px]">Lift</text>
          {hover !== null && (
            <rect x={cx(hover) - barW / 2 - 3} y={M.top} width={barW + 6} height={plotH} fill="var(--viz-ink)" opacity={0.04} rx={4} pointerEvents="none" />
          )}
        </svg>
        {h && hover !== null && (
          <ChartTooltip
            x={cx(hover)}
            y={M.top}
            width={width}
            title={`Week of ${fmtWeek(h.week)}${h.week === currentWeek ? ' (in progress)' : ''}`}
            rows={[
              { key: 'total', label: 'total', value: hm(total(h)), strong: true },
              ...series.flatMap((s): TooltipRow[] => {
                const sw = h.sports[s.id];
                return sw && sw.hours > 0 ? [{ key: s.id, label: detail(s.id, sw), value: hm(sw.hours), icon: <SportIcon id={s.id} className="h-3 w-3" /> }] : [];
              }),
              { key: 'strength', label: 'strength sessions', value: String(h.strength) },
              { key: 'tss', label: 'TSS', value: String(Math.round(h.tss)) },
            ]}
          />
        )}
      </div>
    </div>
  );
}
