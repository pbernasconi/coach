'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ChartTooltip, LegendItem } from '@/components/charts/ChartTooltip';
import { niceTicks, useMeasure } from '@/components/charts/useMeasure';

export type HrvNight = { date: string; value: number | null; low: number | null; high: number | null; status: number | null; statusLabel: string | null };

const DAY = 864e5;
const t = (d: string) => Date.parse(`${d}T12:00:00Z`);
const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

/** HRV status colours. The tooltip and the legend name each status, so the colour is never the only cue. */
export const HRV_STATUS_COLOR: Record<string, string> = {
  Balanced: 'var(--viz-good)',
  Unbalanced: 'var(--color-amber-500)',
  Low: 'var(--viz-down)',
  Poor: 'var(--viz-down)',
  'No status': 'var(--viz-muted)',
};

/**
 * Nightly HRV (RMSSD) with Garmin's own baseline band (balanced low to high) for each night, and a dot per night in
 * the colour of that night's HRV status.
 */
export default function HrvStatusChart({ nights, from, to }: { nights: HrvNight[]; from: string; to: string }) {
  const router = useRouter();
  const [ref, width] = useMeasure<HTMLDivElement>(320);
  const [hover, setHover] = useState<number | null>(null);
  const pts = nights.filter((n): n is HrvNight & { value: number } => n.value !== null && n.date >= from && n.date <= to);
  const M = { top: 10, right: 12, bottom: 22, left: 36 };
  const H = 170;
  const plotW = width - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const t0 = t(from);
  const span = Math.max(DAY, t(to) - t0);
  const x = (d: string) => M.left + ((t(d) - t0) / span) * plotW;
  const all = pts.flatMap((p) => [p.value, p.low, p.high].filter((v): v is number => v !== null));
  const ticks = all.length ? niceTicks(Math.max(...all) + 4, 3, Math.max(0, Math.min(...all) - 4)) : [0, 1];
  const y = (v: number) => M.top + plotH - ((v - ticks[0]) / Math.max(1e-9, ticks[ticks.length - 1] - ticks[0])) * plotH;
  const banded = pts.filter((p) => p.low !== null && p.high !== null);
  const bandPath = banded.length > 1
    ? `${banded.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.high as number).toFixed(1)}`).join('')}${banded.slice().reverse().map((p) => `L${x(p.date).toFixed(1)},${y(p.low as number).toFixed(1)}`).join('')}Z`
    : null;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const labels = [...new Set(pts.map((p) => p.statusLabel).filter((s): s is string => !!s))];
  const months = Array.from({ length: 4 }, (_, i) => {
    const d = new Date(t0);
    d.setUTCMonth(d.getUTCMonth() + i + 1, 1);
    return d.toISOString().slice(0, 10);
  }).filter((d) => d > from && d <= to);
  const h = hover === null ? null : pts[hover];
  const last = pts.at(-1);

  return (
    <div className="rounded-lg border bg-[var(--viz-surface)] p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-semibold text-[var(--viz-ink)]">HRV (RMSSD) and status</h3>
          <p className="text-xs text-[var(--viz-muted)]">Overnight average from Garmin, against Garmin&apos;s balanced range for you.</p>
        </div>
        {last && (
          <span className="text-right text-sm tabular-nums text-[var(--viz-ink)]">
            <b className="text-lg font-semibold">{Math.round(last.value)} ms</b>
            {last.statusLabel && <span className="ml-1 text-xs text-[var(--viz-ink-2)]">{last.statusLabel}</span>}
          </span>
        )}
      </div>
      <div className="mb-1 flex flex-wrap gap-3">
        {bandPath && <LegendItem color="var(--viz-band)" label="Balanced range" />}
        {labels.map((l) => <LegendItem key={l} color={HRV_STATUS_COLOR[l] ?? 'var(--viz-muted)'} label={l} shape="dot" />)}
      </div>
      <div ref={ref} className="relative">
        {pts.length === 0 ? (
          <div className="flex h-[170px] items-center justify-center rounded-md bg-[var(--viz-band)] text-xs text-[var(--viz-muted)]">No Garmin HRV in this period.</div>
        ) : (
          <svg
            width={width}
            height={H}
            role="img"
            tabIndex={0}
            aria-label={`Nightly HRV, ${pts.length} nights. Latest ${last ? `${Math.round(last.value)} ms, ${last.statusLabel ?? 'no status'}` : '-'}. Use arrow keys to read nights, Enter to open a day.`}
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const at = t0 + ((e.clientX - r.left - M.left) / plotW) * span;
              let best = 0;
              pts.forEach((p, i) => {
                if (Math.abs(t(p.date) - at) < Math.abs(t(pts[best].date) - at)) best = i;
              });
              setHover(best);
            }}
            onPointerLeave={() => setHover(null)}
            onBlur={() => setHover(null)}
            onClick={() => hover !== null && router.push(`/health/day/${pts[hover].date}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && hover !== null) return router.push(`/health/day/${pts[hover].date}`);
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
              e.preventDefault();
              setHover((i) => Math.min(pts.length - 1, Math.max(0, (i ?? pts.length - 1) + (e.key === 'ArrowLeft' ? -1 : 1))));
            }}
            className="cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--viz-ctl)]"
          >
            {bandPath && <path d={bandPath} fill="var(--viz-band)" />}
            {ticks.map((v) => (
              <g key={v}>
                <line x1={M.left} x2={M.left + plotW} y1={y(v)} y2={y(v)} stroke={v === ticks[0] ? 'var(--viz-axis)' : 'var(--viz-grid)'} />
                <text x={M.left - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-[var(--viz-muted)] text-[11px] tabular-nums">{v}</text>
              </g>
            ))}
            {months.map((d) => (
              <text key={d} x={x(d)} y={H - 6} textAnchor="middle" className="fill-[var(--viz-muted)] text-[11px]">
                {new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}
              </text>
            ))}
            <path d={line} fill="none" stroke="var(--viz-axis)" strokeWidth={1.5} strokeLinejoin="round" />
            {pts.map((p, i) => (
              <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r={hover === i ? 5 : 3} fill={HRV_STATUS_COLOR[p.statusLabel ?? ''] ?? 'var(--viz-ctl)'} stroke="var(--viz-surface)" strokeWidth={1} />
            ))}
          </svg>
        )}
        {h && hover !== null && (
          <ChartTooltip
            x={x(h.date)}
            y={M.top}
            width={width}
            title={fmtDay(h.date)}
            rows={[
              { key: 'v', label: 'ms overnight', value: String(Math.round(h.value)), color: HRV_STATUS_COLOR[h.statusLabel ?? ''] ?? 'var(--viz-ctl)', strong: true },
              ...(h.statusLabel ? [{ key: 's', label: 'status', value: h.statusLabel }] : []),
              ...(h.low !== null && h.high !== null ? [{ key: 'b', label: 'balanced range', value: `${Math.round(h.low)}–${Math.round(h.high)}` }] : []),
            ]}
          />
        )}
      </div>
    </div>
  );
}
