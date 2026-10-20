'use client';

import { useState } from 'react';
import { useMeasure } from '@/components/charts/useMeasure';
import { bandScale } from '@/lib/vitals/labs-view.mjs';

type Status = 'in_range' | 'out_of_range' | 'other';
type Band = { key: 'above' | 'in' | 'below'; label: string; text: string; from: number | null; to: number | null };
type Draw = { date: string; value: number | null; text: string; status: Status };

const COLOR: Record<Status, string> = { in_range: 'var(--viz-good)', out_of_range: 'var(--viz-down)', other: 'var(--viz-muted)' };
const LABEL: Record<Status, string> = { in_range: 'In Range', out_of_range: 'Out of Range', other: 'Other' };
const BAND_COLOR = { above: 'var(--viz-down)', in: 'var(--viz-good)', below: 'var(--viz-down)' } as const;
const monthYear = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const longDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/**
 * The history of one biomarker against its range bands, like Function's chart: the bands on the left (each the same
 * height), the draws plotted in them with their values, and a dashed segment to the next planned draw. Every point
 * has its value as text and its status in the tooltip and the list under the chart.
 */
export default function BiomarkerChart({ bands, draws, next }: { bands: Band[]; draws: Draw[]; next: { date: string; label: string } | null }) {
  const [ref, width] = useMeasure<HTMLDivElement>(320);
  const [hover, setHover] = useState<number | null>(null);
  const pts = draws.filter((d): d is Draw & { value: number } => d.value !== null);
  if (!pts.length) return null;
  const scale = bandScale(bands, pts.map((p) => p.value));
  const H = Math.max(180, bands.length * 72);
  const M = { top: 22, bottom: 26, left: 16, right: 24 };
  const plotH = H - M.top - M.bottom;
  const plotW = width - M.left - M.right;
  // Equal steps, like Function's chart: the dates are labels, so a far-off next draw cannot squeeze the draws together.
  const dates = [...pts.map((p) => p.date), ...(next ? [next.date] : [])];
  const x = (d: string) => {
    const i = dates.indexOf(d);
    return dates.length === 1 ? M.left + plotW / 2 : M.left + (i / (dates.length - 1)) * plotW;
  };
  const y = (v: number) => M.top + plotH - scale.position(v) * plotH;
  const last = pts[pts.length - 1];
  const bandH = bands.length ? plotH / bands.length : plotH;
  const h = hover === null ? null : pts[hover];

  return (
    <div className="flex gap-3 sm:gap-5">
      {bands.length > 0 && (
        <div className="w-24 shrink-0 sm:w-32" style={{ paddingTop: M.top, paddingBottom: M.bottom }} aria-label="Ranges">
          {bands.map((b) => (
            <div key={b.key} className="flex items-center gap-2" style={{ height: bandH }}>
              <span className="w-1 self-stretch rounded-full" style={{ background: BAND_COLOR[b.key], opacity: b.key === 'in' ? 1 : 0.8, margin: '4px 0' }} aria-hidden />
              <span className="min-w-0">
                <span className="block text-xs font-medium text-[var(--viz-ink)]">{b.label}</span>
                <span className="block text-xs tabular-nums text-[var(--viz-ink-2)]">{b.text}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      <div ref={ref} className="relative min-w-0 flex-1">
        <svg
          width={width}
          height={H}
          role="img"
          tabIndex={0}
          aria-label={`History: ${pts.map((p) => `${longDate(p.date)} ${p.text}, ${LABEL[p.status]}`).join('; ')}. Use arrow keys to read each draw.`}
          onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            setHover((i) => Math.min(pts.length - 1, Math.max(0, (i ?? pts.length) + (e.key === 'ArrowLeft' ? -1 : 1))));
          }}
          className="outline-none focus-visible:ring-2 focus-visible:ring-[var(--viz-ctl)]"
        >
          {bands.map((b, i) => (
            <rect key={b.key} x={0} y={M.top + i * bandH} width={width} height={bandH} fill={b.key === 'in' ? 'color-mix(in oklab, var(--viz-good) 9%, transparent)' : 'transparent'} />
          ))}
          {bands.slice(1).map((b, i) => (
            <line key={b.key} x1={0} x2={width} y1={M.top + (i + 1) * bandH} y2={M.top + (i + 1) * bandH} stroke="var(--viz-axis)" strokeDasharray="4 4" />
          ))}
          <line x1={0} x2={width} y1={M.top + plotH} y2={M.top + plotH} stroke="var(--viz-grid)" />
          {pts.length > 1 && (
            <path d={pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join('')} fill="none" stroke="var(--viz-ink-2)" strokeWidth={1.5} />
          )}
          {next && (
            <g aria-hidden>
              <line x1={x(last.date)} y1={y(last.value)} x2={x(next.date)} y2={y(last.value)} stroke="var(--viz-muted)" strokeWidth={1.5} strokeDasharray="5 5" />
              <circle cx={x(next.date)} cy={y(last.value)} r={6} fill="var(--viz-surface)" stroke="var(--viz-muted)" strokeWidth={2} />
              {/* Above the grey point, so it never meets the draws' date labels on a narrow chart. */}
              <text x={x(next.date) + 6} y={y(last.value) - 13} textAnchor="end" className="fill-[var(--viz-muted)] text-[11px]">{next.label}</text>
            </g>
          )}
          {pts.map((p, i) => (
            <g key={p.date} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
              <circle cx={x(p.date)} cy={y(p.value)} r={14} fill="transparent" />
              <circle cx={x(p.date)} cy={y(p.value)} r={hover === i ? 8 : 6.5} fill={COLOR[p.status]} stroke="var(--viz-surface)" strokeWidth={2} />
              <text x={x(p.date)} y={y(p.value) - 13} textAnchor="middle" className="text-[12px] font-semibold tabular-nums" style={{ fill: COLOR[p.status] }}>
                {p.text.split(' ')[0]}
              </text>
              <text x={x(p.date)} y={H - 8} textAnchor={pts.length === 1 && !next ? 'middle' : i === 0 ? 'start' : i === pts.length - 1 && !next ? 'end' : 'middle'} className="fill-[var(--viz-ink-2)] text-[11px]">
                {monthYear(p.date)}
              </text>
            </g>
          ))}
        </svg>
        {h && (
          <div role="status" className="pointer-events-none absolute z-10 rounded-md border bg-[var(--viz-surface)] px-3 py-2 text-xs shadow-md" style={{ left: Math.min(Math.max(0, x(h.date) - 70), width - 150), top: 0, width: 150 }}>
            <div className="text-[var(--viz-ink-2)]">{longDate(h.date)}</div>
            <div className="font-semibold tabular-nums text-[var(--viz-ink)]">{h.text}</div>
            <div style={{ color: COLOR[h.status] }}>{LABEL[h.status]}</div>
          </div>
        )}
      </div>
    </div>
  );
}
