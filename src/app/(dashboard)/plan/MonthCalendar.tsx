'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Library } from 'lucide-react';
import LegendPopover from '@/components/plan/LegendPopover';
import { useHotkeys } from '@/components/hotkeys/HotkeysProvider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { addMonths, plainTitle } from '@/lib/plan/calendar.mjs';
import { weekRows } from '@/lib/plan/cells.mjs';
import { applyChange } from '@/lib/plan/remove.mjs';
import { chunkBefore, firstWeekOfMonth, mergeRange, monthOfWeek, topWeekFor } from '@/lib/plan/scroll.mjs';
import { addDays, mondayOf } from '@/lib/plan/week.mjs';
import type { CalendarRange, CalendarWorkout, DataBounds, LibraryItem } from '@/lib/plan/month';
import type { DayWeather } from '@/lib/plan/weather';
import { addFromLibraryAction, duplicateWorkoutAction, moveWorkoutAction, removeWorkoutAction, skipWorkoutAction } from './actions';
import CreateWorkout from './CreateWorkout';
import ItemModal from './ItemModal';
import ItemPreview, { type PreviewActions, type PreviewTarget } from './ItemPreview';
import WorkoutLibrary, { LIBRARY_MIME, WORKOUT_MIME } from './WorkoutLibrary';
import { AgendaWeek } from './AgendaWeek';
import { EdgeNote, LoadError, SkeletonAgenda, SkeletonWeek } from './CalendarStates';
import { GridWeek } from './MonthGrid';
import { COLS, longDate, monthTitle, type DayAction, type Handlers, type WeekRow } from './calendarShared';
import { fetchWeeks, useCalendarScroll } from './useCalendarScroll';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Planned workouts copied for Paste: their ids and a label for the menu. */
type Clip = { ids: string[]; label: string };
type Change = { id: string; date?: string; remove?: boolean };

type Props = {
  anchor: string; // the Monday the first weeks are loaded around (this week, or the first week of ?month)
  /** The week at the top of the view on open: the first week of ?month, or one week before this week. */
  openAt: string;
  range: CalendarRange; // the first weeks loaded (anchor ± 4 weeks)
  bounds: DataBounds;
  weather: Record<string, DayWeather>;
  placeName: string;
  library: LibraryItem[];
  timeZone: string; // the zone the server used for "today" (the tz cookie)
};

/**
 * A continuous-scroll training calendar (TrainingPeaks style). Weeks scroll inside the view and snap under the
 * sticky weekday header. More weeks load in chunks (loadWeeksAction) before the view reaches the top or the bottom,
 * back to the earliest data and forward with no limit. The title and ?month= follow the week at the top of the view.
 *
 * Week rows have a fixed height and are memoized: a scroll, a load or an edit re-renders only the weeks it changed.
 */
export default function MonthCalendar({ openAt, range, bounds, weather, placeName, library, timeZone }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    data, setData, dataRef, loading, month, failed, height, scrollerRef, gridRef, agendaRef, topRef, bottomRef, first, retry, onScroll, goTo,
  } = useCalendarScroll({ openAt, range, bounds });
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ date: string; anchor: HTMLElement } | null>(null);
  const [modalKey, setModalKey] = useState<string | null>(null);
  const [createOn, setCreateOn] = useState<string | null>(null);
  const [clip, setClip] = useState<Clip | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const rowCache = useRef(new Map());

  const today = data.today;
  const atEarliest = !chunkBefore(first, bounds.earliest);
  const weeks = useMemo(() => weekRows(data, rowCache.current) as WeekRow[], [data]);

  // The server picks "today" from the tz cookie. Set it from this browser so travel days line up.
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz !== timeZone) {
      document.cookie = `tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    }
  }, [timeZone, router]);

  // A drop outside a day (or Escape) ends the drag highlight.
  useEffect(() => {
    const clear = () => setDragOver(null);
    document.addEventListener('dragend', clear);
    document.addEventListener('drop', clear);
    return () => {
      document.removeEventListener('dragend', clear);
      document.removeEventListener('drop', clear);
    };
  }, []);

  /** Loads the given weeks again (after a move, add or remove) so their workouts, matches and summaries are exact. */
  async function reload(mondays: string[]) {
    const fresh = await Promise.all([...new Set(mondays)].map((w) => fetchWeeks(w, w).catch(() => null)));
    setData((d) => fresh.reduce((acc: CalendarRange, f) => (f ? mergeRange(acc, f) : acc), d));
  }

  const changeLocal = (c: Change) => setData((d) => ({ ...d, workouts: applyChange(d.workouts, c) }));

  function move(id: string, date: string) {
    const w = dataRef.current.workouts.find((x) => x.id === id);
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
    const w = dataRef.current.workouts.find((x) => x.id === id);
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

  function skip(w: CalendarWorkout) {
    startTransition(async () => {
      try {
        await skipWorkoutAction(w.id, w.status !== 'skipped');
      } catch {
        toast.error('Could not change the workout');
      }
      await reload([mondayOf(w.date)]);
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

  /** The day's planned workouts that are not done (the ones Copy, Paste and Delete act on). */
  const plannedOn = (date: string) => dataRef.current.workouts.filter((w) => w.date === date && w.state !== 'done');

  function copy(ws: CalendarWorkout[]) {
    if (!ws.length) return;
    const label = ws.length === 1 ? plainTitle(ws[0].title) : `${ws.length} workouts`;
    setClip({ ids: ws.map((w) => w.id), label });
    toast.success(`Copied ${label}. Use Paste in a day's menu.`);
  }

  function paste(date: string) {
    const c = clipRef.current;
    if (!c) return;
    startTransition(async () => {
      try {
        for (const id of c.ids) await duplicateWorkoutAction(id, date);
        toast.success(`Pasted ${c.label} on ${longDate(date)}`);
      } catch {
        toast.error('Could not paste the workout');
      }
      await reload([mondayOf(date)]);
    });
  }

  function clearDay(date: string) {
    const ws = plannedOn(date);
    if (!ws.length) return;
    toast(`Delete ${ws.length === 1 ? plainTitle(ws[0].title) : `${ws.length} planned workouts`} on ${longDate(date)}?`, {
      action: {
        label: 'Delete',
        onClick: () => {
          ws.forEach((w) => changeLocal({ id: w.id, remove: true }));
          startTransition(async () => {
            try {
              for (const w of ws) await removeWorkoutAction(w.id);
            } catch {
              toast.error('Could not delete the workouts');
            }
            await reload([mondayOf(date)]);
          });
        },
      },
    });
  }

  function dayAction(date: string, action: DayAction) {
    if (action === 'add') setCreateOn(date);
    else if (action === 'copy') copy(plannedOn(date));
    else if (action === 'paste') paste(date);
    else clearDay(date);
  }

  function openTarget(target: PreviewTarget, anchor: HTMLElement) {
    if (target.kind === 'item') {
      setPreview(null);
      setModalKey(target.key);
    } else setPreview({ date: target.date, anchor });
  }

  // The rows get one stable handler object; it calls the latest move / add / remove through this ref.
  const impl = useRef({ move, add, remove, skip, dayAction });
  impl.current = { move, add, remove, skip, dayAction };
  const clipRef = useRef(clip);
  clipRef.current = clip;
  const handlers = useMemo<Handlers>(() => ({
    drop: (e, date) => {
      e.preventDefault();
      setDragOver(null);
      const lib = e.dataTransfer.getData(LIBRARY_MIME);
      if (lib) return impl.current.add(lib, date);
      const id = e.dataTransfer.getData(WORKOUT_MIME) || e.dataTransfer.getData('text/plain');
      if (id) impl.current.move(id, date);
    },
    over: (date) => setDragOver(date),
    leave: (date) => setDragOver((x) => (x === date ? null : x)),
    open: (target, anchor) => openTarget(target, anchor),
    day: (date, action) => impl.current.dayAction(date, action),
  }), []);
  const closePreview = useCallback(() => setPreview(null), []);
  const previewActions = useMemo<PreviewActions>(() => ({
    move: (id, date) => impl.current.move(id, date),
    skip: (w) => impl.current.skip(w),
    remove: (id) => {
      setPreview(null);
      impl.current.remove(id);
    },
    open: (target, anchor) => openTarget(target, anchor),
  }), []);
  // The modal and the day list read their items from the latest data, so a move or a skip shows at once.
  const allItems = useMemo(() => weeks.flatMap((w) => w.days.flatMap((d) => d.items)), [weeks]);
  const modalIndex = modalKey ? allItems.findIndex((i) => i.key === modalKey) : -1;
  const modalItem = modalIndex >= 0 ? allItems[modalIndex] : null;
  const stepModal = useCallback(
    (dir: -1 | 1) => {
      const next = allItems[modalIndex + dir];
      if (next) setModalKey(next.key);
    },
    [allItems, modalIndex]
  );
  const dayItems = useMemo(() => {
    if (!preview) return null;
    const day = weeks.flatMap((w) => w.days).find((d) => d.date === preview.date);
    return day && day.items.length ? day.items : null;
  }, [preview, weeks]);

  const overIn = (monday: string) => (dragOver && dragOver >= monday && dragOver <= addDays(monday, 6) ? dragOver : null);
  const thisWeek = mondayOf(today);
  useHotkeys([
    { key: 't', label: 'Today', run: () => goTo(topWeekFor(thisWeek, bounds.earliest)) },
    { key: '[', label: 'Previous month', run: () => goTo(firstWeekOfMonth(addMonths(month, -1))) },
    { key: ']', label: 'Next month', run: () => goTo(firstWeekOfMonth(addMonths(month, 1))) },
    ...(library.length > 0 ? [{ key: 'l', label: 'Workout library', run: () => setLibraryOpen((o) => !o) }] : []),
  ]);
  const months = useMemo(() => {
    const out: { month: string; weeks: WeekRow[] }[] = [];
    for (const w of weeks) {
      const m = monthOfWeek(w.monday);
      if (out.at(-1)?.month !== m) out.push({ month: m, weeks: [] });
      out.at(-1)!.weeks.push(w);
    }
    return out;
  }, [weeks]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="min-w-[10.5rem] text-2xl font-semibold tracking-tight text-[var(--viz-ink)]" aria-live="polite">{monthTitle(month)}</h1>
        <span className="hidden items-center gap-3 text-xs text-[var(--viz-muted)] xl:flex">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3.5 w-6 rounded-[4px] border border-dashed border-[var(--viz-axis)]" /> Planned
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3.5 w-6 rounded-[4px] bg-card shadow-sm ring-1 ring-border" /> Completed
          </span>
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {library.length > 0 && (
            <Button variant={libraryOpen ? 'secondary' : 'outline'} onClick={() => setLibraryOpen((o) => !o)} aria-expanded={libraryOpen}>
              <Library aria-hidden className="mr-1.5 h-4 w-4" /> Library
            </Button>
          )}
          <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => goTo(firstWeekOfMonth(addMonths(month, -1)))}>
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => goTo(topWeekFor(thisWeek, bounds.earliest))}>Today</Button>
          <Button variant="outline" size="icon" aria-label="Next month" onClick={() => goTo(firstWeekOfMonth(addMonths(month, 1)))}>
            <ChevronDown className="h-4 w-4" />
          </Button>
          <LegendPopover placeName={placeName} />
        </div>
      </div>

      <div className="relative">
        <div
          ref={scrollerRef}
          onScroll={onScroll}
          className="plan-scroller relative h-[calc(100dvh-8rem)] min-w-0 overflow-y-auto overscroll-contain bg-background"
          style={height ? { height } : undefined}
          aria-busy={pending || loading !== null}
        >
          <div ref={topRef} aria-hidden className="h-px" />
          <span className="sr-only" aria-live="polite">{loading ? 'Loading weeks' : ''}</span>

          {/* Grid: tablet and desktop */}
          <div ref={gridRef} className="hidden md:block">
            <div className={cn(COLS, 'sticky top-0 z-20 h-8 border-b bg-background/95 text-[10px] font-semibold uppercase tracking-wider text-[var(--viz-muted)] backdrop-blur')}>
              {WEEKDAYS.map((d) => <div key={d} className="flex items-center px-2">{d}</div>)}
              <div className="flex items-center border-l px-2">Week</div>
            </div>
            {atEarliest ? (
              <EdgeNote earliest={bounds.earliest} />
            ) : failed.before !== null && loading !== 'before' ? (
              <LoadError text="Could not load earlier weeks" onRetry={() => retry('before')} />
            ) : (
              <><SkeletonWeek /><SkeletonWeek /></>
            )}
            {weeks.map((w) => (
              <GridWeek key={w.monday} week={w} today={today} weather={weather} over={overIn(w.monday)} clip={clip?.label ?? null} h={handlers} />
            ))}
            {failed.after !== null && loading !== 'after' ? (
              <LoadError text="Could not load later weeks" onRetry={() => retry('after')} />
            ) : (
              <><SkeletonWeek /><SkeletonWeek /></>
            )}
          </div>

          {/* Agenda: phones */}
          <div ref={agendaRef} className="px-2 pb-2 md:hidden">
            {atEarliest ? (
              <EdgeNote earliest={bounds.earliest} />
            ) : failed.before !== null && loading !== 'before' ? (
              <LoadError text="Could not load earlier weeks" onRetry={() => retry('before')} />
            ) : (
              <SkeletonAgenda />
            )}
            {months.map((g) => (
              <div key={g.month}>
                <h2 className="sticky top-0 z-10 -mx-2 flex h-8 items-center border-b bg-background/95 px-3 text-sm font-semibold text-[var(--viz-ink)] backdrop-blur">
                  {monthTitle(g.month)}
                </h2>
                <div className="space-y-2 pt-2">
                  {g.weeks.map((w) => (
                    <AgendaWeek key={w.monday} week={w} today={today} weather={weather} clip={clip?.label ?? null} h={handlers} />
                  ))}
                </div>
              </div>
            ))}
            {failed.after !== null && loading !== 'after' ? (
              <LoadError text="Could not load later weeks" onRetry={() => retry('after')} />
            ) : (
              <SkeletonAgenda />
            )}
          </div>
          <div ref={bottomRef} aria-hidden className="h-px" />
        </div>

        {libraryOpen && (
          // Not modal: the calendar stays live under it, so a library item can be dragged onto a day.
          <WorkoutLibrary
            items={library}
            today={today}
            onAdd={add}
            disabled={pending}
            onClose={() => setLibraryOpen(false)}
            className="absolute right-0 top-0 z-30 max-h-full w-72 overflow-y-auto bg-background shadow-2xl"
          />
        )}
      </div>
      {preview && dayItems && (
        <ItemPreview
          anchor={preview.anchor}
          items={dayItems}
          title={longDate(preview.date)}
          onClose={closePreview}
          actions={previewActions}
          scroller={scrollerRef.current}
        />
      )}
      {modalItem && (
        <ItemModal
          item={modalItem}
          onClose={() => setModalKey(null)}
          onStep={stepModal}
          canStep={{ prev: modalIndex > 0, next: modalIndex < allItems.length - 1 }}
          onCopy={(w) => copy([w])}
          weather={weather}
          onLiftChanged={(date) => reload([mondayOf(date)])}
        />
      )}
      {createOn && (
        <CreateWorkout
          date={createOn}
          library={library}
          onClose={() => setCreateOn(null)}
          onCreated={(date) => {
            router.refresh();
            void reload([mondayOf(date)]);
          }}
          onAddFromLibrary={add}
        />
      )}
    </div>
  );
}
