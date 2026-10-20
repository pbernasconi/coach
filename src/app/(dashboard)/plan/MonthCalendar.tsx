'use client';

import Link from 'next/link';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, ClipboardPaste, Copy, Dumbbell, HeartPulse, Library, MoreHorizontal, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import SportIcon from '@/components/SportIcon';
import ComplianceMark, { levelStyle } from '@/components/plan/ComplianceMark';
import LegendPopover from '@/components/plan/LegendPopover';
import { useHotkeys } from '@/components/hotkeys/HotkeysProvider';
import WeatherBadge from '@/components/plan/WeatherBadge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { sport } from '@/lib/sports';
import { addMonths, plainTitle } from '@/lib/plan/calendar.mjs';
import { dur, visibleChips, weekColumnMode, weekRows } from '@/lib/plan/cells.mjs';
import { applyChange } from '@/lib/plan/remove.mjs';
import {
  chunkAfter, chunkBefore, chunkToReach, earliestBound, firstWeekOfMonth, mergeRange, monthOfWeek, topWeekFor, withTimeout,
} from '@/lib/plan/scroll.mjs';
import { addDays, mondayOf } from '@/lib/plan/week.mjs';
import type { CalendarActivity, CalendarLift, CalendarRange, CalendarWorkout, DataBounds, LibraryItem, WeekSummary } from '@/lib/plan/month';
import type { DayWeather } from '@/lib/plan/weather';
import { addFromLibraryAction, duplicateWorkoutAction, loadWeeksAction, moveWorkoutAction, removeWorkoutAction, skipWorkoutAction } from './actions';
import CreateWorkout from './CreateWorkout';
import ItemModal from './ItemModal';
import ItemPreview, { type Item, type PreviewActions, type PreviewTarget } from './ItemPreview';
import WorkoutLibrary, { LIBRARY_MIME, WORKOUT_MIME } from './WorkoutLibrary';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** Start the next load when the view is this close (px) to the top or bottom of the loaded weeks: about 10 rows. */
const EDGE_PX = 1500;
/** The fixed week row height (also --plan-row in plan.css) and the grid columns: 7 equal days and the week column. */
const ROW_H = 'h-[9.5rem]';
const COLS = 'grid grid-cols-[repeat(7,minmax(0,1fr))_9.5rem]';
const HEAD_PX = 32; // the sticky weekday header (grid) and month heading (agenda): h-8
/** A load that has not answered after this long counts as failed (it shows Retry, not a skeleton forever). */
const LOAD_TIMEOUT_MS = 15_000;
/** After a failed load, scrolling retries it, at most this often. */
const RETRY_AFTER_MS = 4_000;

const fetchWeeks = (from: string, to: string) => withTimeout(loadWeeksAction(from, to), LOAD_TIMEOUT_MS, 'Loading weeks') as Promise<CalendarRange>;

const hm = (min: number) => `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')}`;
const monthTitle = (month: string) =>
  new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const monthShort = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
const shortDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const longDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const weekday = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

type Day = { date: string; items: Item[] };
type WeekRow = { monday: string; days: Day[]; summary: WeekSummary | null };
/** Stable callbacks for the memoized rows (they read the latest state through refs). */
type Handlers = {
  drop: (e: React.DragEvent, date: string) => void;
  over: (date: string) => void;
  leave: (date: string) => void;
  /** Opens the preview card for an item or a day, next to the clicked element. */
  open: (target: PreviewTarget, anchor: HTMLElement) => void;
  /** The day menu and the "+": add a workout, copy or paste the day's planned workouts, or delete them. */
  day: (date: string, action: DayAction) => void;
};
type DayAction = 'add' | 'copy' | 'paste' | 'clear';
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
  const [data, setData] = useState<CalendarRange>(range);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [loading, setLoading] = useState<'before' | 'after' | null>(null);
  const [month, setMonth] = useState(() => monthOfWeek(openAt));
  const [failed, setFailed] = useState<{ before: number | null; after: number | null }>({ before: null, after: null });
  const [height, setHeight] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ date: string; anchor: HTMLElement } | null>(null);
  const [modalKey, setModalKey] = useState<string | null>(null);
  const [createOn, setCreateOn] = useState<string | null>(null);
  const [clip, setClip] = useState<Clip | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const agendaRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const loadingRef = useRef(false);
  const monthRef = useRef(month);
  const rowCache = useRef(new Map());
  // The first loaded week and its position, to keep the view still when weeks are added above it.
  const firstRow = useRef<{ monday: string; top: number } | null>(null);
  // A week to scroll to once it is on the page (the first render, the arrows, Today).
  const scrollTarget = useRef<{ monday: string; smooth: boolean } | null>({ monday: openAt, smooth: false });
  const failedRef = useRef(failed);
  failedRef.current = failed;
  const jumping = useRef(false);
  const snapTimer = useRef(0);

  const today = data.today;
  const first = data.weeks[0];
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

  // Snap is off while the calendar moves the view itself (a jump or a prepend), so the two never fight.
  const resumeSnap = useCallback((after: 'frame' | 'scrollend') => {
    const el = scrollerRef.current;
    if (!el) return;
    window.clearTimeout(snapTimer.current);
    const on = () => {
      window.clearTimeout(snapTimer.current);
      el.removeEventListener('scrollend', on);
      jumping.current = false;
      el.style.scrollSnapType = '';
      el.dispatchEvent(new Event('scroll')); // the title follows where the jump ended
    };
    if (after === 'scrollend') {
      el.addEventListener('scrollend', on);
      snapTimer.current = window.setTimeout(on, 1000); // no scrollend event (Safari, or no movement)
    } else {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!jumping.current) el.style.scrollSnapType = '';
      }));
    }
  }, []);

  const scrollToRow = useCallback((row: HTMLElement, smooth: boolean) => {
    const el = scrollerRef.current;
    if (!el) return;
    jumping.current = true;
    el.style.scrollSnapType = 'none';
    el.scrollTo({ top: Math.max(0, row.offsetTop - HEAD_PX), behavior: smooth ? 'smooth' : 'auto' });
    if (smooth) resumeSnap('scrollend');
    else {
      jumping.current = false;
      resumeSnap('frame');
    }
  }, [resumeSnap]);

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

  // After each data change, before paint: keep the view still when weeks came in above, then do a pending scroll.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const prev = firstRow.current;
    if (prev && prev.monday !== first) {
      const row = rowOf(prev.monday);
      if (row) {
        el.style.scrollSnapType = 'none';
        el.scrollTop += row.offsetTop - prev.top;
        resumeSnap('frame');
      }
    }
    const firstEl = rowOf(first);
    firstRow.current = firstEl ? { monday: first, top: firstEl.offsetTop } : null;
    const target = scrollTarget.current;
    const row = target && rowOf(target.monday);
    if (target && row) {
      scrollTarget.current = null;
      scrollToRow(row, target.smooth);
    }
  }, [data, first, rowOf, scrollToRow, resumeSnap]);

  const loadChunk = useCallback(async (chunk: { from: string; to: string } | null, side: 'before' | 'after') => {
    if (!chunk || loadingRef.current) return false;
    loadingRef.current = true;
    setLoading(side);
    try {
      const fresh = await fetchWeeks(chunk.from, chunk.to);
      setFailed((f) => ({ ...f, [side]: null }));
      setData((d) => mergeRange(d, fresh));
      return true;
    } catch (error) {
      console.error('Loading weeks failed:', error);
      setFailed((f) => ({ ...f, [side]: Date.now() }));
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
    const f = failedRef.current;
    if (el.scrollTop < EDGE_PX && f.before === null) {
      const chunk = chunkBefore(d.weeks[0], bounds.earliest);
      if (chunk) return void loadChunk(chunk, 'before');
    }
    if (el.scrollHeight - el.scrollTop - el.clientHeight < EDGE_PX && f.after === null) void loadChunk(chunkAfter(d.weeks.at(-1)!), 'after');
  }, [bounds.earliest, loadChunk]);

  // Sentinels at the top and the bottom start the next load, well before the skeleton rows come into view.
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

  /** Clears a failed side and loads it again (the Retry button, or a scroll some seconds after the failure). */
  const retry = useCallback((side: 'before' | 'after') => {
    failedRef.current = { ...failedRef.current, [side]: null };
    setFailed((f) => ({ ...f, [side]: null }));
    checkEdges();
  }, [checkEdges]);

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

  /**
   * The title and ?month= follow the week at the top of the scroll area, just below the sticky header. Positions
   * come from getBoundingClientRect against the scroll area itself, so no offsetParent or observer root can skew it.
   */
  const updateTitle = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const line = el.getBoundingClientRect().top + HEAD_PX + 4;
    const top = rows().find((r) => r.getBoundingClientRect().bottom > line)?.dataset.week;
    const m = top ? monthOfWeek(top) : null;
    if (m && m !== monthRef.current) {
      monthRef.current = m;
      setMonth(m);
      window.history.replaceState(window.history.state, '', `/plan?month=${m}`);
    }
  }, [rows]);

  // A jump or a prepend moves the view without the user: update the title then too.
  useEffect(() => {
    const id = requestAnimationFrame(updateTitle);
    return () => cancelAnimationFrame(id);
  }, [data, updateTitle]);

  // The title and ?month= update in one read per animation frame, and a state change only when the month changes
  // (the memoized rows do not re-render).
  const onScroll = useMemo(() => {
    let frame = 0;
    return () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        updateTitle();
        const f = failedRef.current;
        const now = Date.now();
        if (f.before !== null && now - f.before > RETRY_AFTER_MS) retry('before');
        else if (f.after !== null && now - f.after > RETRY_AFTER_MS) retry('after');
      });
    };
  }, [updateTitle, retry]);

  /** Scrolls to a week (a Monday), loading weeks first when it is not loaded. */
  async function goTo(monday: string, smooth = true) {
    const floor = earliestBound(bounds.earliest);
    const target = floor && monday < floor ? floor : monday;
    const d = dataRef.current;
    const chunk = chunkToReach(target, d.weeks[0], d.weeks.at(-1)!, bounds.earliest);
    if (chunk) {
      scrollTarget.current = { monday: target, smooth };
      if (!(await loadChunk(chunk, target < d.weeks[0] ? 'before' : 'after'))) scrollTarget.current = null;
      return;
    }
    const row = rowOf(target);
    if (row) scrollToRow(row, smooth);
  }

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

function LoadError({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <p role="status" className="flex h-10 items-center justify-center gap-2 border-b text-xs text-[var(--viz-ink-2)]">
      <TriangleAlert aria-hidden className="h-3.5 w-3.5 text-[var(--plan-off)]" />
      {text}
      <span aria-hidden className="text-[var(--viz-muted)]">·</span>
      <button type="button" onClick={onRetry} className="rounded font-medium text-[var(--viz-ink)] underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Retry
      </button>
    </p>
  );
}

function EdgeNote({ earliest }: { earliest: string | null }) {
  return (
    <p className="flex h-8 items-center justify-center border-b text-[11px] text-[var(--viz-muted)]">
      {earliest ? `Earliest data: ${longDate(earliest)}` : 'No earlier data'}
    </p>
  );
}

function SkeletonWeek() {
  return (
    <div aria-hidden className={cn(COLS, ROW_H, 'border-b')}>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className={cn('space-y-1.5 p-1.5', i < 7 ? 'border-r' : 'bg-[var(--viz-surface)]')}>
          <div className="h-3 w-5 animate-pulse rounded bg-muted" />
          {i % 3 !== 1 && <div className="h-[34px] animate-pulse rounded-[5px] bg-muted/70" />}
        </div>
      ))}
    </div>
  );
}

function SkeletonAgenda() {
  return <div aria-hidden className="my-2 h-40 animate-pulse rounded-lg border bg-muted/40" />;
}

// ---------------------------------------------------------------------------------------------------------------
// Grid (tablet and desktop)

const GridWeek = memo(function GridWeek({
  week, today, weather, over, clip, h,
}: {
  week: WeekRow;
  today: string;
  weather: Record<string, DayWeather>;
  over: string | null;
  clip: string | null;
  h: Handlers;
}) {
  const weatherUntil = addDays(today, 14);
  return (
    <div data-week={week.monday} className={cn('plan-week', COLS, ROW_H, 'border-b')}>
      {week.days.map((day) => (
        <DayCell
          key={day.date}
          day={day}
          today={today}
          wx={day.date >= today && day.date <= weatherUntil ? weather[day.date] : undefined}
          over={over === day.date}
          clip={clip}
          h={h}
        />
      ))}
      <WeekColumn s={week.summary} monday={week.monday} today={today} />
    </div>
  );
});

function DayCell({ day, today, wx, over, clip, h }: { day: Day; today: string; wx?: DayWeather; over: boolean; clip: string | null; h: Handlers }) {
  const d = day.date;
  const past = d < today;
  const isToday = d === today;
  const { shown, more } = visibleChips(day.items) as { shown: Item[]; more: number };
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        h.over(d);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) h.leave(d);
      }}
      onDrop={(e) => h.drop(e, d)}
      onDoubleClick={(e) => {
        if (e.target === e.currentTarget) h.day(d, 'add');
      }}
      className={cn(
        'group/day relative flex min-h-0 min-w-0 flex-col gap-0.5 overflow-hidden border-r px-1 pb-1 pt-0.5 transition-colors',
        past && 'bg-muted/40',
        isToday && 'bg-primary/[0.04] ring-2 ring-inset ring-primary',
        over && 'bg-primary/10 ring-2 ring-inset ring-primary/70'
      )}
    >
      <DayHead d={d} past={past} isToday={isToday} wx={wx} menu={<DayMenu d={d} day={day} clip={clip} h={h} />} />
      {shown.map((item) => <Chip key={item.key} item={item} h={h} />)}
      {more > 0 && (
        <button
          type="button"
          onClick={(e) => h.open({ kind: 'day', date: d }, e.currentTarget)}
          className="rounded px-1 text-left text-[11px] font-medium text-[var(--viz-ink-2)] hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          +{more} more
        </button>
      )}
      {more === 0 && (
        <button
          type="button"
          onClick={() => h.day(d, 'add')}
          aria-label={`Add a workout on ${longDate(d)}`}
          className="mt-0.5 flex h-6 shrink-0 items-center justify-center rounded-[5px] border border-dashed border-[var(--viz-axis)] text-[var(--viz-muted)] opacity-0 transition-opacity hover:border-[var(--viz-ink-2)] hover:text-[var(--viz-ink)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/day:opacity-100"
        >
          <Plus aria-hidden className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/** The day menu (TrainingPeaks style): add a workout, copy or paste planned workouts, delete them. */
function DayMenu({ d, day, clip, h }: { d: string; day: Day; clip: string | null; h: Handlers }) {
  const planned = day.items.filter((i) => i.kind === 'planned' && i.w.state !== 'done').length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Menu for ${longDate(d)}`}
        className="rounded p-0.5 text-[var(--viz-muted)] opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/day:opacity-100 data-[state=open]:opacity-100"
      >
        <MoreHorizontal aria-hidden className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={() => h.day(d, 'add')}>
          <Plus aria-hidden className="mr-2 h-4 w-4" /> Add a workout…
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!planned} onSelect={() => h.day(d, 'copy')}>
          <Copy aria-hidden className="mr-2 h-4 w-4" /> Copy {planned > 1 ? `${planned} workouts` : 'workout'}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!clip} onSelect={() => h.day(d, 'paste')}>
          <ClipboardPaste aria-hidden className="mr-2 h-4 w-4" />
          <span className="truncate">Paste{clip ? ` ${clip}` : ''}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!planned} onSelect={() => h.day(d, 'clear')} className="text-[var(--plan-missed)] focus:text-[var(--plan-missed)]">
          <Trash2 aria-hidden className="mr-2 h-4 w-4" /> Delete {planned > 1 ? `${planned} planned` : 'planned'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DayHead({ d, past, isToday, wx, menu, roomy = false }: { d: string; past: boolean; isToday: boolean; wx?: DayWeather; menu?: React.ReactNode; roomy?: boolean }) {
  const isFirst = d.slice(8) === '01';
  return (
    <div className="flex h-5 shrink-0 items-center gap-1">
      <span
        className={cn(
          'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums',
          isToday ? 'bg-primary text-primary-foreground' : past ? 'text-[var(--viz-muted)]' : 'text-[var(--viz-ink)]'
        )}
      >
        {isFirst && <span className="mr-1 uppercase tracking-wide">{monthShort(d)}</span>}
        {Number(d.slice(8))}
      </span>
      {isToday && <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">Today</span>}
      {past && !roomy && (
        <Link
          href={`/health/day/${d}`}
          aria-label={`Health on ${longDate(d)}`}
          className="rounded text-[var(--viz-muted)] opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/day:opacity-100"
        >
          <HeartPulse aria-hidden className="h-3 w-3" />
        </Link>
      )}
      <span className="flex-1" />
      {wx && <WeatherBadge w={wx} date={d} compact={!roomy} />}
      {menu}
    </div>
  );
}

function Chip({ item, h, roomy = false }: { item: Item; h: Handlers; roomy?: boolean }) {
  const open = (e: React.MouseEvent<HTMLElement>) => h.open({ kind: 'item', key: item.key }, e.currentTarget);
  if (item.kind === 'planned') return <PlannedChip w={item.w} actual={item.actual} roomy={roomy} onOpen={open} />;
  if (item.kind === 'activity') return <ActivityChip a={item.a} roomy={roomy} onOpen={open} />;
  return <LiftChip l={item.l} roomy={roomy} onOpen={open} />;
}

const chipBase = 'group/chip relative flex min-w-0 flex-col justify-center rounded-[5px] border border-l-[3px] px-1.5 text-[11px] leading-[15px] transition-shadow';
const chipFocus = 'rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

type OnOpen = (e: React.MouseEvent<HTMLElement>) => void;

function PlannedChip({ w, actual, roomy, onOpen }: { w: CalendarWorkout; actual: CalendarActivity | null; roomy: boolean; onOpen: OnOpen }) {
  const lvl = levelStyle(w.compliance.level);
  const done = w.state === 'done';
  const missed = w.state === 'missed';
  const pct = w.compliance.ratio != null ? `${Math.round(w.compliance.ratio * 100)} % of planned ${w.compliance.basis === 'tss' ? 'TSS' : 'time'}` : null;
  const plannedText = [w.duration ? dur(w.duration) : null, w.tss ? `${Math.round(w.tss)} TSS` : null].filter(Boolean).join(' · ');
  const doneText = actual ? [dur(actual.min), actual.tss ? `${Math.round(actual.tss)} TSS` : null].filter(Boolean).join(' · ') : w.match?.name ?? null;
  const tooltip = [plainTitle(w.title), `Planned: ${plannedText || 'no target'}`, doneText && `Done: ${doneText}`, `${w.compliance.label}${pct ? ` (${pct})` : ''}`]
    .filter(Boolean)
    .join('\n');
  const draggable = !done;
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData(WORKOUT_MIME, w.id);
        e.dataTransfer.setData('text/plain', w.id);
        e.dataTransfer.effectAllowed = 'move';
        e.currentTarget.classList.add('plan-dragging');
      }}
      onDragEnd={(e) => e.currentTarget.classList.remove('plan-dragging')}
      className={cn(
        chipBase,
        roomy ? 'py-1.5' : 'h-[34px] shrink-0',
        done && 'plan-tint border-transparent shadow-sm',
        missed && 'plan-tint border-dashed border-[var(--plan-missed)]/50',
        !done && !missed && 'border-dashed border-[var(--viz-axis)] bg-background/80',
        draggable && 'cursor-grab hover:shadow-md active:cursor-grabbing',
        w.state === 'skipped' && 'opacity-60'
      )}
      style={{ borderLeftColor: sport(w.sport).color, borderLeftStyle: 'solid', '--chip-tint': lvl.color } as React.CSSProperties}
      title={tooltip}
    >
      <button type="button" onClick={onOpen} draggable={false} className={cn('block min-w-0 text-left', chipFocus)}>
        <span className="flex min-w-0 items-center gap-1">
          <SportIcon id={w.sport} className="h-3 w-3" />
          <span className={cn('min-w-0 flex-1 truncate font-medium text-[var(--viz-ink)]', w.state === 'skipped' && 'line-through')}>{plainTitle(w.title)}</span>
          <ComplianceMark level={w.compliance.level} title={`${w.compliance.label}${pct ? `: ${pct}` : ''}`} />
        </span>
        <span className="block truncate tabular-nums text-[var(--viz-ink-2)]">
          {done && actual ? (
            <>
              {doneText}
              {plannedText && <span className="text-[var(--viz-muted)]"> / {plannedText}</span>}
            </>
          ) : (
            plannedText || sport(w.sport).label
          )}
        </span>
      </button>
    </div>
  );
}

function ActivityChip({ a, roomy, onOpen }: { a: CalendarActivity; roomy: boolean; onOpen: OnOpen }) {
  const text = [dur(a.min), a.km >= 0.5 ? `${a.km} km` : null, a.tss ? `${Math.round(a.tss)} TSS` : null].filter(Boolean).join(' · ');
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${a.name}\n${text}\nCompleted, not planned.`}
      className={cn(chipBase, 'text-left', roomy ? 'py-1.5' : 'h-[34px] shrink-0', 'border-transparent bg-card shadow-sm hover:shadow-md', chipFocus, 'rounded-[5px]')}
      style={{ borderLeftColor: sport(a.sport).color }}
    >
      <span className="flex min-w-0 items-center gap-1">
        <SportIcon id={a.sport} className="h-3 w-3" />
        <span className="min-w-0 flex-1 truncate font-medium text-[var(--viz-ink)]">{a.name || sport(a.sport).label}</span>
        <span className="sr-only">Completed, not planned</span>
      </span>
      <span className="block truncate tabular-nums text-[var(--viz-ink-2)]">{text}</span>
    </button>
  );
}

function LiftChip({ l, roomy, onOpen }: { l: CalendarLift; roomy: boolean; onOpen: OnOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${l.name}\n${l.setsLogged} sets logged in Lift`}
      className={cn(chipBase, 'text-left', roomy ? 'py-1.5' : 'h-[34px] shrink-0', 'border-transparent bg-card shadow-sm hover:shadow-md', chipFocus, 'rounded-[5px]')}
      style={{ borderLeftColor: sport('strength').color }}
    >
      <span className="flex min-w-0 items-center gap-1">
        <Dumbbell aria-hidden className="h-3 w-3 shrink-0" style={{ color: sport('strength').color }} />
        <span className="min-w-0 flex-1 truncate font-medium text-[var(--viz-ink)]">{l.name}</span>
      </span>
      <span className="block tabular-nums text-[var(--viz-ink-2)]">{l.setsLogged} sets · Lift</span>
    </button>
  );
}

/** The week column: fitness, fatigue and form at the end of the week, then done / planned totals and time per sport. */
function WeekColumn({ s, monday, today }: { s: WeekSummary | null; monday: string; today: string }) {
  const mode = weekColumnMode(s, today);
  if (!s || mode === 'empty') {
    return (
      <div className="border-l bg-[var(--viz-surface)] px-2 py-1.5 text-[11px] text-[var(--viz-muted)]">
        {monday > today ? 'No plan' : ''}
      </div>
    );
  }
  if (mode === 'planned') {
    return (
      <div className="flex min-w-0 flex-col gap-1.5 overflow-hidden border-l bg-[var(--viz-surface)] px-2 py-1.5 text-[11px] leading-4" aria-label={`Week of ${shortDate(monday)}, planned`}>
        <div className="text-[9px] font-semibold uppercase tracking-wider text-[var(--viz-muted)]">Planned</div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 tabular-nums">
          <dt className="text-[var(--viz-muted)]">Time</dt>
          <dd className="text-right text-[var(--viz-ink)]">{hm(s.planned.min)}</dd>
          {s.planned.tss > 0 && (<><dt className="text-[var(--viz-muted)]">TSS</dt><dd className="text-right text-[var(--viz-ink)]">{s.planned.tss}</dd></>)}
          <dt className="text-[var(--viz-muted)]">Workouts</dt>
          <dd className="text-right text-[var(--viz-ink)]">{s.planned.count}</dd>
        </dl>
      </div>
    );
  }
  const f = s.fitness;
  const sports = Object.entries(s.done.bySport).filter(([, m]) => m > 0).sort((a, b) => b[1] - a[1]);
  const load: [string, string, string, string][] = [
    ['Fitness (CTL)', 'Fit', f ? String(Math.round(f.ctl)) : '–', 'var(--viz-ctl)'],
    ['Fatigue (ATL)', 'Fat', f ? String(Math.round(f.atl)) : '–', 'var(--viz-atl)'],
    ['Form (TSB)', 'Form', f ? `${f.tsb > 0 ? '+' : ''}${Math.round(f.tsb)}` : '–', 'var(--viz-tsb)'],
  ];
  const row = (label: string, value: string, planned?: string | null) => (
    <>
      <dt className="text-[var(--viz-muted)]">{label}</dt>
      <dd className="text-right text-[var(--viz-ink)]">
        {value}
        {planned && <span className="text-[var(--viz-muted)]"> / {planned}</span>}
      </dd>
    </>
  );
  return (
    <div className="flex min-w-0 flex-col gap-1.5 overflow-hidden border-l bg-[var(--viz-surface)] px-2 py-1.5 text-[11px] leading-4" aria-label={`Week of ${shortDate(monday)}`}>
      {f && <div className="grid grid-cols-3 gap-1" title={`On ${shortDate(f.date)}`}>
        {load.map(([full, short, value, color]) => (
          <div key={short} title={full} className="min-w-0">
            <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--viz-muted)]">
              <span className="h-0.5 w-2 shrink-0 rounded-full" style={{ background: color }} />
              {short}
            </div>
            <div className="font-semibold tabular-nums text-[var(--viz-ink)]">{value}</div>
          </div>
        ))}
      </div>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 tabular-nums" title="Done / planned">
        {row('Time', hm(s.done.min), s.planned.min ? hm(s.planned.min) : null)}
        {row('TSS', String(s.done.tss), s.planned.tss ? String(s.planned.tss) : null)}
        {s.done.km > 0 && row('Dist', `${s.done.km} km`)}
        {s.planned.count > 0 && row('Done', `${s.planned.done}/${s.planned.count}`)}
      </dl>
      {(sports.length > 0 || s.done.liftSessions > 0) && (
        <ul className="mt-auto flex flex-wrap gap-x-2 gap-y-0.5 tabular-nums text-[var(--viz-ink)]">
          {sports.map(([id, m]) => (
            <li key={id} className="inline-flex items-center gap-0.5" title={sport(id).label}>
              <SportIcon id={id} className="h-3 w-3" />
              <span className="sr-only">{sport(id).label}</span>
              {hm(m)}
            </li>
          ))}
          {s.done.liftSessions > 0 && (
            <li className="inline-flex items-center gap-0.5" title="Lift sessions">
              <Dumbbell aria-hidden className="h-3 w-3" style={{ color: sport('strength').color }} />
              {s.done.liftSessions}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Agenda (phones)

const AgendaWeek = memo(function AgendaWeek({
  week, today, weather, clip, h,
}: {
  week: WeekRow;
  clip: string | null;
  today: string;
  weather: Record<string, DayWeather>;
  h: Handlers;
}) {
  const weatherUntil = addDays(today, 14);
  const s = week.summary;
  const days = week.days.filter((d) => d.items.length > 0 || d.date === today || (d.date >= today && d.date <= weatherUntil && weather[d.date]));
  return (
    <section data-week={week.monday} className="plan-agenda-week overflow-hidden rounded-lg border bg-background">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b bg-[var(--viz-surface)] px-3 py-2">
        <span className="text-sm font-semibold text-[var(--viz-ink)]">Week of {shortDate(week.monday)}</span>
        {s && weekColumnMode(s, today) === 'empty' && week.monday > today && <span className="text-[11px] text-[var(--viz-muted)]">No plan</span>}
        {s && weekColumnMode(s, today) !== 'empty' && (
          <span className="flex flex-wrap gap-x-3 text-[11px] tabular-nums">
            <span><span className="text-[var(--viz-muted)]">Time </span><span className="text-[var(--viz-ink)]">{hm(s.done.min)}{s.planned.min ? ` / ${hm(s.planned.min)}` : ''}</span></span>
            <span><span className="text-[var(--viz-muted)]">TSS </span><span className="text-[var(--viz-ink)]">{s.done.tss}{s.planned.tss ? ` / ${s.planned.tss}` : ''}</span></span>
            {s.fitness && (
              <span title="Form (TSB) at the end of the week">
                <span className="text-[var(--viz-muted)]">Form </span>
                <span className="text-[var(--viz-ink)]">{s.fitness.tsb > 0 ? '+' : ''}{Math.round(s.fitness.tsb)}</span>
              </span>
            )}
          </span>
        )}
      </header>
      {days.length === 0 ? (
        <p className="px-3 py-3 text-xs text-[var(--viz-muted)]">Nothing this week.</p>
      ) : (
        <ul className="divide-y">
          {days.map((day) => {
            const d = day.date;
            const past = d < today;
            const isToday = d === today;
            const wx = d >= today && d <= weatherUntil ? weather[d] : undefined;
            return (
              <li key={d} className={cn('flex gap-3 px-3 py-2', past && 'bg-muted/30', isToday && 'bg-primary/[0.05]')}>
                <div className="w-9 shrink-0 text-center">
                  <span className={cn('block text-[10px] font-semibold uppercase tracking-wide', isToday ? 'text-primary' : 'text-[var(--viz-muted)]')}>
                    {isToday ? 'Today' : weekday(d)}
                  </span>
                  <span
                    className={cn(
                      'mx-auto grid h-7 w-7 place-items-center rounded-full text-sm font-semibold tabular-nums',
                      isToday ? 'bg-primary text-primary-foreground' : past ? 'text-[var(--viz-muted)]' : 'text-[var(--viz-ink)]'
                    )}
                  >
                    {Number(d.slice(8))}
                  </span>
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="group/day flex items-center justify-end gap-1">
                    {wx && <WeatherBadge w={wx} date={d} />}
                    <button
                      type="button"
                      onClick={() => h.day(d, 'add')}
                      aria-label={`Add a workout on ${longDate(d)}`}
                      className="grid h-8 w-8 place-items-center rounded-md text-[var(--viz-muted)] hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Plus aria-hidden className="h-4 w-4" />
                    </button>
                    <span className="[&>button]:opacity-100"><DayMenu d={d} day={day} clip={clip} h={h} /></span>
                  </div>
                  {day.items.map((item) => <Chip key={item.key} item={item} h={h} roomy />)}
                  {day.items.length === 0 && <p className="py-1 text-xs text-[var(--viz-muted)]">Nothing planned</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
});
