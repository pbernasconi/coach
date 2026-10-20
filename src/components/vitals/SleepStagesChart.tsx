'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChartTooltip, LegendItem } from '@/components/charts/ChartTooltip';
import { useMeasure } from '@/components/charts/useMeasure';
import { STAGE_STYLE, type Stage } from './Hypnogram';

export type Night = { date: string; deep: number | null; light: number | null; rem: number | null; awake: number | null; total: number | null; score: number | null };

const ORDER: Stage[] = ['deep', 'light', 'rem', 'awake']; // bottom to top
const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const hm = (m: number) => `${Math.floor(Math.round(m) / 60)}:${String(Math.round(m) % 60).padStart(2, '0')}`;

/** Sleep stages per night for the last 30 nights, stacked, on one hours axis. A night links to its day page. */
export default function SleepStagesChart({ nights }: { nights: Night[] }) {
  const [ref, width] = useMeasure<HTMLDivElement>(320);
  const [hover, setHover] = useState<number | null>(null);
  const M = { top: 8, right: 8, bottom: 22, left: 30 };
  const H = 190;
  const plotW = width - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const sum = (n: Night) => ORDER.reduce((a, s) => a + (n[s] ?? 0), 0) || (n.total ?? 0);
  const maxH = Math.max(8, Math.ceil(Math.max(0, ...nights.map(sum)) / 60 / 2) * 2);
  const y = (min: number) => M.top + plotH - (min / (maxH * 60)) * plotH;
  const band = plotW / Math.max(1, nights.length);
  const barW = Math.max(3, Math.min(16, band * 0.7));
  const n = hover === null ? null : nights[hover];
  const avg = nights.length ? nights.reduce((a, x) => a + (x.total ?? sum(x)), 0) / nights.length : null;

  return (
    <div className="rounded-lg border bg-[var(--viz-surface)] p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-semibold text-[var(--viz-ink)]">Sleep stages, last 30 nights</h3>
          <p className="text-xs text-[var(--viz-muted)]">Each bar is the night that ends on the day. Select a night to open its day.</p>
        </div>
        {avg !== null && <span className="text-xs tabular-nums text-[var(--viz-ink-2)]">avg <b className="font-semibold text-[var(--viz-ink)]">{hm(avg)}</b> h</span>}
      </div>
      <div className="mb-1 flex flex-wrap gap-3">
        {ORDER.map((s) => <LegendItem key={s} color={STAGE_STYLE[s].color} label={STAGE_STYLE[s].label} />)}
      </div>
      <div ref={ref} className="relative" onPointerLeave={() => setHover(null)}>
        {nights.length === 0 ? (
          <div className="flex h-[190px] items-center justify-center rounded-md bg-[var(--viz-band)] text-xs text-[var(--viz-muted)]">No sleep stages in the last 30 nights.</div>
        ) : (
          <svg width={width} height={H} role="img" aria-label={`Sleep stages for ${nights.length} nights. Average ${avg === null ? '-' : hm(avg)} hours.`}>
            {Array.from({ length: maxH / 2 + 1 }, (_, i) => i * 2).map((hh) => (
              <g key={hh}>
                <line x1={M.left} x2={M.left + plotW} y1={y(hh * 60)} y2={y(hh * 60)} stroke={hh === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)'} />
                <text x={M.left - 5} y={y(hh * 60)} dy="0.32em" textAnchor="end" className="fill-[var(--viz-muted)] text-[11px] tabular-nums">{hh}h</text>
              </g>
            ))}
            {nights.map((night, i) => {
              let base = 0;
              const cx = M.left + band * i + band / 2;
              return (
                <Link key={night.date} href={`/health/day/${night.date}`} aria-label={`${fmtDay(night.date)}: ${hm(night.total ?? sum(night))} asleep${night.score !== null ? `, score ${night.score}` : ''}. Open the day.`}>
                  <g onPointerEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} opacity={hover !== null && hover !== i ? 0.45 : 1}>
                    <rect x={M.left + band * i} y={M.top} width={band} height={plotH} fill="transparent" />
                    {ORDER.map((s) => {
                      const v = night[s] ?? 0;
                      if (!v) return null;
                      const top = y(base + v);
                      const bottom = y(base);
                      base += v;
                      return <rect key={s} x={cx - barW / 2} y={top} width={barW} height={Math.max(0, bottom - top - 0.5)} fill={STAGE_STYLE[s].color} />;
                    })}
                    {(i % 7 === nights.length % 7 || i === nights.length - 1) && (
                      <text x={cx} y={H - 6} textAnchor="middle" className="fill-[var(--viz-muted)] text-[10px]">
                        {new Date(`${night.date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                      </text>
                    )}
                  </g>
                </Link>
              );
            })}
          </svg>
        )}
        {n && hover !== null && (
          <ChartTooltip
            x={M.left + band * hover + band / 2}
            y={M.top}
            width={width}
            title={fmtDay(n.date)}
            rows={[
              { key: 't', label: 'asleep', value: hm(n.total ?? sum(n)), strong: true },
              ...(n.score !== null ? [{ key: 'sc', label: 'sleep score', value: String(Math.round(n.score)) }] : []),
              ...ORDER.slice().reverse().flatMap((s) => (n[s] === null ? [] : [{ key: s, label: STAGE_STYLE[s].label, value: hm(n[s] as number), color: STAGE_STYLE[s].color }])),
            ]}
          />
        )}
      </div>
    </div>
  );
}
