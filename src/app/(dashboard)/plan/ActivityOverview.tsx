'use client';

import { tssMethodLabel } from '@/lib/strava-sync/tss.mjs';
import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Award, Minus } from 'lucide-react';
import ComplianceMark from '@/components/plan/ComplianceMark';
import { useMeasure } from '@/components/charts/useMeasure';
import { cn } from '@/lib/utils';
import { duration, int, km, kmh, pace, signed } from '@/lib/activity/format.mjs';
import { zoneOf } from '@/lib/performance/form';
import { plainTitle } from '@/lib/plan/calendar.mjs';
import type { ActivityContext, ActivityView } from '@/lib/activity/queries';

// The Overview tab of the item modal for a past activity: the plan against what was done, the main stats in a
// grid, time in heart-rate zones, splits, best efforts, the elevation profile and the training load.

function Card({ title, note, children, className }: { title: string; note?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('min-w-0 rounded-xl border p-4', className)}>
      <h3 className="mb-3 flex items-baseline justify-between gap-2 text-sm font-semibold text-[var(--viz-ink)]">
        {title}
        {note && <span className="text-xs font-normal text-[var(--viz-muted)]">{note}</span>}
      </h3>
      {children}
    </section>
  );
}

/** A value from a stream with the noise cut off: the p-th percentile of the values that count. */
function percentile(vals: (number | null)[] | null | undefined, p: number, keep: (v: number) => boolean = () => true) {
  if (!vals) return null;
  const xs = vals.filter((v): v is number => v != null && Number.isFinite(v) && keep(v)).sort((a, b) => a - b);
  if (!xs.length) return null;
  return xs[Math.min(xs.length - 1, Math.max(0, Math.round((p / 100) * (xs.length - 1))))];
}

// ---------------------------------------------------------------------------------------------------------------

/** Planned against done: a bar for time and for TSS, with the plan as a mark. */
export function PlanVsDone({ v, plan }: { v: ActivityView; plan: NonNullable<ActivityContext['planned']> }) {
  const rows: [string, number, number | null, (x: number) => string][] = [
    ['Time', v.stats.moving / 60, plan.duration, (m) => duration(m * 60)],
    ['TSS', v.effort.tss ?? 0, plan.tss, (x) => String(Math.round(x))],
  ];
  return (
    <Card title={`Planned: ${plainTitle(plan.title)}`} note={<ComplianceMark level={plan.compliance.level} showLabel />}>
      <div className="space-y-3">
        {rows.map(([label, done, planned, fmt]) => {
          if (!planned) return null;
          const max = Math.max(done, planned) * 1.08 || 1;
          const pct = Math.round((done / planned) * 100);
          return (
            <div key={label} className="space-y-1">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-[var(--viz-ink-2)]">{label}</span>
                <span className="tabular-nums">
                  <b className="text-sm text-[var(--viz-ink)]">{fmt(done)}</b>
                  <span className="text-[var(--viz-muted)]"> / {fmt(planned)} · {pct}%</span>
                </span>
              </div>
              <div className="relative h-2.5 rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${(done / max) * 100}%`, background: 'var(--plan-good)' }} />
                <div aria-hidden className="absolute -top-1 h-[18px] w-0.5 rounded bg-[var(--viz-ink)]" style={{ left: `${(planned / max) * 100}%` }} title="Planned" />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** The main numbers in a grid, grouped as Strava and TrainingPeaks show them. */
export function StatGrid({ v }: { v: ActivityView }) {
  const st = v.stats;
  const foot = v.layout === 'run';
  const ride = v.layout === 'ride';
  const ftp = v.effort.ftp;
  const stopped = st.elapsed - st.moving;
  const items = [
    ['Moving time', duration(st.moving)],
    ['Elapsed time', duration(st.elapsed)],
    stopped > 30 && ['Stopped', duration(stopped)],
    foot && st.avgGapSpeed && ['Grade-adj. pace', `${pace(st.avgGapSpeed)} /km`],
    !foot && st.maxSpeed && st.distance > 0 && ['Max speed', `${kmh(st.maxSpeed)} km/h`],
    st.avgCadence && ['Cadence', `${int(st.avgCadence)} ${foot ? 'spm' : 'rpm'}`],
    st.avgWatts && [st.deviceWatts ? 'Avg power' : 'Est. power', `${int(st.avgWatts)} W`],
    ride && st.np && ftp && ['Intensity factor', (st.np / ftp).toFixed(2)],
    ride && st.np && st.avgWatts && ['Variability', (st.np / st.avgWatts).toFixed(2)],
    st.kj && ['Work', `${int(st.kj)} kJ`],
    v.effort.sufferScore != null && ['Relative Effort', String(v.effort.sufferScore)],
    v.effort.trimp != null && ['TRIMP', String(v.effort.trimp)],
    v.effort.tss != null && st.moving > 0 && ['TSS per hour', String(Math.round(v.effort.tss / (st.moving / 3600)))],
    st.perceivedExertion != null && ['Perceived exertion', `${st.perceivedExertion}/10`],
    st.avgTemp != null && ['Watch temp', `${Math.round(st.avgTemp)} °C`],
  ].filter(Boolean) as [string, string][];
  return (
    <Card title="Stats" note={v.effort.tssMethod ? `TSS ${tssMethodLabel(v.effort.tssMethod)}` : undefined}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {items.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[11px] text-[var(--viz-muted)]">{label}</dt>
            <dd className="truncate text-[15px] font-semibold tabular-nums text-[var(--viz-ink)]">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/** Time in heart-rate zones as one bar, with each zone's share under it. */
export function ZoneStrip({ v }: { v: ActivityView }) {
  const zones = v.hrZones.filter((z) => z.seconds > 0);
  const total = zones.reduce((n, z) => n + z.seconds, 0);
  if (!total) return null;
  return (
    <Card title="Heart rate zones" note={v.stats.avgHr ? `avg ${Math.round(v.stats.avgHr)} bpm` : undefined}>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={zones.map((z) => `Z${z.zone} ${Math.round((z.seconds / total) * 100)}%`).join(', ')}>
        {zones.map((z) => (
          <div key={z.zone} style={{ width: `${(z.seconds / total) * 100}%`, background: `var(--viz-z${Math.min(7, z.zone)})` }} />
        ))}
      </div>
      <ul className="mt-2.5 grid grid-cols-5 gap-1 text-[11px]">
        {v.hrZones.map((z) => (
          <li key={z.zone} className="min-w-0">
            <span className="flex items-center gap-1 text-[var(--viz-muted)]">
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: `var(--viz-z${Math.min(7, z.zone)})` }} />Z{z.zone}
            </span>
            <span className="block font-semibold tabular-nums text-[var(--viz-ink)]">{Math.round((z.seconds / total) * 100)}%</span>
            <span className="block tabular-nums text-[var(--viz-muted)]">{z.seconds ? duration(z.seconds) : '–'}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Splits (runs: per km) or laps as pace or speed bars, Strava style; faster is a longer bar. */
export function SplitBars({ v }: { v: ActivityView }) {
  const foot = v.layout === 'run';
  const useLaps = !foot || v.splits.length === 0;
  const rows = (useLaps ? v.laps : v.splits).filter((r) => r.distance > 50);
  if (rows.length < 2 || v.layout === 'basic') return null;
  const speeds = rows.map((r) => r.speed ?? (r.moving ? r.distance / r.moving : 0));
  const hi = Math.max(...speeds);
  const lo = Math.min(...speeds.filter((s) => s > 0)) * 0.85;
  const shown = rows.slice(0, 15);
  return (
    <Card title={useLaps ? 'Laps' : 'Splits'} note={rows.length > shown.length ? `first ${shown.length} of ${rows.length}` : undefined}>
      <table className="w-full text-xs tabular-nums">
        <thead className="text-[11px] text-[var(--viz-muted)]">
          <tr>
            <th className="w-8 pb-1 text-left font-medium">{useLaps ? 'Lap' : 'Km'}</th>
            <th className="w-14 pb-1 text-left font-medium">{foot ? 'Pace' : 'Speed'}</th>
            <th className="pb-1"><span className="sr-only">Bar</span></th>
            <th className="w-12 pb-1 text-right font-medium">Elev</th>
            <th className="w-10 pb-1 text-right font-medium">HR</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => {
            const s = speeds[i];
            const elev = 'elevGain' in r && r.elevGain != null ? r.elevGain : r.elevDiff;
            return (
              <tr key={r.index}>
                <td className="py-0.5 text-[var(--viz-muted)]">{!useLaps && r.distance < 950 ? (r.distance / 1000).toFixed(1) : r.index}</td>
                <td className="py-0.5 font-medium text-[var(--viz-ink)]">{foot ? pace(s) : kmh(s)}</td>
                <td className="py-0.5 pr-2">
                  <div className="h-3 rounded-r-[4px] bg-[var(--viz-z3)]" style={{ width: `${Math.max(4, ((s - lo) / Math.max(1e-6, hi - lo)) * 100)}%` }} />
                </td>
                <td className="py-0.5 text-right text-[var(--viz-ink-2)]">{elev != null ? signed(elev) : '–'}</td>
                <td className="py-0.5 text-right text-[var(--viz-ink-2)]">{r.hr ? Math.round(r.hr) : '–'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

/** Best efforts with Strava's PR ranks (runs). Only shown when there are some. */
export function BestEfforts({ v }: { v: ActivityView }) {
  if (v.layout !== 'run' || v.bestEfforts.length === 0) return null;
  return (
    <Card title="Best efforts" note={v.bestEfforts.some((e) => e.prRank) ? 'PRs marked' : undefined}>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
        {v.bestEfforts.map((e) => (
          <li key={e.label} className="flex items-baseline justify-between gap-2">
            <span className="flex items-center gap-1 text-[var(--viz-ink-2)]">
              {e.prRank && <Award aria-label={e.prRank === 1 ? 'PR' : `${e.prRank === 2 ? '2nd' : '3rd'} best`} className={cn('h-3.5 w-3.5', e.prRank === 1 ? 'text-[#fc4c02]' : 'text-[var(--viz-muted)]')} />}
              {e.label}
            </span>
            <b className="tabular-nums text-[var(--viz-ink)]">{duration(e.seconds)}</b>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** The elevation profile by distance, under the map. */
export function ElevationProfile({ v }: { v: ActivityView }) {
  const [ref, width] = useMeasure<HTMLDivElement>(480, 200);
  const s = v.series;
  if (!s?.alt || !s.d) return null;
  const pts = s.alt.map((a, i) => (a != null && s.d![i] != null ? ([s.d![i]!, a] as [number, number]) : null)).filter(Boolean) as [number, number][];
  if (pts.length < 10) return null;
  const H = 64;
  const d0 = pts[0][0];
  const d1 = pts[pts.length - 1][0];
  const lo = Math.min(...pts.map((p) => p[1]));
  const hi = Math.max(...pts.map((p) => p[1]));
  const span = Math.max(10, hi - lo);
  const x = (d: number) => ((d - d0) / Math.max(1, d1 - d0)) * width;
  const y = (a: number) => 4 + (1 - (a - lo) / span) * (H - 8);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
  return (
    <div ref={ref} className="rounded-xl border px-4 pb-2 pt-3">
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-semibold text-[var(--viz-ink)]">Elevation</span>
        <span className="tabular-nums text-[var(--viz-muted)]">
          {int(lo)}–{int(hi)} m · +{int(v.stats.elevGain)} m
        </span>
      </div>
      <svg width={width} height={H} role="img" aria-label={`Elevation from ${int(lo)} to ${int(hi)} m over ${km(d1 - d0)} km`} className="block max-w-full">
        <path d={`${line}L${width},${H}L0,${H}Z`} fill="var(--viz-elev)" fillOpacity={0.7} />
        <path d={line} fill="none" stroke="var(--viz-ink-2)" strokeWidth={1.25} />
      </svg>
      <div className="flex justify-between text-[10px] tabular-nums text-[var(--viz-muted)]">
        <span>0 km</span>
        <span>{km(d1 - d0)} km</span>
      </div>
    </div>
  );
}

/** Fitness, fatigue and form after the day, with the change the day made. */
export function LoadTiles({ load }: { load: NonNullable<ActivityContext['load']> }) {
  const b = load.before;
  const tiles: [string, number, number | null, string][] = [
    ['Fitness', load.after.ctl, b ? load.after.ctl - b.ctl : null, 'var(--viz-ctl)'],
    ['Fatigue', load.after.atl, b ? load.after.atl - b.atl : null, 'var(--viz-atl)'],
    ['Form', load.after.tsb, b ? load.after.tsb - b.tsb : null, 'var(--viz-tsb)'],
  ];
  return (
    <Card title="Training load" note={`${Math.round(load.dayTss)} TSS that day · form ${zoneOf(load.after.tsb).toLowerCase()}`}>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map(([label, after, change, color]) => {
          const Icon = change == null || Math.abs(change) < 0.05 ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;
          return (
            <div key={label} className="rounded-lg bg-muted/50 px-3 py-2">
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--viz-muted)]">
                <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                {label}
              </div>
              <div className="text-xl font-semibold tabular-nums text-[var(--viz-ink)]">{label === 'Form' ? signed(after) : Math.round(after)}</div>
              <div className="flex items-center gap-0.5 text-[11px] tabular-nums text-[var(--viz-ink-2)]">
                <Icon aria-hidden className="h-3 w-3" />
                {change != null ? signed(change, 1) : '–'}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/**
 * Min, average and max, with the stream noise cut off: a zero heart rate or cadence (a sensor drop) does not count,
 * and the pace or speed range is the 2nd to 98th percentile of the moving values (GPS jumps out).
 */
export function MinAvgMax({ v }: { v: ActivityView }) {
  const st = v.stats;
  const s = v.series;
  const foot = v.layout === 'run';
  const pos = (x: number) => x > 0;
  const rows: [string, string, string, string][] = [];
  const hrLo = percentile(s?.hr, 1, pos);
  const hrHi = percentile(s?.hr, 100, pos);
  if (st.avgHr) rows.push(['Heart rate', hrLo ? `${int(hrLo)}` : '–', int(st.avgHr), st.maxHr ? int(st.maxHr) : hrHi ? int(hrHi) : '–']);
  const spLo = percentile(s?.speed, 2, (x) => x > 0.5);
  const spHi = percentile(s?.speed, 98, (x) => x > 0.5);
  if (v.layout !== 'basic' && st.avgSpeed) {
    rows.push(foot
      ? ['Pace /km', spLo ? pace(spLo) : '–', pace(st.avgSpeed), spHi ? pace(spHi) : '–']
      : ['Speed km/h', spLo ? kmh(spLo) : '–', kmh(st.avgSpeed), spHi ? kmh(spHi) : '–']);
  }
  if (st.avgWatts) rows.push(['Power W', '–', int(st.avgWatts), st.maxWatts ? int(st.maxWatts) : percentile(s?.watts, 100) != null ? int(percentile(s?.watts, 100)!) : '–']);
  const cadLo = percentile(s?.cad, 2, pos);
  const cadHi = percentile(s?.cad, 99, pos);
  if (st.avgCadence) rows.push([`Cadence ${foot ? 'spm' : 'rpm'}`, cadLo ? int(cadLo) : '–', int(st.avgCadence), cadHi ? int(cadHi) : '–']);
  const altAvg = s?.alt ? percentile(s.alt, 50) : null;
  if (st.elevHigh != null || altAvg != null) rows.push(['Elevation m', st.elevLow != null ? int(st.elevLow) : '–', altAvg != null ? int(altAvg) : '–', st.elevHigh != null ? int(st.elevHigh) : '–']);
  if (!rows.length) return null;
  return (
    <Card title="Min · avg · max" note="elevation avg is the median">
      <table className="w-full text-sm tabular-nums">
        <thead className="text-[11px] text-[var(--viz-muted)]">
          <tr>
            <th className="pb-1 text-left font-medium"><span className="sr-only">Metric</span></th>
            <th className="pb-1 text-right font-medium">Min</th>
            <th className="pb-1 text-right font-medium">Avg</th>
            <th className="pb-1 text-right font-medium">Max</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, lo, avg, hi]) => (
            <tr key={label} className="border-t">
              <td className="py-1.5 text-[var(--viz-ink-2)]">{label}</td>
              <td className="py-1.5 text-right text-[var(--viz-muted)]">{lo}</td>
              <td className="py-1.5 text-right font-semibold text-[var(--viz-ink)]">{avg}</td>
              <td className="py-1.5 text-right text-[var(--viz-ink)]">{hi}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
