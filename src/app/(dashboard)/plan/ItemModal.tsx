'use client';

import Link from 'next/link';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowUpRight, ChevronLeft, ChevronRight, Dumbbell, ExternalLink, X } from 'lucide-react';
import SportIcon from '@/components/SportIcon';
import ComplianceMark from '@/components/plan/ComplianceMark';
import LiftSessionSets from '@/components/plan/LiftSessionSets';
import RemoveWorkout from '@/components/plan/RemoveWorkout';
import PeakCurve from '@/components/charts/PeakCurve';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { sport, stravaTypeLabel } from '@/lib/sports';
import { duration, int, km, kmh, pace, paceOfSeconds, signed } from '@/lib/activity/format.mjs';
import { PEAK_DURATIONS, peakCurve } from '@/lib/activity/peaks.mjs';
import { withTimeout } from '@/lib/plan/scroll.mjs';
import { weatherLabel } from '@/lib/activity/weather.mjs';
import { zoneOf } from '@/lib/performance/form';
import { plainTitle } from '@/lib/plan/calendar.mjs';
import { dur } from '@/lib/plan/cells.mjs';
import { LIFT_MARKER } from '@/lib/plan/lift-plan.mjs';
import { zonesFor } from '@/lib/plan/zones.mjs';
import type { ActivityContext, ActivityView } from '@/lib/activity/queries';
import type { CalendarWorkout } from '@/lib/plan/month';
import { ActivityHoverProvider } from '../activities/[id]/ActivityHover';
import Histogram from '../activities/[id]/Histogram';
import PowerCurve from '../activities/[id]/PowerCurve';
import RouteMap from '../activities/[id]/RouteMap';
import StreamCharts from '../activities/[id]/StreamCharts';
import { ZoneBars } from '../activities/[id]/Sections';
import { activityPreviewAction, liftPreviewAction } from './actions';
import { liftHref, type Item, type PreviewActions } from './ItemPreview';

/** Strava's orange, for the active tab and the main button. */
const ACCENT = '#fc4c02';

const longDay = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const clock = (local: string) => {
  const m = /T(\d{2}):(\d{2})/.exec(local);
  if (!m) return null;
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
};

/** The previous / next buttons in the header. */
const StepContext = createContext<{ onStep: (dir: -1 | 1) => void; prev: boolean; next: boolean }>({ onStep: () => {}, prev: false, next: false });

type Props = {
  item: Item;
  onClose: () => void;
  /** The previous / next item in the calendar, or null at the ends. */
  onStep: (dir: -1 | 1) => void;
  canStep: { prev: boolean; next: boolean };
  actions: PreviewActions;
  disabled: boolean;
};

/**
 * The calendar's item modal, in a Strava style with the TrainingPeaks data: the main numbers, planned against
 * completed, the load change, zones and peak curves, laps and the stream charts. A done item links to its full
 * page. ← and → step to the previous and next item.
 */
export default function ItemModal({ item, onClose, onStep, canStep, actions, disabled }: Props) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.closest('[role="img"]'))) return;
      if (e.key === 'ArrowLeft' && canStep.prev) onStep(-1);
      if (e.key === 'ArrowRight' && canStep.next) onStep(1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onStep, canStep]);

  const planned = item.kind === 'planned' ? item.w : null;
  const activityId = item.kind === 'activity' ? item.a.id : planned?.match?.source === 'strava' ? planned.match.id : null;
  // A done strength workout opens its Lift session; a planned one shows the Lift session's targets.
  const liftId =
    item.kind === 'lift' ? item.l.id
    : planned?.match?.source === 'lift' ? planned.match.id
    : planned?.state === 'done' && planned.lift ? planned.lift.id
    : null;

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).focus();
          }}
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-[min(52rem,calc(100dvh-3rem))] sm:w-[min(76rem,calc(100vw-3rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border"
        >
          <StepContext.Provider value={{ onStep, prev: canStep.prev, next: canStep.next }}>
          {activityId ? (
            <ActivityModal key={`a-${activityId}`} id={activityId} planned={planned} onClose={onClose} />
          ) : liftId ? (
            <LiftModal key={`l-${liftId}`} id={liftId} planned={planned} onClose={onClose} />
          ) : planned ? (
            <PlannedModal key={planned.id} w={planned} onClose={onClose} actions={actions} disabled={disabled} />
          ) : null}
          </StepContext.Provider>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function StepButtons() {
  const { onStep, prev, next } = useContext(StepContext);
  const btn = 'rounded-md p-1.5 text-[var(--viz-muted)] hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  return (
    <span className="flex items-center">
      <button type="button" className={btn} disabled={!prev} onClick={() => onStep(-1)} aria-label="Previous item" title="Previous item (←)">
        <ChevronLeft aria-hidden className="h-5 w-5" />
      </button>
      <button type="button" className={btn} disabled={!next} onClick={() => onStep(1)} aria-label="Next item" title="Next item (→)">
        <ChevronRight aria-hidden className="h-5 w-5" />
      </button>
    </span>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Shared parts

function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'ok'; value: T } | { status: 'error' }>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    (withTimeout(fn(), 20_000, 'Loading the item') as Promise<T>).then(
      (value) => live && setState({ status: 'ok', value }),
      (error) => {
        console.error('Modal load failed:', error);
        if (live) setState({ status: 'error' });
      }
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

function Header({ icon, title, sub, right, onClose }: { icon: ReactNode; title: string; sub: ReactNode; right?: ReactNode; onClose: () => void }) {
  return (
    <header className="flex shrink-0 items-start gap-3 border-b px-4 py-3 sm:px-6 sm:py-4">
      <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <Dialog.Title className="truncate text-lg font-bold tracking-tight text-[var(--viz-ink)] sm:text-xl">{title}</Dialog.Title>
        <p className="truncate text-xs text-[var(--viz-muted)] sm:text-sm">{sub}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {right}
        <StepButtons />
        <Dialog.Close
          aria-label="Close"
          className="rounded-md p-1.5 text-[var(--viz-muted)] hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onClose}
        >
          <X aria-hidden className="h-5 w-5" />
        </Dialog.Close>
      </div>
    </header>
  );
}

function OpenButton({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild size="sm" className="hidden text-white hover:opacity-90 sm:inline-flex" style={{ background: ACCENT }}>
      <Link href={href}>
        {label} <ArrowUpRight aria-hidden className="ml-1 h-4 w-4" />
      </Link>
    </Button>
  );
}

/** Strava's row of big numbers: value over a small label, with thin dividers. */
type HeroStat = { label: string; value: string; unit?: string };

function Hero({ stats }: { stats: (HeroStat | false | null | undefined | 0 | '')[] }) {
  const shown = stats.filter(Boolean) as HeroStat[];
  return (
    <dl className="flex flex-wrap gap-y-3 border-b px-4 py-4 sm:px-6">
      {shown.map((s, i) => (
        <div key={s.label} className={cn('min-w-[6.5rem] pr-5', i > 0 && 'sm:border-l sm:pl-5')}>
          <dd className="text-xl font-semibold tabular-nums tracking-tight text-[var(--viz-ink)] sm:text-2xl">
            {s.value}
            {s.unit && <span className="ml-0.5 text-sm font-normal text-[var(--viz-ink-2)]">{s.unit}</span>}
          </dd>
          <dt className="text-xs text-[var(--viz-muted)]">{s.label}</dt>
        </div>
      ))}
    </dl>
  );
}

function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void }) {
  if (tabs.length < 2) return null;
  return (
    <div role="tablist" aria-label="Sections" className="flex shrink-0 gap-1 overflow-x-auto border-b px-2 sm:px-4">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            '-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
            value === t.id ? 'text-[var(--viz-ink)]' : 'border-transparent text-[var(--viz-muted)] hover:text-[var(--viz-ink)]'
          )}
          style={value === t.id ? { borderBottomColor: ACCENT } : undefined}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Panel({ title, note, children, className }: { title: string; note?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('min-w-0 space-y-2', className)}>
      <h3 className="text-sm font-semibold text-[var(--viz-ink)]">
        {title}
        {note && <span className="ml-1.5 font-normal text-[var(--viz-muted)]">{note}</span>}
      </h3>
      {children}
    </section>
  );
}

const th = 'px-3 py-1.5 text-right font-medium whitespace-nowrap';
const td = 'px-3 py-1.5 text-right tabular-nums whitespace-nowrap';

/** Rows of label / planned / completed, TrainingPeaks style. A row with neither value is left out. */
function PlanTable({ rows, showPlanned }: { rows: [string, string | null, string | null][]; showPlanned: boolean }) {
  const shown = rows.filter(([, p, c]) => p || c);
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-[var(--viz-muted)]">
          <tr>
            <th className="px-3 py-1.5 text-left font-medium"><span className="sr-only">Metric</span></th>
            {showPlanned && <th className={th}>Planned</th>}
            <th className={th}>Completed</th>
          </tr>
        </thead>
        <tbody>
          {shown.map(([label, p, c]) => (
            <tr key={label} className="border-t">
              <td className="px-3 py-1.5 text-[var(--viz-ink-2)]">{label}</td>
              {showPlanned && <td className={cn(td, 'text-[var(--viz-muted)]')}>{p ?? '–'}</td>}
              <td className={cn(td, 'font-medium text-[var(--viz-ink)]')}>{c ?? '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Loading() {
  return (
    <div aria-busy className="flex-1 space-y-4 p-6">
      <span className="sr-only">Loading</span>
      <div className="h-14 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-64 animate-pulse rounded-lg bg-muted/70" />
        <div className="h-64 animate-pulse rounded-lg bg-muted/70" />
      </div>
    </div>
  );
}

function Failed({ text }: { text: string }) {
  return <p className="m-6 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{text}</p>;
}

function Description({ title, text }: { title: string; text: string }) {
  return (
    <Panel title={title}>
      <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-[13px] leading-relaxed text-[var(--viz-ink)]">{text}</div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Activity

type ATab = 'overview' | 'hr' | 'power' | 'pace' | 'laps' | 'charts';

function minMax(vals: (number | null)[] | null | undefined) {
  if (!vals) return null;
  let lo = Infinity;
  let hi = -Infinity;
  let sum = 0;
  let n = 0;
  for (const v of vals) {
    if (v == null || !Number.isFinite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
    sum += v;
    n += 1;
  }
  return n ? { min: lo, max: hi, avg: sum / n } : null;
}

function ActivityModal({ id, planned, onClose }: { id: string; planned: CalendarWorkout | null; onClose: () => void }) {
  const state = useLoad(() => activityPreviewAction(id), [id]);
  const [tab, setTab] = useState<ATab>('overview');
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
  return <ActivityContent v={state.value.v} c={state.value.context} planned={planned} tab={tab} setTab={setTab} onClose={onClose} />;
}

function ActivityContent({
  v, c, planned, tab, setTab, onClose,
}: { v: ActivityView; c: ActivityContext | null; planned: CalendarWorkout | null; tab: ATab; setTab: (t: ATab) => void; onClose: () => void }) {
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
  const ifactor = ride && st.np && v.effort.ftp ? st.np / v.effort.ftp : null;
  const plan = c?.planned ?? null;

  return (
    <ActivityHoverProvider>
      <Header
        icon={<SportIcon id={v.sport} className="h-5 w-5" />}
        title={v.name}
        sub={[longDay(v.day), time, v.place, stravaTypeLabel(v.sportType), v.device].filter(Boolean).join(' · ')}
        right={
          <>
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
      <div className="min-h-0 flex-1 overflow-y-auto">
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
        <div className="sticky top-0 z-10 bg-background">
          <Tabs tabs={tabs} value={tabs.some((t) => t.id === tab) ? tab : 'overview'} onChange={setTab} />
        </div>
        <div className="p-4 sm:p-6">
          {tab === 'overview' && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-6">
                {plan && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                    <span className="text-[var(--viz-muted)]">Planned:</span>
                    <span className="font-medium text-[var(--viz-ink)]">{plainTitle(plan.title)}</span>
                    <span className="ml-auto flex items-center gap-1.5 text-xs">
                      <ComplianceMark level={plan.compliance.level} showLabel />
                      {plan.compliance.ratio != null && (
                        <span className="tabular-nums text-[var(--viz-muted)]">
                          {Math.round(plan.compliance.ratio * 100)}% of the {plan.compliance.basis === 'tss' ? 'TSS' : 'time'}
                        </span>
                      )}
                    </span>
                  </div>
                )}
                <Panel title="Summary">
                  <PlanTable
                    showPlanned={Boolean(plan)}
                    rows={[
                      ['Duration', plan?.duration ? duration(plan.duration * 60) : null, duration(st.moving)],
                      ['Elapsed time', null, st.elapsed !== st.moving ? duration(st.elapsed) : null],
                      ['Distance', null, st.distance > 0 ? `${km(st.distance)} km` : null],
                      [foot ? 'Average pace' : 'Average speed', null, st.avgSpeed && st.distance > 0 ? (foot ? `${pace(st.avgSpeed)} /km` : `${kmh(st.avgSpeed)} km/h`) : null],
                      ['Grade-adjusted pace', null, foot && st.avgGapSpeed ? `${pace(st.avgGapSpeed)} /km` : null],
                      ['TSS', plan?.tss ? String(Math.round(plan.tss)) : null, v.effort.tss != null ? `${Math.round(v.effort.tss)}${v.effort.tssMethod ? ` (${v.effort.tssMethod === 'duration_fallback' ? 'time' : v.effort.tssMethod})` : ''}` : null],
                      ['Normalized power', null, ride && st.np ? `${int(st.np)} W` : null],
                      ['Intensity factor', null, ifactor ? ifactor.toFixed(2) : null],
                      ['Work', null, st.kj ? `${int(st.kj)} kJ` : null],
                      ['Calories', null, st.calories != null ? `${int(st.calories)} kcal` : null],
                      ['Elevation gain', null, st.elevGain > 0 ? `${int(st.elevGain)} m` : null],
                      ['Relative Effort', null, v.effort.sufferScore != null ? String(v.effort.sufferScore) : null],
                      ['TRIMP', null, v.effort.trimp != null ? String(v.effort.trimp) : null],
                      ['Perceived exertion', null, st.perceivedExertion != null ? `${st.perceivedExertion}/10` : null],
                    ]}
                  />
                </Panel>
                <MinAvgMax v={v} />
              </div>
              <div className="space-y-6">
                {v.route.length > 1 && (
                  <RouteMap
                    route={v.route}
                    points={series?.lat && series.lng ? series.lat.map((la, i) => (la != null && series.lng![i] != null ? ([series.lng![i]!, la] as [number, number]) : null)) : null}
                    color={color}
                    label={`Route map of ${v.name}`}
                  />
                )}
                {load && <LoadImpact load={load} tss={v.effort.tss} />}
                {v.description && <Description title="Description" text={v.description} />}
                {planned?.description && <Description title="The plan" text={planned.description} />}
                <Conditions v={v} c={c} />
              </div>
            </div>
          )}

          {tab === 'hr' && (
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
          )}

          {tab === 'power' && (
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
          )}

          {tab === 'pace' && (
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
          )}

          {tab === 'laps' && <LapTable v={v} />}

          {tab === 'charts' && series && (
            <StreamCharts
              series={series}
              layout={v.layout}
              sportColor={color}
              avgs={{
                speed: st.avgSpeed, gap: st.avgGapSpeed, hr: st.avgHr, cad: st.avgCadence,
                watts: st.avgWatts && (ride || st.deviceWatts) ? st.avgWatts : null, temp: st.avgTemp,
              }}
            />
          )}
          {v.fetch.needed && (
            <p className="mt-4 text-xs text-[var(--viz-muted)]">
              Strava streams are not loaded yet. Open the <Link href={`/activities/${v.stravaId}`} className="underline">full page</Link> to load them.
            </p>
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

function LoadImpact({ load, tss }: { load: NonNullable<ActivityContext['load']>; tss: number | null }) {
  const b = load.before;
  const rows: [string, number | null, number, string][] = [
    ['Fitness (CTL)', b?.ctl ?? null, load.after.ctl, 'var(--viz-ctl)'],
    ['Fatigue (ATL)', b?.atl ?? null, load.after.atl, 'var(--viz-atl)'],
    ['Form (TSB)', b?.tsb ?? null, load.after.tsb, 'var(--viz-tsb)'],
  ];
  return (
    <Panel title="Training load" note={`this day: ${Math.round(load.dayTss)} TSS${tss != null && Math.round(tss) !== Math.round(load.dayTss) ? ` (this activity ${Math.round(tss)})` : ''}`}>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-[var(--viz-muted)]">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium"><span className="sr-only">Metric</span></th>
              <th className={th}>Before</th>
              <th className={th}>Change</th>
              <th className={th}>After</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, before, after, color]) => (
              <tr key={label} className="border-t">
                <td className="px-3 py-1.5">
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: color }} />
                  <span className="text-[var(--viz-ink-2)]">{label}</span>
                </td>
                <td className={cn(td, 'text-[var(--viz-muted)]')}>{before != null ? Math.round(before) : '–'}</td>
                <td className={td}>{before != null ? signed(after - before, 1) : '–'}</td>
                <td className={cn(td, 'font-semibold text-[var(--viz-ink)]')}>{Math.round(after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t px-3 py-2 text-xs text-[var(--viz-ink-2)]">
          Form after: <b className="text-[var(--viz-ink)]">{zoneOf(load.after.tsb)}</b>
        </p>
      </div>
    </Panel>
  );
}

function MinAvgMax({ v }: { v: ActivityView }) {
  const st = v.stats;
  const s = v.series;
  const foot = v.layout === 'run';
  const hr = minMax(s?.hr);
  const speed = minMax(s?.speed?.map((x) => (x != null && x > 0.3 ? x : null)));
  const watts = minMax(s?.watts);
  const cad = minMax(s?.cad?.map((x) => (x ? x : null)));
  const alt = minMax(s?.alt);
  const rows: [string, string, string, string][] = [];
  if (hr || st.avgHr) rows.push(['Heart rate (bpm)', hr ? int(hr.min) : '–', st.avgHr ? int(st.avgHr) : hr ? int(hr.avg) : '–', st.maxHr ? int(st.maxHr) : hr ? int(hr.max) : '–']);
  if (v.layout !== 'basic' && (speed || st.avgSpeed)) {
    rows.push(foot
      ? ['Pace (/km)', speed ? pace(speed.min) : '–', st.avgSpeed ? pace(st.avgSpeed) : '–', st.maxSpeed ? pace(st.maxSpeed) : speed ? pace(speed.max) : '–']
      : ['Speed (km/h)', speed ? kmh(speed.min) : '–', st.avgSpeed ? kmh(st.avgSpeed) : '–', st.maxSpeed ? kmh(st.maxSpeed) : speed ? kmh(speed.max) : '–']);
  }
  if (watts || st.avgWatts) rows.push(['Power (W)', watts ? int(watts.min) : '–', st.avgWatts ? int(st.avgWatts) : '–', st.maxWatts ? int(st.maxWatts) : watts ? int(watts.max) : '–']);
  if (cad || st.avgCadence) rows.push([`Cadence (${foot ? 'spm' : 'rpm'})`, cad ? int(cad.min) : '–', st.avgCadence ? int(st.avgCadence) : '–', cad ? int(cad.max) : '–']);
  if (alt || st.elevHigh != null) rows.push(['Elevation (m)', st.elevLow != null ? int(st.elevLow) : alt ? int(alt.min) : '–', alt ? int(alt.avg) : '–', st.elevHigh != null ? int(st.elevHigh) : alt ? int(alt.max) : '–']);
  if (st.avgTemp != null) rows.push(['Temperature (°C)', '–', String(Math.round(st.avgTemp)), '–']);
  if (!rows.length) return null;
  return (
    <Panel title="Min, average and max">
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-[var(--viz-muted)]">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium"><span className="sr-only">Metric</span></th>
              <th className={th}>Min</th>
              <th className={th}>Avg</th>
              <th className={th}>Max</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, lo, avg, hi]) => (
              <tr key={label} className="border-t">
                <td className="px-3 py-1.5 text-[var(--viz-ink-2)]">{label}</td>
                <td className={cn(td, 'text-[var(--viz-muted)]')}>{lo}</td>
                <td className={cn(td, 'font-medium text-[var(--viz-ink)]')}>{avg}</td>
                <td className={td}>{hi}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
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
    <Panel title="Conditions" note={g ? <Link href={`/health/day/${v.day}`} className="underline underline-offset-2">Health that day</Link> : undefined}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border p-3 text-sm">
        {items.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-[var(--viz-muted)]">{label}</dt>
            <dd className="truncate font-medium tabular-nums text-[var(--viz-ink)]">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
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

// ---------------------------------------------------------------------------------------------------------------
// Lift

const STATUS: Record<string, string> = { done: 'Done', skipped: 'Skipped', planned: 'Not logged' };

const num1 = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 1 });

/** A load as Lift shows it: "230 lb", "+25 lb" (added to bodyweight), "BW", or "" with no load. */
function loadText(weight: number | null, loadMode: string | null, unit: string) {
  if (loadMode === 'bodyweight') return weight ? `+${num1(weight)} ${unit}` : 'BW';
  return weight == null ? '' : `${num1(weight)} ${unit}`;
}

/** The planned reps and load of a set: "8 × 230 lb", "8–10 × BW", or "–". */
function targetText(t: { reps: number | null; repMin: number | null; repMax: number | null; weight: number | null }, loadMode: string | null, unit: string) {
  const reps = t.reps != null ? String(t.reps) : t.repMin != null && t.repMax != null ? (t.repMin === t.repMax ? String(t.repMin) : `${t.repMin}–${t.repMax}`) : '';
  const w = loadText(t.weight, loadMode, unit);
  return reps || w ? [reps, w].filter(Boolean).join(' × ') : '–';
}

function LiftModal({ id, planned, onClose }: { id: string; planned: CalendarWorkout | null; onClose: () => void }) {
  const state = useLoad(() => liftPreviewAction(id), [id]);
  const icon = <Dumbbell aria-hidden className="h-5 w-5" style={{ color: sport('strength').color }} />;
  if (state.status === 'loading') return (<><Header icon={icon} title={planned ? plainTitle(planned.title) : 'Lift session'} sub="Loading…" onClose={onClose} /><Loading /></>);
  if (state.status === 'error' || !state.value) {
    return (
      <>
        <Header icon={icon} title="Lift session" sub="" onClose={onClose} />
        <Failed text={state.status === 'error' ? 'The session did not load. Try again.' : 'This session is not in Coach.'} />
      </>
    );
  }
  const { detail: d, unit } = state.value;
  const reps = d.exercises.reduce((n, e) => n + e.sets.reduce((m, s) => m + (s.status === 'done' && s.reps ? s.reps : 0), 0), 0);
  const exercisesDone = d.exercises.filter((e) => e.setsLogged > 0).length;
  const vol = (x: number) => `${Math.round(x).toLocaleString('en-US')} ${unit}`;
  const start = d.startedAt ? new Date(d.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null;
  return (
    <>
      <Header
        icon={icon}
        title={d.title || 'Lift session'}
        sub={[longDay(d.day), start, 'Lift'].filter(Boolean).join(' · ')}
        right={<OpenButton href={liftHref(d.id)} label="Full page" />}
        onClose={onClose}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Hero
          stats={[
            d.minutes != null && { label: 'Duration', value: dur(d.minutes) },
            { label: 'Volume', value: Math.round(d.volume).toLocaleString('en-US'), unit },
            { label: 'Sets logged', value: `${d.setsLogged}/${d.setsTotal}` },
            { label: 'Reps', value: String(reps) },
            { label: 'Exercises', value: String(d.exercises.length) },
            planned?.tss != null && { label: 'Planned TSS', value: String(Math.round(planned.tss)) },
          ]}
        />
        <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="space-y-6">
            <Panel title="Summary">
              <PlanTable
                showPlanned
                rows={[
                  ['Exercises', String(d.exercises.length), String(exercisesDone)],
                  ['Sets', String(d.setsTotal), String(d.setsLogged)],
                  ['Reps', null, String(reps)],
                  ['Volume', null, vol(d.volume)],
                  ['Duration', planned?.duration ? dur(planned.duration) : null, d.minutes != null ? dur(d.minutes) : null],
                ]}
              />
            </Panel>
            {d.note && <Description title="Session note" text={d.note} />}
            {planned?.description && planned.description.split(LIFT_MARKER)[0].trim() && (
              <Description title="The plan" text={planned.description.split(LIFT_MARKER)[0].trim()} />
            )}
          </div>
          <div className="space-y-4">
            {d.exercises.length === 0 && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No exercises in this session.</p>}
            {d.exercises.map((e) => (
              <section key={e.id} className="overflow-hidden rounded-lg border">
                <header className="flex items-baseline justify-between gap-2 bg-muted/50 px-3 py-2">
                  <Link href={`/lift/exercises/${encodeURIComponent(e.key)}`} className="font-medium text-[var(--viz-ink)] hover:underline">{e.name}</Link>
                  <span className="shrink-0 text-xs tabular-nums text-[var(--viz-muted)]">{e.setsLogged}/{e.sets.length} sets · {vol(e.volume)}</span>
                </header>
                {e.note && <p className="border-t px-3 py-1.5 text-xs text-[var(--viz-ink-2)]">{e.note}</p>}
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    <col className="w-10" />
                    <col className="w-32" />
                    <col className="w-32" />
                    <col className="w-24" />
                    <col />
                  </colgroup>
                  <thead className="border-t text-left text-[11px] text-[var(--viz-muted)]">
                    <tr>
                      <th className="px-3 py-1 font-medium">Set</th>
                      <th className="px-3 py-1 font-medium">Target</th>
                      <th className="px-3 py-1 font-medium">Done</th>
                      <th className="px-3 py-1 font-medium"><span className="sr-only">Status</span></th>
                      <th className="px-3 py-1 font-medium"><span className="sr-only">Note</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.sets.map((s) => (
                      <tr key={s.id} className={cn('border-t', s.status !== 'done' && 'text-[var(--viz-muted)]')}>
                        <td className="w-10 px-3 py-1 tabular-nums">{s.label}</td>
                        <td className="px-3 py-1 tabular-nums text-[var(--viz-muted)]">{targetText(s.target, e.loadMode, unit)}</td>
                        <td className="px-3 py-1 font-medium tabular-nums">{s.status === 'done' ? `${s.reps ?? '?'} × ${loadText(s.weight, e.loadMode, unit) || '–'}` : '–'}</td>
                        <td className="px-3 py-1 text-xs">{STATUS[s.status] ?? s.status}</td>
                        <td className="px-3 py-1 text-xs text-[var(--viz-ink-2)]">{s.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// A planned workout that is not done yet

function PlannedModal({ w, onClose, actions, disabled }: { w: CalendarWorkout; onClose: () => void; actions: PreviewActions; disabled: boolean }) {
  const targets = zonesFor(w) as { zone: string; label: string; target: string }[];
  // With the Lift session shown set by set, the text copy of the sets (scripts/lift-plan.mjs) is left out.
  const text = w.lift && w.description ? w.description.split(LIFT_MARKER)[0].trim() : w.description;
  const pct = w.compliance.ratio != null ? `${Math.round(w.compliance.ratio * 100)}% of the planned ${w.compliance.basis === 'tss' ? 'TSS' : 'time'}` : null;
  return (
    <>
      <Header
        icon={<SportIcon id={w.sport} className="h-5 w-5" />}
        title={plainTitle(w.title)}
        sub={[longDay(w.date), w.startTime, sport(w.sport).label, 'Planned'].filter(Boolean).join(' · ')}
        onClose={onClose}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Hero
          stats={[
            { label: 'Planned time', value: w.duration ? dur(w.duration) : '–' },
            w.tss != null && { label: 'Planned TSS', value: String(Math.round(w.tss)) },
          ]}
        />
        <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="space-y-6">
            {text ? <Description title="The workout" text={text} /> : !w.lift && <p className="text-sm text-muted-foreground">No description.</p>}
            {w.lift && (
              <Panel title="Lift session" note={<Link href={liftHref(w.lift.id)} className="underline underline-offset-2">Open in full</Link>}>
                <div className="rounded-lg border p-3">
                  <LiftSessionSets lift={w.lift} />
                </div>
              </Panel>
            )}
            {w.why && (
              <Panel title="Why">
                <p className="text-sm text-[var(--viz-ink-2)]">{w.why}</p>
              </Panel>
            )}
          </div>
          <div className="space-y-6">
            <Panel title="Status">
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <ComplianceMark level={w.compliance.level} showLabel />
                {pct && <span className="text-xs text-[var(--viz-muted)]">· {pct}</span>}
              </div>
              {w.adaptedFrom && <p className="text-xs text-[var(--plan-partial)]">Changed for how you feel.</p>}
            </Panel>
            {w.intensity && !w.lift && (
              <Panel title="Intensity">
                <p className="text-sm text-[var(--viz-ink)]">{w.intensity}</p>
              </Panel>
            )}
            {targets.length > 0 && (
              <Panel title="Zone targets">
                <ul className="divide-y rounded-lg border text-sm">
                  {targets.map((t) => (
                    <li key={`${t.zone}-${t.label}`} className="flex items-center gap-3 px-3 py-2">
                      <b className="w-8 tabular-nums">{t.zone}</b>
                      <span className="flex-1 text-[var(--viz-ink-2)]">{t.label}</span>
                      <span className="tabular-nums text-[var(--viz-ink)]">{t.target}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
            <Panel title="Change it">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
                <label className="flex items-center gap-2 text-[var(--viz-ink-2)]">
                  Move to
                  <input
                    type="date"
                    value={w.date}
                    disabled={disabled}
                    onChange={(e) => e.target.value && actions.move(w.id, e.target.value)}
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                  />
                </label>
                <Button variant="outline" size="sm" className="h-9" disabled={disabled} onClick={() => actions.skip(w)}>
                  {w.status === 'skipped' ? 'Unskip' : 'Skip'}
                </Button>
                <RemoveWorkout
                  workout={{ title: plainTitle(w.title), date: w.date, state: w.state, imported: w.imported }}
                  onRemove={() => {
                    onClose();
                    actions.remove(w.id);
                  }}
                  disabled={disabled}
                />
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}
