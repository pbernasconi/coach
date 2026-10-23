import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import SectionError from '@/components/SectionError';
import ComplianceMark from '@/components/plan/ComplianceMark';
import { percents } from '@/lib/activity/format.mjs';
import type { ActivityContext, ActivityView, Zone } from '@/lib/activity/queries';
import {
  bestEffortRow, bestEffortsNote, garminRows, heartRateNote, lapRow, loadView, noStreamsText,
  paceHistogramView, plannedTexts, rankedSegments, sameRouteRows, segmentRow, segmentsNote, splitRow, zoneTexts,
} from '@/lib/activity/view.mjs';
import { rangeOfIndexes, splitRanges } from '@/lib/activity/ranges.mjs';
import { RangeRow, type HighlightRange } from './ActivityHover';
import Histogram from './Histogram';
import PaceBars from './PaceBars';
import PowerCurve from './PowerCurve';
import RouteMap from './RouteMap';
import RouteProfile from './RouteProfile';
import StatSummary from './StatSummary';
import StreamCharts from './StreamCharts';

export type SectionLink = { id: string; label: string; sub?: boolean };

/** The sub-nav entries this activity has, in page order (Strava's left menu). */
export function sectionsFor(v: ActivityView): SectionLink[] {
  const foot = v.layout === 'run';
  const out: SectionLink[] = [{ id: 'overview', label: 'Overview' }, { id: 'coach', label: "Coach's view" }];
  if (v.series) out.push({ id: 'analysis', label: 'Analysis' });
  if (v.layout !== 'basic' && (v.splits.length || v.laps.length > 1 || v.series?.speed)) out.push({ id: 'pace-analysis', label: foot ? 'Pace Analysis' : 'Speed Analysis', sub: true });
  if (foot && v.paceBins.length) out.push({ id: 'pace-distribution', label: 'Pace Distribution', sub: true });
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

/** A row's range on the chart series, or null when the activity has no streams or the row no indexes. */
function indexRange(v: ActivityView, key: string, label: string, item: { startIndex: number | null; endIndex: number | null }): HighlightRange | null {
  const r = v.series ? rangeOfIndexes(item, v.series) : null;
  return r ? { key, label, from: r.from, to: r.to } : null;
}

const th = 'px-2 py-1.5 text-right font-medium whitespace-nowrap';
const td = 'px-2 py-1.5 text-right tabular-nums whitespace-nowrap';

export function ZoneBars({ zones, unit, kind }: { zones: Zone[]; unit: string; kind: 'hr' | 'power' }) {
  const pct = percents(zones.map((z) => z.seconds));
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
          {zones.map((z, i) => ({ z, share: pct[i] })).reverse().map(({ z, share }) => (
            <tr key={z.zone} className="border-t">
              <td className="px-3 py-1.5 whitespace-nowrap">
                <b className="tabular-nums">Z{z.zone}</b> <span className="text-[var(--viz-ink-2)]">{z.name}</span>
                {/* On a phone the share bar sits under the zone name; its own column is hidden. */}
                <div aria-hidden className="mt-1 h-1.5 rounded-r-[3px] sm:hidden" style={{ width: `${Math.max(z.seconds ? 2 : 0, (z.seconds / max) * 100)}%`, background: `var(--viz-z${Math.min(7, z.zone)})` }} />
              </td>
              <td className="px-2 py-1.5 whitespace-nowrap tabular-nums text-[var(--viz-ink-2)]">{zoneTexts(z, unit).rangeText}</td>
              <td className="hidden px-2 py-1.5 sm:table-cell">
                <div className="h-3 rounded-r-[4px]" style={{ width: `${Math.max(z.seconds ? 1 : 0, (z.seconds / max) * 100)}%`, background: `var(--viz-z${Math.min(7, z.zone)})` }} />
              </td>
              <td className={td}>{zoneTexts(z, unit).timeText}</td>
              <td className={`${td} pr-3`}>{share}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Overview({ v, color }: { v: ActivityView; color: string }) {
  const splitR = v.series ? splitRanges(v.splits, v.series) : v.splits.map(() => null);
  const points = v.series?.lat && v.series.lng ? v.series.lat.map((la, i) => (la != null && v.series!.lng![i] != null ? ([v.series!.lng![i]!, la] as [number, number]) : null)) : null;

  return (
    <div className="space-y-6">
      <StatSummary v={v} />

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
                  {v.splits.map((s, i) => {
                    const r = splitRow(s);
                    return (
                      <RangeRow key={s.index} className="border-t" range={splitR[i] ? { key: `split-${s.index}`, label: `Km ${s.index}`, from: splitR[i]!.from, to: splitR[i]!.to } : null}>
                        <td className="px-3 py-1.5 tabular-nums">{r.label}</td>
                        <td className={td}>{r.paceText}</td>
                        <td className={td}>{r.gapText}</td>
                        <td className={td}>{r.elevText}</td>
                        <td className={`${td} pr-3`}>{r.hrText}</td>
                      </RangeRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {v.route.length > 1 && (
          <div className="min-w-0 space-y-2">
            <RouteMap route={v.route} points={points} color={color} label={`Route map of ${v.name}${v.place ? ` near ${v.place}` : ''}`} />
            {v.series && points && <RouteProfile series={v.series} foot={v.layout === 'run'} color={color} />}
          </div>
        )}
      </div>}
    </div>
  );
}

function CoachView({ v, c, failed }: { v: ActivityView; c: ActivityContext | null; failed: boolean }) {
  if (failed || !c) return <SectionError label="Coach's view" />;
  const garmin = garminRows(c.garmin);
  const load = loadView(v, c.load);
  const planned = c.planned ? plannedTexts(c.planned) : null;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-lg border p-4 text-sm">
        <div className="text-xs font-medium text-[var(--viz-muted)]">Planned workout</div>
        {c.planned ? (
          <>
            <Link href={`/plan?week=${c.planned.date}`} className="mt-1 block font-medium hover:underline">{c.planned.title}</Link>
            <p className="text-xs text-[var(--viz-ink-2)]">{planned!.plannedText}</p>
            <p className="mt-2 flex items-center gap-1.5 text-sm">
              <ComplianceMark level={c.planned.compliance.level} showLabel />
              {planned!.ratioText && <span className="tabular-nums text-[var(--viz-ink-2)]">· {planned!.ratioText}</span>}
            </p>
          </>
        ) : (
          <p className="mt-1 text-[var(--viz-ink-2)]">Not matched to a planned workout.</p>
        )}
      </div>
      <div className="rounded-lg border p-4 text-sm">
        <div className="text-xs font-medium text-[var(--viz-muted)]">Training load after this day</div>
        {load.rows.length ? (
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs tabular-nums">
            {load.rows.map((r) => (<Fragment key={r.key}><dt className="text-[var(--viz-muted)]">{r.label}</dt><dd>{r.valueText}</dd></Fragment>))}
          </dl>
        ) : (
          <p className="mt-1 text-xs text-[var(--viz-ink-2)]">{load.emptyText}</p>
        )}
      </div>
      <div className="rounded-lg border p-4 text-sm">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium text-[var(--viz-muted)]">Garmin that day</span>
          <Link href={`/health/day/${v.day}`} className="text-xs underline underline-offset-4">Day →</Link>
        </div>
        {c.garmin ? (
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs tabular-nums">
            {garmin.map((r) => (<Fragment key={r.key}><dt className="text-[var(--viz-muted)]">{r.label}</dt><dd>{r.valueText}</dd></Fragment>))}
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
  const rows = sameRouteRows(v, c);
  const foot = v.layout === 'run';
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{foot ? 'Runs' : 'Activities'} on this route <span className="font-normal text-[var(--viz-muted)]">same start within 250 m, distance within 10 %, fastest first</span></h3>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="text-xs text-[var(--viz-muted)]"><tr><th className="px-3 py-1.5 text-left font-medium">Date</th><th className="px-2 py-1.5 text-left font-medium">Name</th><th className={th}>Distance</th><th className={th}>Time</th><th className={`${th} pr-3`}>{foot ? 'Pace' : 'Speed'}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.stravaId} className={`border-t ${r.isThis ? 'bg-muted/50 font-medium' : ''}`}>
                <td className="px-3 py-1.5 tabular-nums">{r.day}</td>
                <td className="max-w-[12rem] truncate px-2 py-1.5">{r.isThis ? 'This activity' : <Link href={`/activities/${r.stravaId}`} className="hover:underline">{r.name}</Link>}</td>
                <td className={td}>{r.distanceText}</td>
                <td className={td}>{r.timeText}</td>
                <td className={`${td} pr-3`}>{r.paceText}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SegmentTable({ v, rows, bare = false }: { v: ActivityView; rows: ActivityView['segments']; bare?: boolean }) {
  const foot = v.layout === 'run';
  // Strava sends no rank for most efforts; the column shows only when one has it.
  const ranked = rows.some((sg) => segmentRow(sg, foot).rankText);
  return (
    <div className={`overflow-x-auto bg-[var(--viz-surface)] ${bare ? 'border-t' : 'rounded-lg border'}`}>
      <table className="w-full min-w-[520px] text-sm">
        <thead className="text-xs text-[var(--viz-muted)]">
          <tr><th className="px-3 py-1.5 text-left font-medium">Name</th><th className={th}>Distance</th><th className={th}>Grade</th><th className={th}>Time</th><th className={th}>{foot ? 'Pace' : 'Speed'}</th><th className={`${th} ${ranked ? '' : 'pr-3'}`}>HR</th>{ranked && <th className={`${th} pr-3`}>Rank</th>}</tr>
        </thead>
        <tbody>
          {rows.map((sg, i) => {
            const r = segmentRow(sg, foot);
            return (
              <RangeRow key={`${sg.id}-${i}`} className="border-t" range={indexRange(v, `seg-${v.segments.indexOf(sg)}`, sg.name, sg)}>
                <td className="max-w-[16rem] truncate px-3 py-1.5"><a href={`https://www.strava.com/segments/${sg.id}`} target="_blank" rel="noreferrer" className="hover:underline">{sg.name}</a></td>
                <td className={td}>{r.distanceText}</td>
                <td className={td}>{r.gradeText}</td>
                <td className={td}>{r.timeText}</td>
                <td className={td}>{r.paceText}</td>
                <td className={`${td} ${ranked ? '' : 'pr-3'}`}>{r.hrText}</td>
                {ranked && <td className={`${td} pr-3`}>{r.rankText}</td>}
              </RangeRow>
            );
          })}
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
  const hist = paceHistogramView(v);
  const effortsRanked = v.bestEfforts.some((e) => bestEffortRow(e).rankText);
  return (
    <>
      <Overview v={v} color={color} />
      <SameRoute v={v} c={context} />

      <Card id="coach" title="Coach's view">
        <CoachView v={v} c={context} failed={contextFailed} />
      </Card>

      {series ? (
        <Card id="analysis" title="Analysis">
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
            {noStreamsText(v.fetch)}
          </p>
        </Card>
      )}

      {v.layout !== 'basic' && (v.splits.length > 0 || v.laps.length > 1 || series?.speed) && (
        <Card id="pace-analysis" title={foot ? 'Pace Analysis' : 'Speed Analysis'}>
          <PaceBars splits={v.splits} laps={v.laps} series={series} layout={v.layout} color={color} />
        </Card>
      )}

      {foot && v.paceBins.length > 0 && (
        <Card id="pace-distribution" title="Pace Distribution">
          <div className="rounded-lg border bg-[var(--viz-surface)] p-4">
            <Histogram
              bins={hist.bins}
              color={color}
              title="Moving time by pace"
              unit="/km"
              mark={hist.avgLabel ? { index: hist.avgIndex, label: hist.avgLabel } : undefined}
            />
          </div>
        </Card>
      )}

      {hrTotal > 0 && (
        <Card id="heart-rate" title="Heart Rate" note={heartRateNote(st)}>
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
        <Card id="laps" title="Laps">
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
                {v.laps.map((l) => {
                  const r = lapRow(l, foot);
                  return (
                    <RangeRow key={l.index} className="border-t" range={indexRange(v, `lap-${l.index}`, `Lap ${l.index}`, l)}>
                      <td className="px-3 py-1.5 tabular-nums">{l.index}</td>
                      <td className={td}>{r.distanceText}</td>
                      <td className={td}>{r.timeText}</td>
                      <td className={td}>{r.paceText}</td>
                      {foot && <td className={td}>{r.gapText}</td>}
                      <td className={td}>{r.elevText}</td>
                      <td className={td}>{r.hrText}</td>
                      {v.laps.some((x) => x.watts) && <td className={`${td} pr-3`}>{r.powerText}</td>}
                    </RangeRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {v.bestEfforts.length > 0 && (
        <Card id="best-efforts" title="Best Efforts" note={bestEffortsNote(v.bestEffortsSource)}>
          <div className="overflow-x-auto rounded-lg border bg-[var(--viz-surface)]">
            <table className="w-full text-sm">
              <thead className="text-xs text-[var(--viz-muted)]"><tr><th className="px-3 py-1.5 text-left font-medium">Distance</th><th className={th}>Time</th><th className={`${th} ${effortsRanked ? '' : 'pr-3'}`}>Pace</th>{effortsRanked && <th className={`${th} pr-3`}>Rank</th>}</tr></thead>
              <tbody>
                {v.bestEfforts.map((e) => (
                  <RangeRow key={e.label} className="border-t" range={indexRange(v, `best-${e.label}`, `Best ${e.label}`, e)}>
                    <td className="px-3 py-1.5">{e.label}</td>
                    <td className={td}>{bestEffortRow(e).timeText}</td>
                    <td className={`${td} ${effortsRanked ? '' : 'pr-3'}`}>{bestEffortRow(e).paceText}</td>
                    {effortsRanked && <td className={`${td} pr-3`}>{bestEffortRow(e).rankText}</td>}
                  </RangeRow>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {v.segments.length > 0 && (
        <Card id="segments" title="Segments" note={segmentsNote(v.segments)}>
          <SegmentTable v={v} rows={rankedSegments(v.segments).slice(0, 15)} />
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
