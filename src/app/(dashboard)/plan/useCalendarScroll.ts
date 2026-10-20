'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  chunkAfter, chunkBefore, chunkToReach, earliestBound, mergeRange, monthOfWeek, withTimeout,
} from '@/lib/plan/scroll.mjs';
import type { CalendarRange, DataBounds } from '@/lib/plan/month';
import { loadWeeksAction } from './actions';

/** Start the next load when the view is this close (px) to the top or bottom of the loaded weeks: about 10 rows. */
const EDGE_PX = 1500;
const HEAD_PX = 32; // the sticky weekday header (grid) and month heading (agenda): h-8
/** A load that has not answered after this long counts as failed (it shows Retry, not a skeleton forever). */
const LOAD_TIMEOUT_MS = 15_000;
/** After a failed load, scrolling retries it, at most this often. */
const RETRY_AFTER_MS = 4_000;

export const fetchWeeks = (from: string, to: string) => withTimeout(loadWeeksAction(from, to), LOAD_TIMEOUT_MS, 'Loading weeks') as Promise<CalendarRange>;

/**
 * The continuous scroll of the calendar: the loaded weeks, the loads at the top and the bottom, the snap, the
 * title that follows the top week, and goTo (a jump to a week).
 */
export function useCalendarScroll({ openAt, range, bounds }: { openAt: string; range: CalendarRange; bounds: DataBounds }) {
  const [data, setData] = useState<CalendarRange>(range);
  const [loading, setLoading] = useState<'before' | 'after' | null>(null);
  const [month, setMonth] = useState(() => monthOfWeek(openAt));
  const [failed, setFailed] = useState<{ before: number | null; after: number | null }>({ before: null, after: null });
  const [height, setHeight] = useState<number | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const agendaRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const loadingRef = useRef(false);
  const monthRef = useRef(month);
  // The first loaded week and its position, to keep the view still when weeks are added above it.
  const firstRow = useRef<{ monday: string; top: number } | null>(null);
  // A week to scroll to once it is on the page (the first render, the arrows, Today).
  const scrollTarget = useRef<{ monday: string; smooth: boolean } | null>({ monday: openAt, smooth: false });
  const failedRef = useRef(failed);
  failedRef.current = failed;
  const jumping = useRef(false);
  const snapTimer = useRef(0);
  const first = data.weeks[0];

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

  return { data, setData, dataRef, loading, month, failed, height, scrollerRef, gridRef, agendaRef, topRef, bottomRef, first, retry, onScroll, goTo };
}
