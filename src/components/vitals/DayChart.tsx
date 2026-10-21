'use client';

import { HelpTooltip } from '@kobo/web';
import { Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, type ReactNode } from 'react';
import { niceTicks, useMeasure } from '@/components/charts/useMeasure';
import type { Coverage } from './CoverageStrip';

type V = number | null;

export type DayChartProps = {
  title: string;
  info?: ReactNode; // behind the (i)
  days: string[];
  coverage: Record<string, Coverage>;
  hover: number | null;
  onHover: (i: number | null) => void;
  /** The value read out in the header for day i, or null when there is none. */
  readout: (i: number) => string | null;
  /** Shown next to the latest value when nothing is hovered (for example "7-day avg 7:12"). */
  aside?: string;
  kind: 'line' | 'bar' | 'range' | 'stack';
  values?: V[]; // line, bar
  low?: V[]; // range: the bottom of each bar
  stack?: { values: V[]; color: string; label: string }[]; // stack, bottom first
  color?: string;
  pointColor?: (i: number) => string | null; // line: a coloured dot per day
  band?: { low: V[] | number; high: V[] | number } | null; // shaded normal range (one value or one per day)
  goal?: number; // bar: a dashed line
  yFloor?: number; // the axis starts here (bars start at 0)
  yCeil?: number;
  tickFormat?: (v: number) => string;
  ticks?: number[]; // fixed y ticks, lowest first (overrides yFloor and yCeil)
  height?: number;
  connect?: boolean; // line: join readings across empty days (sparse metrics such as weight)
  watchless?: boolean; // the metric does not come from the watch: no hatching for days it was off
};

const fmtShort = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const at = (b: V[] | number, i: number) => (typeof b === 'number' ? b : b[i]);
const MISSING: Partial<Record<Coverage, string>> = { off: 'Not worn', pending: 'Not synced yet' };

/**
 * One metric, one slot per day, on the day axis every chart of the board shares, so a hover lines up across them.
 * Days the watch was off (or not synced yet) are hatched, never skipped; lines break there.
 */
export default function DayChart(p: DayChartProps) {
  const router = useRouter();
  const pid = useId().replace(/:/g, '');
  const [ref, width] = useMeasure<HTMLDivElement>(320, 200);
  const H = p.height ?? 96;
  const M = { top: 6, right: 2, bottom: 16, left: 28 };
  const n = p.days.length;
  const plotW = width - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const bw = plotW / Math.max(1, n);
  const cx = (i: number) => M.left + bw * i + bw / 2;

  const all: number[] = [];
  const push = (v: V) => v !== null && Number.isFinite(v) && all.push(v);
  if (p.kind === 'stack') p.days.forEach((_, i) => push((p.stack ?? []).reduce((a, s) => a + (s.values[i] ?? 0), 0) || null));
  else (p.values ?? []).forEach(push);
  (p.low ?? []).forEach(push);
  if (p.band) p.days.forEach((_, i) => { push(at(p.band!.low, i)); push(at(p.band!.high, i)); });
  if (p.goal) push(p.goal);
  const hasData = p.kind === 'stack' ? all.length > 0 : (p.values ?? []).some((v) => v !== null);
  const bars = p.kind !== 'line';
  const lo0 = Math.min(...all);
  const hi0 = Math.max(...all);
  const pad = bars ? 0 : Math.max((hi0 - lo0) * 0.12, 1);
  const ticks = p.ticks ?? niceTicks(p.yCeil ?? hi0 + pad, 2, p.yFloor ?? (bars ? 0 : Math.max(0, lo0 - pad)));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const y = (v: number) => M.top + plotH - ((Math.min(yMax, Math.max(yMin, v)) - yMin) / Math.max(1e-9, yMax - yMin)) * plotH;
  const barW = Math.max(1.5, Math.min(14, bw * 0.68));

  // Line segments break at any day without a value.
  const segs: number[][] = [];
  if (p.kind === 'line') {
    let cur: number[] = [];
    (p.values ?? []).forEach((v, i) => {
      if (v === null) { if (!p.connect && cur.length) { segs.push(cur); cur = []; } } else cur.push(i);
    });
    if (cur.length) segs.push(cur);
  }
  const bandPath = (() => {
    if (!p.band) return null;
    const idx = p.days.map((_, i) => i).filter((i) => at(p.band!.low, i) !== null && at(p.band!.high, i) !== null);
    if (idx.length < 2) return null;
    const top = idx.map((i, k) => `${k ? 'L' : 'M'}${(k === 0 ? M.left : k === idx.length - 1 ? M.left + plotW : cx(i)).toFixed(1)},${y(at(p.band!.high, i) as number).toFixed(1)}`).join('');
    const bot = idx.slice().reverse().map((i, k) => `L${(k === 0 ? M.left + plotW : k === idx.length - 1 ? M.left : cx(i)).toFixed(1)},${y(at(p.band!.low, i) as number).toFixed(1)}`).join('');
    return `${top}${bot}Z`;
  })();

  const last = (() => {
    for (let i = n - 1; i >= 0; i--) if (p.readout(i) !== null) return i;
    return null;
  })();
  const shown = p.hover ?? last;
  const shownText = shown === null ? null : p.readout(shown);
  const missing = p.hover !== null && shownText === null ? (!p.watchless && MISSING[p.coverage[p.days[p.hover]]]) || 'No data' : null;
  const labelEvery = Math.max(1, Math.ceil(52 / bw / 7)) * 7; // whole weeks, at least 52 px apart

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - r.left - M.left) / bw);
    p.onHover(i >= 0 && i < n ? i : null);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && p.hover !== null) return router.push(`/health/day/${p.days[p.hover]}`);
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    p.onHover(Math.min(n - 1, Math.max(0, (p.hover ?? n - 1) + (e.key === 'ArrowLeft' ? -1 : 1))));
  };

  return (
    <div className="min-w-0 rounded-lg border bg-[var(--viz-surface)] px-3 pb-2 pt-2.5">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="inline-flex min-w-0 items-center gap-1 truncate text-sm font-medium text-[var(--viz-ink)]">
          {p.title}
          {p.info && (
            <HelpTooltip label={`About ${p.title}`} icon={<Info aria-hidden />}>
              {p.info}
            </HelpTooltip>
          )}
        </h3>
        <div className="shrink-0 text-right text-xs tabular-nums text-[var(--viz-muted)]">
          {p.hover !== null && <span className="mr-1.5">{fmtShort(p.days[p.hover])}</span>}
          {missing ? (
            <span>{missing}</span>
          ) : shownText !== null ? (
            <span className="text-sm font-semibold text-[var(--viz-ink)]">{shownText}</span>
          ) : (
            <span>No data</span>
          )}
          {p.hover === null && p.aside && <span className="ml-1.5">{p.aside}</span>}
        </div>
      </div>
      <div ref={ref}>
        <svg
          width={width}
          height={H}
          role="img"
          tabIndex={0}
          aria-label={`${p.title}, last ${n} days. Latest ${shownText ?? 'none'}. Arrow keys read days, Enter opens a day.`}
          onPointerMove={onMove}
          onPointerLeave={() => p.onHover(null)}
          onBlur={() => p.onHover(null)}
          onKeyDown={onKey}
          onClick={() => p.hover !== null && router.push(`/health/day/${p.days[p.hover]}`)}
          className="block max-w-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--viz-ctl)]"
        >
          <defs>
            <pattern id={`h${pid}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="4" stroke="var(--viz-axis)" strokeWidth="1.2" />
            </pattern>
          </defs>
          {p.days.map((d, i) =>
            !p.watchless && MISSING[p.coverage[d]] ? (
              <rect key={d} x={M.left + bw * i} y={M.top} width={bw} height={plotH} fill={`url(#h${pid})`} opacity={p.coverage[d] === 'pending' ? 0.45 : 0.9} />
            ) : null
          )}
          {bandPath && <path d={bandPath} fill="var(--viz-band)" />}
          {ticks.map((v) => (
            <g key={v}>
              <line x1={M.left} x2={M.left + plotW} y1={y(v)} y2={y(v)} stroke={v === yMin ? 'var(--viz-axis)' : 'var(--viz-grid)'} strokeDasharray={v === yMin ? undefined : '2 3'} />
              <text x={M.left - 4} y={y(v)} dy="0.32em" textAnchor="end" className="fill-[var(--viz-muted)] text-[10px] tabular-nums">
                {p.tickFormat ? p.tickFormat(v) : v}
              </text>
            </g>
          ))}
          {p.days.map((d, i) =>
            (n - 1 - i) % labelEvery === 0 ? (
              <text key={d} x={cx(i)} y={H - 3} textAnchor={i === n - 1 ? 'end' : 'middle'} dx={i === n - 1 ? bw / 2 : 0} className="fill-[var(--viz-muted)] text-[10px]">
                {fmtShort(d)}
              </text>
            ) : null
          )}
          {!hasData && (
            <text x={M.left + plotW / 2} y={M.top + plotH / 2} textAnchor="middle" dy="0.32em" className="fill-[var(--viz-muted)] text-[11px]">No data</text>
          )}
          {p.goal !== undefined && <line x1={M.left} x2={M.left + plotW} y1={y(p.goal)} y2={y(p.goal)} stroke="var(--viz-ink-2)" strokeDasharray="3 3" opacity={0.6} />}
          {p.kind === 'line' &&
            segs.map((s) =>
              s.length > 1 ? (
                <path
                  key={s[0]}
                  d={s.map((i, k) => `${k ? 'L' : 'M'}${cx(i).toFixed(1)},${y(p.values![i] as number).toFixed(1)}`).join('')}
                  fill="none"
                  stroke={p.color ?? 'var(--viz-ctl)'}
                  strokeWidth={1.75}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null
            )}
          {p.kind === 'line' &&
            (p.values ?? []).map((v, i) => {
              if (v === null) return null;
              const c = p.pointColor?.(i);
              const lone = !segs.some((s) => s.length > 1 && s.includes(i));
              if (!c && !lone && i !== last && i !== p.hover) return null;
              return <circle key={i} cx={cx(i)} cy={y(v)} r={i === p.hover || i === last ? 3.2 : n > 45 ? 1.6 : 2.2} fill={c ?? p.color ?? 'var(--viz-ctl)'} stroke="var(--viz-surface)" strokeWidth={i === p.hover || i === last ? 1.5 : 0.5} />;
            })}
          {p.kind === 'bar' &&
            (p.values ?? []).map((v, i) =>
              v === null ? null : (
                <rect key={i} x={cx(i) - barW / 2} y={y(v)} width={barW} height={Math.max(0.5, y(yMin) - y(v))} rx={Math.min(1.5, barW / 3)} fill={p.color ?? 'var(--viz-ctl)'} opacity={p.hover !== null && p.hover !== i ? 0.55 : 1} />
              )
            )}
          {p.kind === 'range' &&
            (p.values ?? []).map((v, i) => {
              const l = p.low?.[i];
              if (v === null || l === null || l === undefined) return null;
              return <rect key={i} x={cx(i) - barW / 2} y={y(v)} width={barW} height={Math.max(1, y(l) - y(v))} rx={Math.min(1.5, barW / 3)} fill={p.color ?? 'var(--viz-ctl)'} opacity={p.hover !== null && p.hover !== i ? 0.55 : 1} />;
            })}
          {p.kind === 'stack' &&
            p.days.map((d, i) => {
              let base = 0;
              return (
                <g key={d} opacity={p.hover !== null && p.hover !== i ? 0.55 : 1}>
                  {(p.stack ?? []).map((s) => {
                    const v = s.values[i];
                    if (!v) return null;
                    const top = y(base + v);
                    const bottom = y(base);
                    base += v;
                    return <rect key={s.label} x={cx(i) - barW / 2} y={top} width={barW} height={Math.max(0, bottom - top - 0.4)} fill={s.color} />;
                  })}
                </g>
              );
            })}
          {p.hover !== null && (
            <line x1={cx(p.hover)} x2={cx(p.hover)} y1={M.top} y2={M.top + plotH} stroke="var(--viz-ink-2)" strokeWidth={1} opacity={0.45} pointerEvents="none" />
          )}
        </svg>
      </div>
    </div>
  );
}
