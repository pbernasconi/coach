'use client';

import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, ExternalLink, HeartPulse } from 'lucide-react';
import SportIcon from '@/components/SportIcon';
import ComplianceMark, { ComplianceLegend, levelStyle } from '@/components/plan/ComplianceMark';
import RemoveWorkout from '@/components/plan/RemoveWorkout';
import WeatherBadge from '@/components/plan/WeatherBadge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { sport } from '@/lib/sports';
import { addMonths, plainTitle, weekDays } from '@/lib/plan/calendar.mjs';
import { applyChange } from '@/lib/plan/remove.mjs';
import { chunkAfter, chunkBefore, chunkToReach, earliestBound, firstWeekOfMonth, mergeRange, monthEdges, monthOfWeek } from '@/lib/plan/scroll.mjs';
import { addDays, mondayOf } from '@/lib/plan/week.mjs';
import type { CalendarActivity, CalendarLift, CalendarRange, CalendarWorkout, DataBounds, LibraryItem, WeekSummary } from '@/lib/plan/month';
import type { DayWeather } from '@/lib/plan/weather';
import { addFromLibraryAction, loadWeeksAction, moveWorkoutAction, removeWorkoutAction } from './actions';
import WorkoutLibrary, { LIBRARY_MIME, WORKOUT_MIME } from './WorkoutLibrary';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** Start the next load when the view is this close (px) to the top or bottom of the loaded weeks. */
const EDGE_PX = 900;

const hm = (min: number) => `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')}`;
const monthTitle = (month: string) =>
  new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const longDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const weekHref = (d: string) => `/plan?week=${mondayOf(d)}#day-${d}`;

type Props = {
  anchor: string; // the Monday the calendar opens at
  range: CalendarRange; // the first weeks loaded (anchor ± 4 weeks)
  bounds: DataBounds;
  weather: Record<string, DayWeather>;
  placeName: string;
  toolbar?: React.ReactNode; // the Week/Month toggle, shown left of the title
  library: LibraryItem[];
};

type Change = { id: string; date?: string; remove?: boolean };

/**
 * A continuous-scroll training calendar (TrainingPeaks style). The weeks scroll inside the view; more weeks load
 * in chunks (loadWeeksAction) when the view comes near the top or the bottom of the loaded weeks, back to the
 * earliest data and forward with no limit. The title and ?month= follow the week at the top of the view.
 */
export default function MonthCalendar({ anchor, range, bounds, weather, placeName, library, toolbar }: Props) {
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState<CalendarRange>(range);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [loading, setLoading] = useState<'before' | 'after' | null>(null);
  const [month, setMonth] = useState(() => monthOfWeek(anchor));
  const [height, setHeight] = useState<number | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const agendaRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const loadingRef = useRef(false);
  const monthRef = useRef(month);
  // The first loaded week and its position, to keep the view still when weeks are added above it.
  const firstRow = useRef<{ monday: string; top: number } | null>(null);
  // A week to scroll to once it is on the page (the first render, the arrows, Today).
  const scrollTarget = useRef<{ monday: string; smooth: boolean } | null>({ monday: anchor, smooth: false });

  const today = data.today;
  const weatherUntil = addDays(today, 14);
  const weatherFor = (d: string) => (d >= today && d <= weatherUntil ? weather[d] : undefined);
  const first = data.weeks[0];
  const last = data.weeks.at(-1)!;
  const atEarliest = !chunkBefore(first, bounds.earliest);

  // A server refresh (revalidatePath after an action) sends fresh first weeks: merge them in.
  useEffect(() => {
    setData((d) => mergeRange(d, range));
  }, [range]);

  /** The rows of the view that shows (grid on tablets and up, agenda on phones). */
  const rows = useCallback((): HTMLElement[] => {
    const view = gridRef.current?.offsetParent ? gridRef.current : agendaRef.current;
    return view ? [...view.querySelectorAll<HTMLElement>('[data-week]')] : [];
  }, []);
  const rowOf = useCallback((monday: string) => rows().find((r) => r.dataset.week === monday) ?? null, [rows]);
  const stickyHeight = () => (gridRef.current?.offsetParent ? headerRef.current?.offsetHeight ?? 0 : 0);

  // The scroll area fills the window under the nav and the header row.
  useLayoutEffect(() => {
    const measure = () => {
      const el = scrollerRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setHeight(Math.max(360, Math.round(window.innerHeight - top - 16)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // After each data change: keep the view still when weeks came in above, then do a pending scroll.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const prev = firstRow.current;
    if (prev && prev.monday !== first) {
      const row = rowOf(prev.monday);
      if (row) el.scrollTop += row.offsetTop - prev.top;
    }
    const firstEl = rowOf(first);
    firstRow.current = firstEl ? { monday: first, top: firstEl.offsetTop } : null;
    const target = scrollTarget.current;
    const row = target && rowOf(target.monday);
    if (target && row) {
      scrollTarget.current = null;
      el.scrollTo({ top: Math.max(0, row.offsetTop - stickyHeight()), behavior: target.smooth ? 'smooth' : 'auto' });
    }
  }, [data, first, rowOf]);

  const loadChunk = useCallback(async (chunk: { from: string; to: string } | null, side: 'before' | 'after') => {
    if (!chunk || loadingRef.current) return false;
    loadingRef.current = true;
    setLoading(side);
    try {
      const fresh = await loadWeeksAction(chunk.from, chunk.to);
      setData((d) => mergeRange(d, fresh));
      return true;
    } catch {
      toast.error('Could not load more weeks');
      return false;
    } finally {
      loadingRef.current = false;
      setLoading(null);
    }
  }, []);

  /** Loads the next chunk when the view is near the top or the bottom of the loaded weeks. */
  const checkEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || loadingRef.current) return;
    const d = dataRef.current;
    if (el.scrollTop < EDGE_PX) {
      const chunk = chunkBefore(d.weeks[0], bounds.earliest);
      if (chunk) return void loadChunk(chunk, 'before');
    }
    if (el.scrollHeight - el.scrollTop - el.clientHeight < EDGE_PX) void loadChunk(chunkAfter(d.weeks.at(-1)!), 'after');
  }, [bounds.earliest, loadChunk]);

  // Sentinels at the top and the bottom start the next load.
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) checkEdges();
    }, { root, rootMargin: `${EDGE_PX}px 0px` });
    if (topRef.current) io.observe(topRef.current);
    if (bottomRef.current) io.observe(bottomRef.current);
    return () => io.disconnect();
  }, [checkEdges]);

  // A load can leave a sentinel in view (it then does not fire again): check after each load.
  useEffect(() => {
    if (!loading && scrollTarget.current === null) checkEdges();
  }, [loading, data, checkEdges]);

  // The title and ?month= follow the week at the top of the view.
  const onScroll = useMemo(() => {
    let frame = 0;
    return () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const el = scrollerRef.current;
        if (!el) return;
        const line = el.scrollTop + stickyHeight() + 8;
        let top: string | undefined;
        for (const r of rows()) {
          if (r.offsetTop > line) break;
          top = r.dataset.week;
        }
        const m = top ? monthOfWeek(top) : null;
        if (m && m !== monthRef.current) {
          monthRef.current = m;
          setMonth(m);
          window.history.replaceState(window.history.state, '', `/plan?view=month&month=${m}`);
        }
      });
    };
  }, [rows]);

  /** Scrolls to a week (a Monday), loading weeks first when it is not loaded. */
  async function goTo(monday: string, smooth = true) {
    const floor = earliestBound(bounds.earliest);
    const target = floor && monday < floor ? floor : monday;
    scrollTarget.current = { monday: target, smooth };
    const d = dataRef.current;
    const chunk = chunkToReach(target, d.weeks[0], d.weeks.at(-1)!, bounds.earliest);
    if (chunk) {
      if (!(await loadChunk(chunk, target < d.weeks[0] ? 'before' : 'after'))) scrollTarget.current = null;
      return;
    }
    const row = rowOf(target);
    if (row) {
      scrollTarget.current = null;
      scrollerRef.current?.scrollTo({ top: Math.max(0, row.offsetTop - stickyHeight()), behavior: smooth ? 'smooth' : 'auto' });
    }
  }

  /** Loads the given weeks again (after a move, add or remove) so their workouts, matches and summaries are exact. */
  async function reload(weeks: string[]) {
    const fresh = await Promise.all([...new Set(weeks)].map((w) => loadWeeksAction(w, w).catch(() => null)));
    setData((d) => fresh.reduce((acc: CalendarRange, f) => (f ? mergeRange(acc, f) : acc), d));
  }

  const changeLocal = (c: Change) => setData((d) => ({ ...d, workouts: applyChange(d.workouts, c) }));

  function move(id: string, date: string) {
    const w = data.workouts.find((x) => x.id === id);
    if (!w || w.date === date || w.state === 'done') return;
    changeLocal({ id, date });
    startTransition(async () => {
      try {
        await moveWorkoutAction(id, date);
      } catch {
        toast.error('Could not move the workout');
      }
      await reload([mondayOf(w.date), mondayOf(date)]);
    });
  }

  function remove(id: string) {
    const w = data.workouts.find((x) => x.id === id);
    changeLocal({ id, remove: true });
    startTransition(async () => {
      try {
        await removeWorkoutAction(id);
        toast.success('Workout removed');
      } catch {
        toast.error('Could not remove the workout');
      }
      if (w) await reload([mondayOf(w.date)]);
    });
  }

  function add(itemId: string, date: string) {
    const item = library.find((x) => x.id === itemId);
    startTransition(async () => {
      try {
        await addFromLibraryAction(itemId, date);
        toast.success(`Added ${item?.title ?? 'workout'} on ${longDate(date)}`);
      } catch {
        toast.error('Could not add the workout');
      }
      await reload([mondayOf(date)]);
    });
  }

  function drop(e: React.DragEvent, date: string) {
    e.preventDefault();
    setDragOver(null);
    const lib = e.dataTransfer.getData(LIBRARY_MIME);
    if (lib) return add(lib, date);
    const id = e.dataTransfer.getData(WORKOUT_MIME) || e.dataTransfer.getData('text/plain');
    if (id) move(id, date);
  }

  const index = useMemo(() => {
    const group = <T extends { date: string }>(list: T[]) => {
      const m = new Map<string, T[]>();
      for (const x of list) m.set(x.date, [...(m.get(x.date) ?? []), x]);
      return m;
    };
    return {
      workouts: group(data.workouts),
      activities: group(data.activities),
      lifts: group(data.lifts),
      byId: new Map(data.activities.map((a) => [a.id, a])),
      summaries: new Map(data.summaries.map((s) => [s.monday, s])),
    };
  }, [data]);

  const dayData = (d: string) => {
    const planned = [...(index.workouts.get(d) ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || (a.startTime ?? '99').localeCompare(b.startTime ?? '99'));
    const matched = new Set(planned.map((w) => w.match?.id).filter(Boolean));
    return {
      planned,
      activities: (index.activities.get(d) ?? []).filter((a) => !matched.has(a.id)),
      lifts: (index.lifts.get(d) ?? []).filter((l) => !matched.has(l.id)),
    };
  };
  const actualOf = (w: CalendarWorkout) => (w.match?.source === 'strava' ? index.byId.get(w.match.id) : undefined);
  const planEndWeek = bounds.planEnd ? mondayOf(bounds.planEnd) : null;
  const showPlanEnd = (monday: string) => monday === planEndWeek && monday !== last;
  const thisWeek = mondayOf(today);
  const thisMonth = monthOfWeek(thisWeek);

  const topNote = loading === 'before'
    ? 'Loading earlier weeks…'
    : atEarliest
      ? bounds.earliest ? `Earliest data: ${longDate(bounds.earliest)}` : 'No earlier data'
      : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {toolbar}
        <h1 className="min-w-[11ch] text-2xl font-bold tracking-tight" aria-live="polite">{monthTitle(month)}</h1>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
          <ComplianceLegend />
          <span className="text-xs text-muted-foreground">Weather: {placeName}, next 14 days</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => goTo(firstWeekOfMonth(addMonths(month, -1)))}>
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button variant={month === thisMonth ? 'ghost' : 'outline'} onClick={() => goTo(thisWeek)}>Today</Button>
          <Button variant="outline" size="icon" aria-label="Next month" onClick={() => goTo(firstWeekOfMonth(addMonths(month, 1)))}>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start" style={height ? ({ '--cal-h': `${height}px` } as React.CSSProperties) : undefined}>
        <div
          ref={scrollerRef}
          onScroll={onScroll}
          className="relative h-[calc(100dvh-9rem)] min-w-0 flex-1 overflow-y-auto overscroll-contain rounded-lg border"
          style={height ? { height } : undefined}
          aria-busy={pending || loading !== null}
        >
          <div ref={topRef} aria-hidden className="h-px" />
          {topNote && <p className="px-3 py-2 text-center text-xs text-muted-foreground">{topNote}</p>}

          {/* Grid: tablet and desktop */}
          <div ref={gridRef} className="hidden md:block">
            <div ref={headerRef} className="sticky top-0 z-20 grid grid-cols-[repeat(7,minmax(0,1fr))_9.5rem] border-b bg-background text-xs font-medium text-muted-foreground shadow-[0_1px_0_0_var(--viz-grid)]">
              {WEEKDAYS.map((d) => <div key={d} className="bg-muted/40 px-2 py-1.5">{d}</div>)}
              <div className="border-l bg-muted/40 px-2 py-1.5">Week</div>
            </div>
            {data.weeks.map((monday) => (
              <div key={monday} data-week={monday}>
                <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_9.5rem] border-b">
                  {weekDays(monday).map((d: string) => {
                    const { planned, activities, lifts } = dayData(d);
                    const wx = weatherFor(d);
                    const edge = monthEdges(d);
                    return (
                      <div
                        key={d}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(d); }}
                        onDragLeave={() => setDragOver((x) => (x === d ? null : x))}
                        onDrop={(e) => drop(e, d)}
                        className={cn(
                          'group/day min-h-24 min-w-0 border-r p-1 transition-colors',
                          edge.odd && 'bg-muted/25',
                          edge.top && 'border-t-2 border-t-foreground/25',
                          edge.left && 'border-l-2 border-l-foreground/25',
                          d === today && 'bg-primary/5 ring-1 ring-inset ring-primary',
                          dragOver === d && 'bg-accent'
                        )}
                      >
                        <div className="mb-1 flex items-center justify-between gap-1 px-1">
                          <Link
                            href={weekHref(d)}
                            className={cn('text-xs font-semibold tabular-nums hover:underline', d === today && 'text-primary')}
                            aria-label={`Open the week of ${longDate(d)}`}
                          >
                            {d.slice(8) === '01' ? <span className="uppercase tracking-wide">{shortDate(d)}</span> : Number(d.slice(8))}
                          </Link>
                          {d <= today && (
                            <Link href={`/health/day/${d}`} aria-label={`Health on ${longDate(d)}`} className="text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover/day:opacity-100">
                              <HeartPulse aria-hidden className="h-3 w-3" />
                            </Link>
                          )}
                          <span className="flex-1" />
                          {wx && <WeatherBadge w={wx} compact />}
                        </div>
                        <div className="space-y-1">
                          {planned.map((w) => <PlannedItem key={w.id} w={w} actual={actualOf(w)} onRemove={() => remove(w.id)} disabled={pending} />)}
                          {activities.map((a) => <ActivityItem key={a.id} a={a} />)}
                          {lifts.map((l) => <LiftItem key={l.id} l={l} />)}
                        </div>
                      </div>
                    );
                  })}
                  {index.summaries.get(monday) && <SummaryCell s={index.summaries.get(monday)!} dense />}
                </div>
                {showPlanEnd(monday) && <PlanEndNote date={bounds.planEnd!} />}
              </div>
            ))}
          </div>

          {/* Agenda: phones */}
          <div ref={agendaRef} className="space-y-3 p-2 md:hidden">
            {data.weeks.map((monday, i) => {
              const m = monthOfWeek(monday);
              const newMonth = i === 0 || monthOfWeek(data.weeks[i - 1]) !== m;
              return (
                <div key={monday} data-week={monday} className="space-y-2">
                  {newMonth && <h2 className="px-1 pt-2 text-sm font-semibold">{monthTitle(m)}</h2>}
                  <section className="rounded-lg border">
                    <div className="border-b bg-muted/40 px-3 py-2">
                      <Link href={`/plan?week=${monday}`} className="text-sm font-semibold hover:underline">Week of {shortDate(monday)}</Link>
                      {index.summaries.get(monday) && <SummaryCell s={index.summaries.get(monday)!} compact />}
                    </div>
                    <ul className="divide-y">
                      {weekDays(monday).map((d: string) => {
                        const { planned, activities, lifts } = dayData(d);
                        const wx = weatherFor(d);
                        const empty = !planned.length && !activities.length && !lifts.length;
                        if (empty && d !== today && !wx) return null;
                        return (
                          <li key={d} className={cn('px-3 py-2', d === today && 'bg-primary/5')}>
                            <div className="mb-1 flex items-center justify-between">
                              <Link href={weekHref(d)} className={cn('text-xs font-semibold hover:underline', d === today && 'text-primary')}>
                                {d === today ? `Today · ${shortDate(d)}` : longDate(d)}
                              </Link>
                              {wx && <WeatherBadge w={wx} />}
                            </div>
                            <div className="space-y-1">
                              {planned.map((w) => <PlannedItem key={w.id} w={w} actual={actualOf(w)} onRemove={() => remove(w.id)} disabled={pending} roomy />)}
                              {activities.map((a) => <ActivityItem key={a.id} a={a} roomy />)}
                              {lifts.map((l) => <LiftItem key={l.id} l={l} roomy />)}
                              {empty && <p className="text-xs text-muted-foreground">Nothing planned</p>}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                  {showPlanEnd(monday) && <PlanEndNote date={bounds.planEnd!} />}
                </div>
              );
            })}
          </div>

          <p className="px-3 py-3 text-center text-xs text-muted-foreground">{loading === 'after' ? 'Loading later weeks…' : ' '}</p>
          <div ref={bottomRef} aria-hidden className="h-px" />
        </div>

        <WorkoutLibrary items={library} today={today} onAdd={add} disabled={pending} className="lg:max-h-[var(--cal-h)] lg:overflow-y-auto" />
      </div>
    </div>
  );
}

function PlanEndNote({ date }: { date: string }) {
  return (
    <p className="border-b border-dashed px-3 py-1.5 text-center text-xs text-muted-foreground">
      The plan ends {longDate(date)}. Later weeks show completed activities only.
    </p>
  );
}

function PlannedItem({
  w, actual, onRemove, disabled, roomy = false,
}: {
  w: CalendarWorkout;
  actual?: CalendarActivity;
  onRemove: () => void;
  disabled: boolean;
  roomy?: boolean;
}) {
  const { color } = levelStyle(w.compliance.level);
  const pct = w.compliance.ratio != null ? `${Math.round(w.compliance.ratio * 100)} % of planned ${w.compliance.basis === 'tss' ? 'TSS' : 'time'}` : null;
  const plannedText = [w.duration ? `${w.duration} min` : null, w.tss ? `${Math.round(w.tss)} TSS` : null].filter(Boolean).join(' · ');
  const doneText = actual ? [`${actual.min} min`, actual.tss ? `${Math.round(actual.tss)} TSS` : null].filter(Boolean).join(' · ') : w.match ? w.match.name : null;
  const title = [plainTitle(w.title), `Planned: ${plannedText || 'no target'}`, doneText && `Done: ${doneText}`, `${w.compliance.label}${pct ? ` (${pct})` : ''}`]
    .filter(Boolean)
    .join('\n');
  const draggable = w.state !== 'done';
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData(WORKOUT_MIME, w.id);
        e.dataTransfer.setData('text/plain', w.id);
      }}
      className={cn(
        'group relative rounded border-l-[3px] bg-card text-xs shadow-sm',
        draggable && 'cursor-grab active:cursor-grabbing',
        w.state === 'skipped' && 'opacity-60'
      )}
      style={{ borderLeftColor: color }}
      title={title}
    >
      <Link href={`/plan?week=${mondayOf(w.date)}#w-${w.id}`} className={cn('block px-1.5 py-1', roomy && 'py-1.5')}>
        <span className="flex min-w-0 items-center gap-1">
          <SportIcon id={w.sport} className="h-3 w-3" />
          <span className={cn('min-w-0 flex-1 truncate font-medium', w.state === 'skipped' && 'line-through')}>{plainTitle(w.title)}</span>
          <ComplianceMark level={w.compliance.level} title={`${w.compliance.label}${pct ? `: ${pct}` : ''}`} />
        </span>
        <span className="block truncate tabular-nums text-muted-foreground">
          {plannedText || sport(w.sport).label}
          {actual && <> → {doneText}</>}
        </span>
      </Link>
      <span className={cn('absolute bottom-0.5 right-0.5 items-center gap-0.5', roomy ? 'flex' : 'hidden group-focus-within:flex group-hover:flex')}>
        {actual && (
          <a href={actual.url} target="_blank" rel="noreferrer" aria-label={`Open ${actual.name} on Strava`}
            className="rounded bg-card p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground">
            <ExternalLink aria-hidden className="h-3 w-3" />
          </a>
        )}
      </span>
      <RemoveWorkout
        variant="icon"
        workout={{ title: plainTitle(w.title), date: w.date, state: w.state, imported: w.imported }}
        onRemove={onRemove}
        disabled={disabled}
        className="mt-1"
        iconClassName={cn('absolute bottom-0.5', actual ? 'right-5' : 'right-0.5', roomy ? 'block' : 'hidden group-focus-within:block group-hover:block')}
      />
    </div>
  );
}

function ActivityItem({ a, roomy = false }: { a: CalendarActivity; roomy?: boolean }) {
  const text = [`${a.min} min`, a.km >= 0.5 ? `${a.km} km` : null, a.tss ? `${Math.round(a.tss)} TSS` : null].filter(Boolean).join(' · ');
  return (
    <a
      href={a.url}
      target="_blank"
      rel="noreferrer"
      title={`${a.name}\n${text}\nCompleted, not planned. Opens Strava.`}
      className={cn('block rounded border border-dashed px-1.5 py-1 text-xs hover:bg-accent', roomy && 'py-1.5')}
    >
      <span className="flex min-w-0 items-center gap-1">
        <SportIcon id={a.sport} className="h-3 w-3" />
        <span className="min-w-0 flex-1 truncate">{a.name || sport(a.sport).label}</span>
      </span>
      <span className="block truncate tabular-nums text-muted-foreground">{text}</span>
    </a>
  );
}

function LiftItem({ l, roomy = false }: { l: CalendarLift; roomy?: boolean }) {
  return (
    <Link href={`/lift`} title={`${l.name}\n${l.setsLogged} sets logged in Lift`}
      className={cn('block rounded border border-dashed px-1.5 py-1 text-xs hover:bg-accent', roomy && 'py-1.5')}>
      <span className="flex min-w-0 items-center gap-1">
        <SportIcon id="strength" className="h-3 w-3" />
        <span className="min-w-0 flex-1 truncate">{l.name}</span>
      </span>
      <span className="block text-muted-foreground">{l.setsLogged} sets</span>
    </Link>
  );
}

function SummaryCell({ s, compact = false, dense = false }: { s: WeekSummary; compact?: boolean; dense?: boolean }) {
  const sports = Object.entries(s.done.bySport).filter(([, m]) => m > 0).sort((a, b) => b[1] - a[1]);
  const f = s.fitness;
  const metric = (label: string, value: string, color?: string) => (
    <span className="inline-flex items-center gap-1">
      {color && <span className="h-0.5 w-2.5 rounded-full" style={{ background: color }} />}
      <span className="text-[var(--viz-muted)]">{label}</span>
      <span className="font-medium tabular-nums text-[var(--viz-ink)]">{value}</span>
    </span>
  );
  const fitness = f && (
    <div className={cn('flex flex-wrap gap-x-2 gap-y-0.5', !compact && 'flex-col')} title={`Fitness, fatigue and form on ${shortDate(f.date)}`}>
      {metric('Fitness', String(Math.round(f.ctl)), 'var(--viz-ctl)')}
      {metric('Fatigue', String(Math.round(f.atl)), 'var(--viz-atl)')}
      {metric('Form', `${f.tsb > 0 ? '+' : ''}${Math.round(f.tsb)}`, 'var(--viz-tsb)')}
    </div>
  );
  const totals = (
    <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 tabular-nums">
      <dt className="text-[var(--viz-muted)]">Time</dt>
      <dd className="text-[var(--viz-ink)]">
        {hm(s.done.min)}{s.planned.min > 0 && <span className="text-[var(--viz-muted)]"> / {hm(s.planned.min)}</span>}
      </dd>
      <dt className="text-[var(--viz-muted)]">TSS</dt>
      <dd className="text-[var(--viz-ink)]">
        {s.done.tss}{s.planned.tss > 0 && <span className="text-[var(--viz-muted)]"> / {s.planned.tss}</span>}
      </dd>
      {s.done.km > 0 && (<><dt className="text-[var(--viz-muted)]">Distance</dt><dd className="text-[var(--viz-ink)]">{s.done.km} km</dd></>)}
      {s.planned.count > 0 && (
        <><dt className="text-[var(--viz-muted)]">Workouts</dt><dd className="text-[var(--viz-ink)]">{s.planned.done} / {s.planned.count} done</dd></>
      )}
    </dl>
  );
  const bySport = (sports.length > 0 || s.done.liftSessions > 0) && (
    <ul className={cn('flex flex-wrap gap-x-2 gap-y-0.5', !compact && 'flex-col')}>
      {sports.map(([id, m]) => (
        <li key={id} className="inline-flex items-center gap-1 tabular-nums text-[var(--viz-ink)]">
          <SportIcon id={id} className="h-3 w-3" />
          <span className="sr-only">{sport(id).label}</span>
          {hm(m)}
        </li>
      ))}
      {s.done.liftSessions > 0 && (
        <li className="inline-flex items-center gap-1 text-[var(--viz-ink)]">
          <SportIcon id="strength" className="h-3 w-3" />
          {s.done.liftSessions} Lift
        </li>
      )}
    </ul>
  );
  if (dense) {
    // The grid column: three short lines, so the week row stays as low as its days.
    return (
      <div className="space-y-1 bg-[var(--viz-surface)] p-1.5 text-[11px] leading-tight" aria-label={`Week of ${shortDate(s.monday)} summary`}>
        {f && (
          <div className="flex flex-wrap gap-x-1.5" title={`Fitness, fatigue and form on ${shortDate(f.date)}`}>
            {metric('Fit', String(Math.round(f.ctl)), 'var(--viz-ctl)')}
            {metric('Fat', String(Math.round(f.atl)), 'var(--viz-atl)')}
            {metric('Form', `${f.tsb > 0 ? '+' : ''}${Math.round(f.tsb)}`, 'var(--viz-tsb)')}
          </div>
        )}
        <div className="flex flex-wrap gap-x-2 tabular-nums" title="Done / planned">
          {metric('', `${hm(s.done.min)}${s.planned.min ? `/${hm(s.planned.min)}` : ''}`)}
          {metric('TSS', `${s.done.tss}${s.planned.tss ? `/${s.planned.tss}` : ''}`)}
          {s.done.km > 0 && metric('', `${s.done.km} km`)}
        </div>
        {sports.length > 0 || s.done.liftSessions > 0 ? <div className="[&_ul]:flex-row [&_ul]:flex-wrap">{bySport}</div> : null}
      </div>
    );
  }
  if (compact) {
    return (
      <div className="mt-1 space-y-1 text-[11px]">
        {fitness}
        <div className="flex flex-wrap gap-x-3 tabular-nums">
          {metric('Time', `${hm(s.done.min)}${s.planned.min ? ` / ${hm(s.planned.min)}` : ''}`)}
          {metric('TSS', `${s.done.tss}${s.planned.tss ? ` / ${s.planned.tss}` : ''}`)}
          {s.done.km > 0 && metric('km', String(s.done.km))}
        </div>
        {bySport}
      </div>
    );
  }
  return (
    <div className="space-y-2 bg-[var(--viz-surface)] p-2 text-[11px]" aria-label={`Week of ${shortDate(s.monday)} summary`}>
      {fitness}
      {totals}
      {bySport}
      {(s.done.min > 0 || s.planned.min > 0) && <p className="text-[10px] text-[var(--viz-muted)]">done / planned</p>}
    </div>
  );
}
