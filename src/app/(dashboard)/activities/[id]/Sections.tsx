import Link from 'next/link';
import { tssMethodLabel } from '@/lib/strava-sync/tss.mjs';
import type { ReactNode } from 'react';
import SectionError from '@/components/SectionError';
import ComplianceMark from '@/components/plan/ComplianceMark';
import { duration, int, km, kmh, pace, paceOfSeconds, signed, zoneRange } from '@/lib/activity/format.mjs';
import type { ActivityContext, ActivityView, Zone } from '@/lib/activity/queries';
import { compass, weatherLabel } from '@/lib/activity/weather.mjs';
import { zoneOf } from '@/lib/performance/form';
import { rangeOfIndexes, splitRanges } from '@/lib/activity/ranges.mjs';
import { RangeRow, type HighlightRange } from './ActivityHover';
import Histogram from './Histogram';
import PaceBars from './PaceBars';
import PowerCurve from './PowerCurve';
import RouteMap from './RouteMap';
import StreamCharts from './StreamCharts';

export type SectionLink = { id: string; label: string; sub?: boolean };

/** The sub-nav entries this activity has, in page order (Strava's left menu). */
export function sectionsFor(v: ActivityView): SectionLink[] {
  const foot = v.layout === 'run';
  const out: SectionLink[] = [{ id: 'overview', label: 'Overview' }, { id: 'coach', label: "Coach's view" }];
  if (v.series) out.push({ id: 'analysis', label: 'Analysis' });
  if (v.layout !== 'basic' && (v.splits.length || v.laps.length > 1 || v.series?.speed)) out.push({ id: 'pace-analysis', label: foot ? 'Pace Analysis' : 'Speed Analysis', sub: true });
  if (foot && v.paceBins.length) out.push({ id: 'pace-distribution', label: 'Pace Distribution', sub: true });
  out.push({ id: 'relative-effort', label: 'Relative Effort', sub: true });
  if (v.hrZones.some((z) => z.seconds > 0)) out.push({ id: 'heart-rate', label: 'Heart Rate', sub: true });
  if (v.powerZones.length || v.powerCurve.length) out.push({ id: 'power', label: 'Power', sub: true });
  if (v.laps.length > 1) out.push({ id: 'laps', label: 'Laps' });
  if (v.bestEfforts.length) out.push({ id: 'best-efforts', label: 'Best Efforts' });
  if (v.segments.length) out.push({ id: 'segments', label: 'Segments' });
  return out;
}

function Card({ id, title, note, children, className = '' }: { id?: string; title: string; note?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-32 space-y-3 ${className}`} aria-labelledby={id ? `${id}-h` : undefined}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id ? `${id}-h` : undefined} className="text-lg font-semibold">{title}</h2>
        {note && <p className="text-xs text-[var(--viz-muted)]">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, unit, big = false }: { label: string; value: string; unit?: string; big?: boolean }) {
  return (
    <div className="min-w-0">
      <div className={`${big ? 'text-2xl sm:text-3xl' : 'text-lg'} font-semibold tabular-nums tracking-tight text-[var(--viz-ink)]`}>
        {value}
        {unit && <span className={`${big ? 'text-base' : 'text-sm'} ml-0.5 font-normal text-[var(--viz-ink-2)]`}>{unit}</span>}
      </div>
      <div className="text-xs text-[var(--viz-muted)]">{label}</div>
    </div>
  );
}

/** A row's range on the chart series, or null when the activity has no streams or the row no indexes. */
function indexRange(v: ActivityView, key: string, label: string, item: { startIndex: number | null; endIndex: number | null }): HighlightRange | null {
  const r = v.series ? rangeOfIndexes(item, v.series) : null;
  return r ? { key, label, from: r.from, to: r.to } : null;
}

const th = 'px-2 py-1.5 text-right font-medium whitespace-nowrap';
const td = 'px-2 py-1.5 text-right tabular-nums whitespace-nowrap';

export function ZoneBars({ zones, unit, kind }: { zones: Zone[]; unit: string; kind: 'hr' | 'power' }) {
  const total = zones.reduce((n, z) => n + z.seconds, 0) || 1;
  const max = Math.max(...zones.map((z) => z.seconds), 1);
  return (
    <div className="overflow-x-auto rounded-lg border bg-[var(--viz-surface)]">
      <table className="w-full text-sm sm:min-w-[420px]">
        <caption className="sr-only">Time in {kind === 'hr' ? 'heart-rate' : 'power'} zones</caption>
        <thead className="text-xs text-[var(--viz-muted)]">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Zone</th>
            <th className="px-2 py-2 text-left font-medium">Range</th>
            <th className="hidden w-1/2 px-2 py-2 text-left font-medium sm:table-cell"><span className="sr-only">Share</span></th>
            <th className={th}>Time</th>
            <th className={`${th} pr-3`}>%</th>
          </tr>
        </thead>
        <tbody>
          {[...zones].reverse().map((z) => (
            <tr key={z.zone} className="border-t">
              <td className="px-3 py-1.5 whitespace-nowrap">
                <b className="tabular-nums">Z{z.zone}</b> <span className="text-[var(--viz-ink-2)]">{z.name}</span>
                {/* On a phone the share bar sits under the zone name; its own column is hidden. */}
                <div aria-hidden className="mt-1 h-1.5 rounded-r-[3px] sm:hidden" style={{ width: `${Math.max(z.seconds ? 2 : 0, (z.seconds / max) * 100)}%`, background: `var(--viz-z${Math.min(7, z.zone)})` }} />
              </td>
              <td className="px-2 py-1.5 whitespace-nowrap tabular-nums text-[var(--viz-ink-2)]">{zoneRange(z.min, z.max, unit)}</td>
              <td className="hidden px-2 py-1.5 sm:table-cell">
                <div className="h-3 rounded-r-[4px]" style={{ width: `${Math.max(z.seconds ? 1 : 0, (z.seconds / max) * 100)}%`, background: `var(--viz-z${Math.min(7, z.zone)})` }} />
              </td>
              <td className={td}>{z.seconds ? duration(z.seconds) : '–'}</td>
              <td className={`${td} pr-3`}>{Math.round((z.seconds / total) * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Overview({ v, color }: { v: ActivityView; color: string }) {
  const foot = v.layout === 'run';
  const st = v.stats;
  const big = [
    st.distance > 0 && { label: 'Distance', value: km(st.distance), unit: 'km' },
    { label: 'Moving Time', value: duration(st.moving) },
    foot && st.avgSpeed && { label: 'Pace', value: pace(st.avgSpeed), unit: '/km' },
    !foot && st.avgSpeed && st.distance > 0 && { label: 'Avg Speed', value: kmh(st.avgSpeed), unit: 'km/h' },
    v.effort.sufferScore != null && { label: 'Relative Effort', value: String(v.effort.sufferScore) },
    v.effort.tss != null && { label: 'Coach TSS', value: String(Math.round(v.effort.tss)) },
  ].filter(Boolean) as { label: string; value: string; unit?: string }[];
  const small = [
    st.elevGain > 0 && { label: 'Elevation', value: int(st.elevGain), unit: 'm' },
    { label: 'Elapsed Time', value: duration(st.elapsed) },
    st.calories != null && { label: 'Calories', value: int(st.calories) },
    foot && st.avgGapSpeed && { label: 'GAP', value: pace(st.avgGapSpeed), unit: '/km' },
    st.avgHr && { label: 'Avg Heart Rate', value: int(st.avgHr), unit: 'bpm' },
    st.maxHr && { label: 'Max Heart Rate', value: int(st.maxHr), unit: 'bpm' },
    st.avgCadence && { label: 'Cadence', value: int(st.avgCadence), unit: foot ? 'spm' : 'rpm' },
    st.avgWatts && { label: st.deviceWatts ? 'Avg Power' : 'Est. Avg Power', value: int(st.avgWatts), unit: 'W' },
    v.layout === 'ride' && st.np && { label: 'Weighted Avg Power', value: int(st.np), unit: 'W' },
    st.kj && v.layout === 'ride' && { label: 'Total Work', value: int(st.kj), unit: 'kJ' },
    !foot && st.maxSpeed && st.distance > 0 && { label: 'Max Speed', value: kmh(st.maxSpeed), unit: 'km/h' },
    st.avgTemp != null && { label: 'Device Temp', value: String(Math.round(st.avgTemp)), unit: '°C' },
    st.perceivedExertion != null && { label: 'Perceived Exertion', value: `${st.perceivedExertion}/10` },
  ].filter(Boolean) as { label: string; value: string; unit?: string }[];
  const w = v.weather;
  const splitR = v.series ? splitRanges(v.splits, v.series) : v.splits.map(() => null);
  const points = v.series?.lat && v.series.lng ? v.series.lat.map((la, i) => (la != null && v.series!.lng![i] != null ? ([v.series!.lng![i]!, la] as [number, number]) : null)) : null;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-[var(--viz-surface)] p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{big.map((b) => <Stat key={b.label} {...b} big />)}</div>
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 sm:grid-cols-4 lg:grid-cols-6">{small.map((b) => <Stat key={b.label} {...b} />)}</div>
        {(st.achievements > 0 || st.prs > 0 || st.kudos > 0) && (
          <p className="mt-3 text-xs text-[var(--viz-muted)]">
            {[st.prs ? `${st.prs} PR${st.prs > 1 ? 's' : ''}` : null, st.achievements ? `${st.achievements} achievement${st.achievements > 1 ? 's' : ''}` : null, st.kudos ? `${st.kudos} kudos` : null].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      {(w || v.device || v.gear) && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {w && (
          <div className="rounded-lg border p-4 text-sm">
            <div className="text-xs font-medium text-[var(--viz-muted)]">Weather at the start</div>
            <div className="mt-1 text-lg font-semibold">{weatherLabel(w.code)}{w.tempC != null ? `, ${Math.round(w.tempC)} °C` : ''}</div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {w.feelsLikeC != null && (<><dt className="text-[var(--viz-muted)]">Feels like</dt><dd className="tabular-nums">{Math.round(w.feelsLikeC)} °C</dd></>)}
              {w.humidityPct != null && (<><dt className="text-[var(--viz-muted)]">Humidity</dt><dd className="tabular-nums">{Math.round(w.humidityPct)}%</dd></>)}
              {w.windKmh != null && (<><dt className="text-[var(--viz-muted)]">Wind</dt><dd className="tabular-nums">{w.windKmh.toFixed(1)} km/h {compass(w.windDeg)}</dd></>)}
              {w.precipMm != null && w.precipMm > 0 && (<><dt className="text-[var(--viz-muted)]">Rain</dt><dd className="tabular-nums">{w.precipMm} mm/h</dd></>)}
            </dl>
            <p className="mt-2 text-[10px] text-[var(--viz-muted)]">Open-Meteo{w.source.includes('archive') ? ' archive' : ''}, the hour nearest the start</p>
          </div>
        )}
        {(v.device || v.gear) && (
          <div className="rounded-lg border p-4 text-sm">
            {v.device && (<><div className="text-xs font-medium text-[var(--viz-muted)]">Device</div><div className="mb-2 font-medium">{v.device}</div></>)}
            {v.gear && (
              <>
                <div className="text-xs font-medium text-[var(--viz-muted)]">{v.layout === 'ride' ? 'Bike' : 'Shoes'}</div>
                <div className="font-medium">{v.gear.name}{v.gear.distance != null && <span className="font-normal text-[var(--viz-ink-2)]"> ({int(v.gear.distance / 1000)} km)</span>}</div>
              </>
            )}
          </div>
        )}
      </div>}

      {(v.splits.length > 0 || v.route.length > 1) && <div className={`grid gap-6 ${v.splits.length && v.route.length > 1 ? 'lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]' : ''}`}>
        {v.splits.length > 0 && (
          <div className="min-w-0">
            <h3 className="mb-2 text-sm font-semibold">Splits <span className="font-normal text-[var(--viz-muted)]">{v.splitsSource === 'streams' ? 'from the streams' : ''}</span></h3>
            <div className="overflow-x-auto rounded-lg border bg-[var(--viz-surface)]">
              <table className="w-full text-sm">
                <thead className="text-xs text-[var(--viz-muted)]">
                  <tr><th className="px-3 py-1.5 text-left font-medium">Km</th><th className={th}>Pace</th><th className={th}>GAP</th><th className={th}>Elev</th><th className={`${th} pr-3`}>HR</th></tr>
                </thead>
                <tbody>
                  {v.splits.map((s, i) => (
                    <RangeRow key={s.index} className="border-t" range={splitR[i] ? { key: `split-${s.index}`, label: `Km ${s.index}`, from: splitR[i]!.from, to: splitR[i]!.to } : null}>
                      <td className="px-3 py-1.5 tabular-nums">{s.distance < 950 ? (s.distance / 1000).toFixed(1) : s.index}</td>
                      <td className={td}>{pace(s.speed ?? (s.moving ? s.distance / s.moving : 0))}</td>
                      <td className={td}>{s.gapSpeed ? pace(s.gapSpeed) : '–'}</td>
                      <td className={td}>{s.elevDiff != null ? signed(s.elevDiff) : '–'}</td>
                      <td className={`${td} pr-3`}>{s.hr ? Math.round(s.hr) : '–'}</td>
                    </RangeRow>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {v.route.length > 1 && (
          <div className="min-w-0">
            <RouteMap route={v.route} points={points} color={color} label={`Route map of ${v.name}${v.place ? ` near ${v.place}` : ''}`} />
          </div>
        )}
      </div>}
    </div>
  );
}

function CoachView({ v, c, failed }: { v: ActivityView; c: ActivityContext | null; failed: boolean }) {
  if (failed || !c) return <SectionError label="Coach's view" />;
  const g = c.garmin;
  const d = c.load;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-lg border p-4 text-sm">
        <div className="text-xs font-medium text-[var(--viz-muted)]">Planned workout</div>
        {c.planned ? (
          <>
            <Link href={`/plan?week=${c.planned.date}`} className="mt-1 block font-medium hover:underline">{c.planned.title}</Link>
            <p className="text-xs text-[var(--viz-ink-2)]">
              {[c.planned.duration ? `${c.planned.duration} min planned` : null, c.planned.tss ? `${Math.round(c.planned.tss)} TSS planned` : null].filter(Boolean).join(' · ')}
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-sm">
              <ComplianceMark level={c.planned.compliance.level} showLabel />
              {c.planned.compliance.ratio != null && (
                <span className="tabular-nums text-[var(--viz-ink-2)]">· {Math.round(c.planned.compliance.ratio * 100)}% of the planned {c.planned.compliance.basis === 'tss' ? 'TSS' : 'time'}</span>
              )}
            </p>
          </>
        ) : (
          <p className="mt-1 text-[var(--viz-ink-2)]">Not matched to a planned workout.</p>
        )}
      </div>
      <div className="rounded-lg border p-4 text-sm">
        <div className="text-xs font-medium text-[var(--viz-muted)]">Load</div>
        <p className="mt-1">
          <b className="text-lg tabular-nums">{v.effort.tss != null ? Math.round(v.effort.tss) : '–'}</b> TSS
          <span className="text-xs text-[var(--viz-muted)]">{v.effort.tssMethod ? ` · ${tssMethodLabel(v.effort.tssMethod)}` : ''}</span>
        </p>
        {d ? (
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs tabular-nums">
            <dt className="text-[var(--viz-muted)]">Fitness (CTL)</dt><dd>{Math.round(d.after.ctl)}{d.before ? ` (${signed(d.after.ctl - d.before.ctl, 1)})` : ''}</dd>
            <dt className="text-[var(--viz-muted)]">Fatigue (ATL)</dt><dd>{Math.round(d.after.atl)}{d.before ? ` (${signed(d.after.atl - d.before.atl, 1)})` : ''}</dd>
            <dt className="text-[var(--viz-muted)]">Form (TSB)</dt><dd>{signed(d.after.tsb)} {zoneOf(d.after.tsb).toLowerCase()}{d.before ? ` (${signed(d.after.tsb - d.before.tsb, 1)})` : ''}</dd>
            {d.dayTss !== (v.effort.tss ?? 0) && (<><dt className="text-[var(--viz-muted)]">TSS that day</dt><dd>{Math.round(d.dayTss)}</dd></>)}
          </dl>
        ) : (
          <p className="mt-1 text-xs text-[var(--viz-ink-2)]">No load row for {v.day}.</p>
        )}
      </div>
      <div className="rounded-lg border p-4 text-sm">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium text-[var(--viz-muted)]">Garmin that day</span>
          <Link href={`/health/day/${v.day}`} className="text-xs underline underline-offset-4">Day →</Link>
        </div>
        {g ? (
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs tabular-nums">
            {g.sleep_score != null && (<><dt className="text-[var(--viz-muted)]">Sleep the night before</dt><dd>{Math.round(g.sleep_score)}{g.sleep_total_min ? ` · ${duration(g.sleep_total_min * 60).replace(/:\d\d$/, '')} h` : ''}</dd></>)}
            {g.body_battery_high != null && (<><dt className="text-[var(--viz-muted)]">Body Battery</dt><dd>{Math.round(g.body_battery_high)} high · {Math.round(g.body_battery_low ?? 0)} low</dd></>)}
            {g.hrv_night_avg_ms != null && (<><dt className="text-[var(--viz-muted)]">HRV (night)</dt><dd>{Math.round(g.hrv_night_avg_ms)} ms</dd></>)}
            {g.resting_hr_bpm != null && (<><dt className="text-[var(--viz-muted)]">Resting HR</dt><dd>{Math.round(g.resting_hr_bpm)} bpm</dd></>)}
            {g.training_readiness != null && (<><dt className="text-[var(--viz-muted)]">Training readiness</dt><dd>{Math.round(g.training_readiness)}</dd></>)}
          </dl>
        ) : (
          <p className="mt-1 text-xs text-[var(--viz-ink-2)]">No Garmin data for {v.day}.</p>
        )}
      </div>
    </div>
  );
}

function SameRoute({ v, c }: { v: ActivityView; c: ActivityContext | null }) {
  if (!c?.sameRoute.length) return null;
  const rows = [{ stravaId: v.stravaId, day: v.day, name: v.name, moving: v.stats.moving, distance: v.stats.distance }, ...c.sameRoute].sort((a, b) => a.moving / a.distance - b.moving / b.distance);
  const foot = v.layout === 'run';
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{foot ? 'Runs' : 'Activities'} on this route <span className="font-normal text-[var(--viz-muted)]">same start within 250 m, distance within 10 %, fastest first</span></h3>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="text-xs text-[var(--viz-muted)]"><tr><th className="px-3 py-1.5 text-left font-medium">Date</th><th className="px-2 py-1.5 text-left font-medium">Name</th><th className={th}>Distance</th><th className={th}>Time</th><th className={`${th} pr-3`}>{foot ? 'Pace' : 'Speed'}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.stravaId} className={`border-t ${r.stravaId === v.stravaId ? 'bg-muted/50 font-medium' : ''}`}>
                <td className="px-3 py-1.5 tabular-nums">{r.day}</td>
                <td className="max-w-[12rem] truncate px-2 py-1.5">{r.stravaId === v.stravaId ? 'This activity' : <Link href={`/activities/${r.stravaId}`} className="hover:underline">{r.name}</Link>}</td>
                <td className={td}>{km(r.distance)} km</td>
                <td className={td}>{duration(r.moving)}</td>
                <td className={`${td} pr-3`}>{foot ? pace(r.distance / r.moving) : `${kmh(r.distance / r.moving)} km/h`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Segments with a PR or KOM rank first (best rank first), then the rest in ride order. */
function rankedSegments(v: ActivityView) {
  const rank = (x: ActivityView['segments'][number]) => Math.min(x.prRank ?? 99, x.komRank ?? 99);
  return [...v.segments].sort((a, b) => rank(a) - rank(b));
}

function SegmentTable({ v, rows, bare = false }: { v: ActivityView; rows: ActivityView['segments']; bare?: boolean }) {
  const foot = v.layout === 'run';
  return (
    <div className={`overflow-x-auto bg-[var(--viz-surface)] ${bare ? 'border-t' : 'rounded-lg border'}`}>
      <table className="w-full min-w-[520px] text-sm">
        <thead className="text-xs text-[var(--viz-muted)]">
          <tr><th className="px-3 py-1.5 text-left font-medium">Name</th><th className={th}>Distance</th><th className={th}>Grade</th><th className={th}>Time</th><th className={th}>{foot ? 'Pace' : 'Speed'}</th><th className={th}>HR</th><th className={`${th} pr-3`}>Rank</th></tr>
        </thead>
        <tbody>
          {rows.map((sg, i) => (
            <RangeRow key={`${sg.id}-${i}`} className="border-t" range={indexRange(v, `seg-${v.segments.indexOf(sg)}`, sg.name, sg)}>
              <td className="max-w-[16rem] truncate px-3 py-1.5"><a href={`https://www.strava.com/segments/${sg.id}`} target="_blank" rel="noreferrer" className="hover:underline">{sg.name}</a></td>
              <td className={td}>{km(sg.distance)} km</td>
              <td className={td}>{sg.grade != null ? `${sg.grade.toFixed(1)}%` : '–'}</td>
              <td className={td}>{duration(sg.seconds)}</td>
              <td className={td}>{foot ? `${pace(sg.distance / sg.seconds)} /km` : `${kmh(sg.distance / sg.seconds)} km/h`}</td>
              <td className={td}>{sg.hr ? Math.round(sg.hr) : '–'}</td>
              <td className={`${td} pr-3`}>{sg.komRank ? `KOM #${sg.komRank}` : sg.prRank === 1 ? 'PR' : sg.prRank ? `#${sg.prRank}` : ''}</td>
            </RangeRow>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Every section of the page under the header. */
export function ActivityBody({ v, context, contextFailed, color }: { v: ActivityView; context: ActivityContext | null; contextFailed: boolean; color: string }) {
  const foot = v.layout === 'run';
  const series = v.series;
  const st = v.stats;
  const hrTotal = v.hrZones.reduce((n, z) => n + z.seconds, 0);
  const avgBin = foot && st.avgSpeed ? v.paceBins.findIndex((b) => 1000 / st.avgSpeed! >= b.from && 1000 / st.avgSpeed! < b.to) : -1;
  return (
    <>
      <Overview v={v} color={color} />
      <SameRoute v={v} c={context} />

      <Card id="coach" title="Coach's view" note="The plan, the training load, and Garmin's recovery data">
        <CoachView v={v} c={context} failed={contextFailed} />
      </Card>

      {series ? (
        <Card id="analysis" title="Analysis" note={foot ? 'Pace is upside down: faster is higher.' : undefined}>
          <StreamCharts
            series={series}
            layout={v.layout}
            sportColor={color}
            avgs={{
              speed: st.avgSpeed, gap: st.avgGapSpeed, hr: st.avgHr, cad: st.avgCadence,
              watts: st.avgWatts && (v.layout === 'ride' || st.deviceWatts) ? st.avgWatts : null, temp: st.avgTemp,
            }}
          />
        </Card>
      ) : (
        <Card id="analysis" title="Analysis">
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {v.fetch.needed ? 'The streams are loading from Strava.' : v.fetch.note ? 'The streams did not load from Strava yet.' : 'Strava has no streams for this activity (no GPS or sensor data).'}
          </p>
        </Card>
      )}

      {v.layout !== 'basic' && (v.splits.length > 0 || v.laps.length > 1 || series?.speed) && (
        <Card id="pace-analysis" title={foot ? 'Pace Analysis' : 'Speed Analysis'}>
          <PaceBars splits={v.splits} laps={v.laps} series={series} layout={v.layout} color={color} />
        </Card>
      )}

      {foot && v.paceBins.length > 0 && (
        <Card id="pace-distribution" title="Pace Distribution" note="Moving time per 15 s of pace">
          <div className="rounded-lg border bg-[var(--viz-surface)] p-4">
            <Histogram
              bins={v.paceBins.map((b) => ({ label: paceOfSeconds(b.from), seconds: b.seconds }))}
              color={color}
              title="Moving time by pace"
              unit="/km"
              mark={avgBin >= 0 ? { index: avgBin, label: `avg ${pace(st.avgSpeed!)}` } : undefined}
            />
          </div>
        </Card>
      )}

      <Card id="relative-effort" title="Relative Effort" note="Strava's score and two other ways to count the load">
        <div className="grid grid-cols-2 gap-4 rounded-lg border bg-[var(--viz-surface)] p-4 sm:grid-cols-4">
          <Stat label="Relative Effort (Strava)" value={v.effort.sufferScore != null ? String(v.effort.sufferScore) : '–'} big />
          <Stat label="TRIMP (from HR)" value={v.effort.trimp != null ? String(v.effort.trimp) : '–'} big />
          <Stat label="Coach TSS" value={v.effort.tss != null ? String(Math.round(v.effort.tss)) : '–'} big />
          <Stat label="TSS per hour" value={v.effort.tss != null && st.moving ? String(Math.round(v.effort.tss / (st.moving / 3600))) : '–'} big />
        </div>
        {(v.effort.tssMethod === 'power' || v.effort.tssMethod === 'power_stream') && v.layout === 'run' && v.effort.ftp && (
          <p className="text-xs text-[var(--viz-muted)]">
            This TSS uses running power against the cycling FTP ({v.effort.ftp} W), so it reads high for a run. TRIMP and Relative Effort come from heart rate.
          </p>
        )}
      </Card>

      {hrTotal > 0 && (
        <Card id="heart-rate" title="Heart Rate" note={`Strava's zones${st.avgHr ? ` · avg ${Math.round(st.avgHr)} bpm` : ''}${st.maxHr ? ` · max ${st.maxHr} bpm` : ''}`}>
          <ZoneBars zones={v.hrZones} unit="bpm" kind="hr" />
        </Card>
      )}

      {(v.powerZones.length > 0 || v.powerCurve.length > 0) && (
        <Card id="power" title="Power" note={v.effort.ftp ? `FTP ${v.effort.ftp} W` : undefined}>
          {v.powerCurve.length > 1 && (
            <div className="rounded-lg border bg-[var(--viz-surface)] p-4">
              <h3 className="mb-2 text-sm font-semibold">Power curve <span className="font-normal text-[var(--viz-muted)]">best average power for each duration</span></h3>
              <PowerCurve points={v.powerCurve} ftp={v.effort.ftp} />
            </div>
          )}
          {v.powerZones.length > 0 && <ZoneBars zones={v.powerZones} unit="W" kind="power" />}
        </Card>
      )}

      {v.laps.length > 1 && (
        <Card id="laps" title="Laps" note={v.series ? "Point at a row to show it on the charts and the map. Click to pin it." : undefined}>
          <div className="overflow-x-auto rounded-lg border bg-[var(--viz-surface)]">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-xs text-[var(--viz-muted)]">
                <tr>
                  <th className="px-3 py-1.5 text-left font-medium">Lap</th><th className={th}>Distance</th><th className={th}>Time</th>
                  <th className={th}>{foot ? 'Pace' : 'Speed'}</th>{foot && <th className={th}>GAP</th>}<th className={th}>Elev</th><th className={th}>HR</th>
                  {v.laps.some((l) => l.watts) && <th className={`${th} pr-3`}>Power</th>}
                </tr>
              </thead>
              <tbody>
                {v.laps.map((l) => (
                  <RangeRow key={l.index} className="border-t" range={indexRange(v, `lap-${l.index}`, `Lap ${l.index}`, l)}>
                    <td className="px-3 py-1.5 tabular-nums">{l.index}</td>
                    <td className={td}>{km(l.distance)} km</td>
                    <td className={td}>{duration(l.moving || l.elapsed)}</td>
                    <td className={td}>{foot ? `${pace(l.speed ?? 0)} /km` : `${kmh(l.speed ?? 0)} km/h`}</td>
                    {foot && <td className={td}>{l.gapSpeed ? `${pace(l.gapSpeed)} /km` : '–'}</td>}
                    <td className={td}>{l.elevGain != null ? `${int(l.elevGain)} m` : '–'}</td>
                    <td className={td}>{l.hr ? `${Math.round(l.hr)} bpm` : '–'}</td>
                    {v.laps.some((x) => x.watts) && <td className={`${td} pr-3`}>{l.watts ? `${Math.round(l.watts)} W` : '–'}</td>}
                  </RangeRow>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {v.bestEfforts.length > 0 && (
        <Card id="best-efforts" title="Best Efforts" note={v.bestEffortsSource === 'streams' ? 'From the streams (Strava sent none)' : 'From Strava'}>
          <div className="overflow-x-auto rounded-lg border bg-[var(--viz-surface)]">
            <table className="w-full text-sm">
              <thead className="text-xs text-[var(--viz-muted)]"><tr><th className="px-3 py-1.5 text-left font-medium">Distance</th><th className={th}>Time</th><th className={th}>Pace</th><th className={`${th} pr-3`}>Rank</th></tr></thead>
              <tbody>
                {v.bestEfforts.map((e) => (
                  <RangeRow key={e.label} className="border-t" range={indexRange(v, `best-${e.label}`, `Best ${e.label}`, e)}>
                    <td className="px-3 py-1.5">{e.label}</td>
                    <td className={td}>{duration(e.seconds)}</td>
                    <td className={td}>{pace(e.distance / e.seconds)} /km</td>
                    <td className={`${td} pr-3`}>{e.prRank === 1 ? 'PR' : e.prRank ? `${e.prRank === 2 ? '2nd' : '3rd'} best` : ''}</td>
                  </RangeRow>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {v.segments.length > 0 && (
        <Card id="segments" title="Segments" note={`${v.segments.length} segment${v.segments.length > 1 ? 's' : ''}${v.segments.some((x) => x.prRank || x.komRank) ? ' · PRs and top 10s first' : ''}`}>
          <SegmentTable v={v} rows={rankedSegments(v).slice(0, 15)} />
          {v.segments.length > 15 && (
            <details className="rounded-lg border">
              <summary className="cursor-pointer select-none p-3 text-sm font-medium">All {v.segments.length} segments, in ride order</summary>
              <SegmentTable v={v} rows={v.segments} bare />
            </details>
          )}
        </Card>
      )}

      <p className="text-xs text-[var(--viz-muted)]">
        Data: Strava (activity, streams, laps, segments, zones), Open-Meteo (weather), OpenStreetMap (place, map tiles by OpenFreeMap). GAP: Minetti&apos;s cost of running on a grade; Strava&apos;s own GAP in the splits.
      </p>
    </>
  );
}
