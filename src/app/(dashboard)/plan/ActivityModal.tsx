'use client';

import Link from 'next/link';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import SportIcon from '@/components/SportIcon';
import PeakCurve from '@/components/charts/PeakCurve';
import { cn } from '@/lib/utils';
import { sport, stravaTypeLabel } from '@/lib/sports';
import { duration, int, km, kmh, pace, paceOfSeconds, signed } from '@/lib/activity/format.mjs';
import { PEAK_DURATIONS, peakCurve } from '@/lib/activity/peaks.mjs';
import { NOT_LOADED_NOTE } from '@/lib/activity/view.mjs';
import { weatherLabel } from '@/lib/activity/weather.mjs';
import { plainTitle } from '@/lib/plan/calendar.mjs';
import { LIFT_MARKER } from '@/lib/plan/lift-plan.mjs';
import type { ActivityContext, ActivityView } from '@/lib/activity/queries';
import type { CalendarWorkout } from '@/lib/plan/month';
import { ActivityHoverProvider } from '../activities/[id]/ActivityHover';
import Histogram from '../activities/[id]/Histogram';
import PowerCurve from '../activities/[id]/PowerCurve';
import RouteMap from '../activities/[id]/RouteMap';
import RouteProfile from '../activities/[id]/RouteProfile';
import StreamCharts from '../activities/[id]/StreamCharts';
import { ZoneBars } from '../activities/[id]/Sections';
import EffortLog from './EffortLog';
import { BestEfforts, ElevationProfile, LoadTiles, MinAvgMax, PlanVsDone, SplitBars, StatGrid, ZoneStrip } from './ActivityOverview';
import { activityPreviewAction } from './actions';
import { Description, Failed, Header, Hero, Loading, OpenButton, Panel, Section, SectionNav, StatusChip, clock, longDay, td, th, useLoad } from './ModalParts';

// ---------------------------------------------------------------------------------------------------------------
// Activity

type ATab = 'overview' | 'hr' | 'power' | 'pace' | 'laps' | 'charts';

export default function ActivityModal({ id, planned, onClose }: { id: string; planned: CalendarWorkout | null; onClose: () => void }) {
  const state = useLoad(() => activityPreviewAction(id), [id]);
  if (state.status === 'loading') {
    return (
      <>
        <Header icon={<SportIcon id={planned?.sport ?? 'other'} className="h-5 w-5" />} title={planned ? plainTitle(planned.title) : 'Activity'} sub="Loading…" onClose={onClose} />
        <Loading />
      </>
    );
  }
  if (state.status === 'error' || !state.value) {
    return (
      <>
        <Header icon={<SportIcon id={planned?.sport ?? 'other'} className="h-5 w-5" />} title="Activity" sub="" right={<OpenButton href={`/activities/${id}`} label="Open activity" />} onClose={onClose} />
        <Failed text={state.status === 'error' ? 'The activity did not load. Open the full page, or try again.' : 'This activity is not in Coach yet.'} />
      </>
    );
  }
  return <ActivityContent v={state.value.v} c={state.value.context} planned={planned} onClose={onClose} />;
}

function ActivityContent({
  v, c, planned, onClose,
}: { v: ActivityView; c: ActivityContext | null; planned: CalendarWorkout | null; onClose: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<ATab>('overview');
  const jumping = useRef(0);

  /** The section in view: the last one whose top is above the section bar's bottom edge. */
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || Date.now() < jumping.current) return;
    const line = el.getBoundingClientRect().top + (navRef.current?.offsetHeight ?? 0) + 24;
    const secs = [...el.querySelectorAll<HTMLElement>('[data-section]')];
    let current = secs[0]?.dataset.section as ATab | undefined;
    for (const sec of secs) if (sec.getBoundingClientRect().top <= line) current = sec.dataset.section as ATab;
    // At the bottom the last section counts, even when it is short.
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) current = secs.at(-1)?.dataset.section as ATab | undefined;
    if (current) setActive(current);
  }, []);

  function pick(id: ATab) {
    const el = scrollRef.current;
    const sec = el?.querySelector<HTMLElement>(`[data-section="${id}"]`);
    if (!el || !sec) return;
    setActive(id);
    jumping.current = Date.now() + 700; // the smooth scroll does not move the mark back and forth
    const top = sec.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - (navRef.current?.offsetHeight ?? 0);
    el.scrollTo({ top: id === 'overview' ? 0 : top, behavior: 'smooth' });
  }
  const st = v.stats;
  const foot = v.layout === 'run';
  const ride = v.layout === 'ride';
  const color = sport(v.sport).color;
  const series = v.series;
  const hrPeaks = useMemo(() => (series ? peakCurve(series.t, series.hr) : []), [series]);
  // GPS speed jumps for a few seconds, so the speed curve starts at 30 s.
  const speedPeaks = useMemo(
    () => (series && v.layout !== 'basic' ? peakCurve(series.t, series.speed, PEAK_DURATIONS.filter((d) => d >= 30)) : []),
    [series, v.layout]
  );
  const hasHr = v.hrZones.some((z) => z.seconds > 0) || hrPeaks.length > 1;
  const hasPower = v.powerZones.some((z) => z.seconds > 0) || v.powerCurve.length > 1;
  const hasPace = v.layout !== 'basic' && (v.paceBins.length > 0 || speedPeaks.length > 1);
  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    hasHr && { id: 'hr' as const, label: 'Heart rate' },
    hasPower && { id: 'power' as const, label: 'Power' },
    hasPace && { id: 'pace' as const, label: foot ? 'Pace' : 'Speed' },
    (v.laps.length > 1 || v.splits.length > 0) && { id: 'laps' as const, label: v.laps.length > 1 ? 'Laps' : 'Splits' },
    series && { id: 'charts' as const, label: 'Charts' },
  ].filter(Boolean) as { id: ATab; label: string }[];

  const time = clock(v.startLocal);
  const load = c?.load ?? null;
  const plan = c?.planned ?? null;

  return (
    <ActivityHoverProvider>
      <Header
        icon={<SportIcon id={v.sport} className="h-5 w-5" />}
        title={v.name}
        sub={[
          longDay(v.day), time, v.place, stravaTypeLabel(v.sportType), v.device,
          st.prs ? `${st.prs} PR${st.prs > 1 ? 's' : ''}` : null,
          st.achievements ? `${st.achievements} achievement${st.achievements > 1 ? 's' : ''}` : null,
          st.kudos ? `${st.kudos} kudos` : null,
        ].filter(Boolean).join(' · ')}
        right={
          <>
            {plan && <StatusChip level={plan.compliance.level} ratio={plan.compliance.ratio} basis={plan.compliance.basis} />}
            {load && <LoadChips load={load} />}
            <a
              href={`https://www.strava.com/activities/${v.stravaId}`}
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-accent md:inline-flex"
            >
              Strava <ExternalLink aria-hidden className="h-3 w-3" />
            </a>
            <OpenButton href={`/activities/${v.stravaId}`} label="Full page" />
          </>
        }
        onClose={onClose}
      />
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
        <Hero
          stats={[
            st.distance > 0 && { label: 'Distance', value: km(st.distance), unit: 'km' },
            { label: 'Moving time', value: duration(st.moving) },
            foot && st.avgSpeed && { label: 'Pace', value: pace(st.avgSpeed), unit: '/km' },
            !foot && st.avgSpeed && st.distance > 0 && { label: 'Avg speed', value: kmh(st.avgSpeed), unit: 'km/h' },
            st.elevGain > 0 && { label: 'Elevation', value: int(st.elevGain), unit: 'm' },
            v.effort.tss != null && { label: 'TSS', value: String(Math.round(v.effort.tss)) },
            ride && st.np && { label: 'Normalized power', value: int(st.np), unit: 'W' },
            st.avgHr && { label: 'Avg heart rate', value: int(st.avgHr), unit: 'bpm' },
            st.calories != null && { label: 'Calories', value: int(st.calories) },
          ]}
        />
        <div ref={navRef} className="sticky top-0 z-10 bg-background/95 backdrop-blur">
          <SectionNav items={tabs} active={active} onPick={pick} />
        </div>
        <div>
          <Section id="overview">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-4">
                {plan && <PlanVsDone v={v} plan={plan} />}
                <EffortLog item={`strava:${v.stravaId}`} date={v.day} title={v.name} planActivityId={planned?.id ?? null} />
                <StatGrid v={v} />
                <ZoneStrip v={v} />
                <SplitBars v={v} />
                <BestEfforts v={v} />
              </div>
              <div className="space-y-4">
                {v.route.length > 1 && (
                  <div className="overflow-hidden rounded-xl border">
                    <RouteMap
                      route={v.route}
                      points={series?.lat && series.lng ? series.lat.map((la, i) => (la != null && series.lng![i] != null ? ([series.lng![i]!, la] as [number, number]) : null)) : null}
                      color={color}
                      label={`Route map of ${v.name}`}
                    />
                  </div>
                )}
                {series?.d && v.route.length > 1 ? <RouteProfile series={series} foot={v.layout === 'run'} color={color} height={130} /> : <ElevationProfile v={v} />}
                {load && <LoadTiles load={load} />}
                <MinAvgMax v={v} />
                {v.description && <Description title="Description" text={v.description} />}
                {planned?.description && <Description title="The plan" text={planned.description.split(LIFT_MARKER)[0].trim()} />}
                <Conditions v={v} c={c} />
              </div>
            </div>
          </Section>

          {hasHr && (
            <Section id="hr" title="Heart rate">
            <div className="grid gap-6 lg:grid-cols-2">
              {v.hrZones.some((z) => z.seconds > 0) && (
                <Panel title="Heart rate by zones" note={st.avgHr ? `avg ${Math.round(st.avgHr)} · max ${st.maxHr ?? '–'} bpm` : undefined}>
                  <ZoneBars zones={v.hrZones} unit="bpm" kind="hr" />
                </Panel>
              )}
              {hrPeaks.length > 1 && (
                <Panel title="Peak heart rate" note="best average for each duration">
                  <div className="rounded-lg border p-3">
                    <PeakCurve points={hrPeaks} color="var(--viz-hr)" name="Peak heart rate" unit="bpm" format={(x) => String(Math.round(x))} floor={Math.max(0, Math.min(...hrPeaks.map((p) => p.value)) - 15)} />
                  </div>
                  <PeakList points={hrPeaks} format={(x) => `${Math.round(x)} bpm`} />
                </Panel>
              )}
            </div>
            </Section>
          )}

          {hasPower && (
            <Section id="power" title="Power">
            <div className="grid gap-6 lg:grid-cols-2">
              {v.powerZones.some((z) => z.seconds > 0) && (
                <Panel title="Power by zones" note={v.effort.ftp ? `FTP ${v.effort.ftp} W` : undefined}>
                  <ZoneBars zones={v.powerZones} unit="W" kind="power" />
                </Panel>
              )}
              {v.powerCurve.length > 1 && (
                <Panel title="Peak power" note="best average for each duration">
                  <div className="rounded-lg border p-3">
                    <PowerCurve points={v.powerCurve} ftp={v.effort.ftp} />
                  </div>
                  <PeakList points={v.powerCurve.map((p) => ({ seconds: p.seconds, value: p.watts }))} format={(x) => `${Math.round(x)} W`} />
                </Panel>
              )}
            </div>
            </Section>
          )}

          {hasPace && (
            <Section id="pace" title={foot ? 'Pace' : 'Speed'}>
            <div className="grid gap-6 lg:grid-cols-2">
              {foot && v.paceBins.length > 0 && (
                <Panel title="Time by pace" note="moving time per 15 s of pace">
                  <div className="rounded-lg border p-3">
                    <Histogram bins={v.paceBins.map((b) => ({ label: paceOfSeconds(b.from), seconds: b.seconds }))} color={color} title="Moving time by pace" unit="/km" />
                  </div>
                </Panel>
              )}
              {speedPeaks.length > 1 && (
                <Panel title={foot ? 'Peak pace' : 'Peak speed'} note="best average for each duration">
                  <div className="rounded-lg border p-3">
                    <PeakCurve
                      points={speedPeaks}
                      color={color}
                      name={foot ? 'Peak pace' : 'Peak speed'}
                      unit={foot ? '/km' : 'km/h'}
                      format={(x) => (foot ? pace(x) : kmh(x))}
                      floor={Math.max(0, Math.min(...speedPeaks.map((p) => p.value)) * 0.85)}
                    />
                  </div>
                  <PeakList points={speedPeaks} format={(x) => (foot ? `${pace(x)} /km` : `${kmh(x)} km/h`)} />
                </Panel>
              )}
            </div>
            </Section>
          )}

          {(v.laps.length > 1 || v.splits.length > 0) && (
            <Section id="laps" title={v.laps.length > 1 ? 'Laps' : 'Splits'}>
              <LapTable v={v} />
            </Section>
          )}

          {series && (
            <Section id="charts" title="Charts">
            <StreamCharts
              series={series}
              layout={v.layout}
              sportColor={color}
              avgs={{
                speed: st.avgSpeed, gap: st.avgGapSpeed, hr: st.avgHr, cad: st.avgCadence,
                watts: st.avgWatts && (ride || st.deviceWatts) ? st.avgWatts : null, temp: st.avgTemp,
              }}
            />
            </Section>
          )}
          {v.fetch.needed && (
            <p role="status" className="px-4 pb-6 text-xs sm:px-6 text-[var(--viz-muted)]">{NOT_LOADED_NOTE}</p>
          )}
        </div>
      </div>
    </ActivityHoverProvider>
  );
}

function LoadChips({ load }: { load: NonNullable<ActivityContext['load']> }) {
  const chips: [string, string, string][] = [
    ['Fitness', String(Math.round(load.after.ctl)), 'var(--viz-ctl)'],
    ['Fatigue', String(Math.round(load.after.atl)), 'var(--viz-atl)'],
    ['Form', signed(load.after.tsb), 'var(--viz-tsb)'],
  ];
  return (
    <span className="hidden items-center gap-1 lg:flex" title="At the end of the day">
      {chips.map(([label, value, color]) => (
        <span key={label} className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ background: color }} />
          <span className="text-[var(--viz-muted)]">{label}</span>
          <b className="tabular-nums text-[var(--viz-ink)]">{value}</b>
        </span>
      ))}
    </span>
  );
}

function Conditions({ v, c }: { v: ActivityView; c: ActivityContext | null }) {
  const w = v.weather;
  const g = c?.garmin ?? null;
  const items = [
    w && ['Weather', `${weatherLabel(w.code)}${w.tempC != null ? `, ${Math.round(w.tempC)} °C` : ''}${w.windKmh != null ? `, wind ${Math.round(w.windKmh)} km/h` : ''}`],
    v.gear && [v.layout === 'ride' ? 'Bike' : 'Shoes', v.gear.name],
    g?.sleep_score != null && ['Sleep score', String(Math.round(g.sleep_score))],
    g?.hrv_night_avg_ms != null && ['HRV (night)', `${Math.round(g.hrv_night_avg_ms)} ms`],
    g?.resting_hr_bpm != null && ['Resting HR', `${Math.round(g.resting_hr_bpm)} bpm`],
    g?.body_battery_high != null && ['Body Battery', `${Math.round(g.body_battery_high)} high`],
    g?.training_readiness != null && ['Training readiness', String(Math.round(g.training_readiness))],
  ].filter(Boolean) as [string, string][];
  if (!items.length) return null;
  return (
    <section className="min-w-0 rounded-xl border p-4">
      <h3 className="mb-3 flex items-baseline justify-between text-sm font-semibold text-[var(--viz-ink)]">
        Conditions
        {g && <Link href={`/health/day/${v.day}`} className="text-xs font-normal text-[var(--viz-muted)] underline underline-offset-2">Health that day</Link>}
      </h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
        {items.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[11px] text-[var(--viz-muted)]">{label}</dt>
            <dd className="text-[15px] font-semibold leading-snug tabular-nums text-[var(--viz-ink)]">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const peakLabel = (s: number) => (s < 60 ? `${s} sec` : s < 3600 ? `${Math.round(s / 60)} min` : `${Math.round((s / 3600) * 10) / 10} h`);

function PeakList({ points, format }: { points: { seconds: number; value: number }[]; format: (v: number) => string }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 rounded-lg border px-3 py-2 text-sm sm:grid-cols-3">
      {points.map((p) => (
        <div key={p.seconds} className="flex items-baseline justify-between gap-2 py-1">
          <dt className="text-[var(--viz-muted)]">{peakLabel(p.seconds)}</dt>
          <dd className="font-medium tabular-nums text-[var(--viz-ink)]">{format(p.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function LapTable({ v }: { v: ActivityView }) {
  const foot = v.layout === 'run';
  const laps = v.laps.length > 1;
  const rows = laps ? v.laps : v.splits;
  const watts = laps && v.laps.some((l) => l.watts);
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="bg-muted/50 text-xs text-[var(--viz-muted)]">
          <tr>
            <th className="px-3 py-1.5 text-left font-medium">{laps ? 'Lap' : 'Km'}</th>
            <th className={th}>Distance</th>
            <th className={th}>Time</th>
            <th className={th}>{foot ? 'Pace' : 'Speed'}</th>
            {foot && <th className={th}>GAP</th>}
            <th className={th}>Elev</th>
            <th className={th}>Avg HR</th>
            {laps && <th className={th}>Max HR</th>}
            {watts && <th className={th}>Power</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const lap = laps ? (r as ActivityView['laps'][number]) : null;
            const speed = r.speed ?? (r.moving ? r.distance / r.moving : 0);
            return (
              <tr key={r.index} className="border-t hover:bg-muted/40">
                <td className="px-3 py-1.5 tabular-nums">{lap?.name && !/^Lap \d+$/.test(lap.name) ? lap.name : r.index}</td>
                <td className={td}>{km(r.distance)} km</td>
                <td className={td}>{duration(r.moving || r.elapsed)}</td>
                <td className={cn(td, 'font-medium')}>{foot ? `${pace(speed)} /km` : `${kmh(speed)} km/h`}</td>
                {foot && <td className={td}>{r.gapSpeed ? `${pace(r.gapSpeed)} /km` : '–'}</td>}
                <td className={td}>{lap ? (lap.elevGain != null ? `${int(lap.elevGain)} m` : '–') : r.elevDiff != null ? `${signed(r.elevDiff)} m` : '–'}</td>
                <td className={td}>{r.hr ? Math.round(r.hr) : '–'}</td>
                {laps && <td className={td}>{lap?.maxHr ?? '–'}</td>}
                {watts && <td className={td}>{lap?.watts ? `${Math.round(lap.watts)} W` : '–'}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
