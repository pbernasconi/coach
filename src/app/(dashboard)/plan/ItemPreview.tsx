'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Dumbbell, X } from 'lucide-react';
import SportIcon from '@/components/SportIcon';
import { sport } from '@/lib/sports';
import { plainTitle } from '@/lib/plan/calendar.mjs';
import { dur } from '@/lib/plan/cells.mjs';
import type { CalendarActivity, CalendarLift, CalendarWorkout } from '@/lib/plan/month';

export type Item =
  | { kind: 'planned'; key: string; w: CalendarWorkout; actual: CalendarActivity | null }
  | { kind: 'activity'; key: string; a: CalendarActivity }
  | { kind: 'lift'; key: string; l: CalendarLift; a: CalendarActivity | null };

/** What the preview shows: one calendar item, or all the items of a day ("+N more"). */
export type PreviewTarget = { kind: 'item'; key: string } | { kind: 'day'; date: string };

export type PreviewActions = {
  move: (id: string, date: string) => void;
  skip: (w: CalendarWorkout) => void;
  remove: (id: string) => void;
  open: (target: PreviewTarget, anchor: HTMLElement) => void;
};

const W = 352; // the popover width (px), w-[22rem]
const GAP = 8;

export const liftHref = (id: string) => `/lift/sessions/${encodeURIComponent(id)}`;

/**
 * The "+N more" list of a day, next to the clicked button. A click on an item opens the item modal.
 * Escape, a click outside or a scroll of the calendar closes it.
 */
export default function ItemPreview({
  anchor, items, title, onClose, actions, scroller,
}: {
  anchor: HTMLElement;
  items: Item[];
  /** The day heading. */
  title: string;
  onClose: () => void;
  actions: PreviewActions;
  scroller: HTMLElement | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // Place it right of the chip, else left of it, else under it; keep it inside the window.
  useLayoutEffect(() => {
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const h = ref.current?.offsetHeight ?? 300;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(W, vw - 2 * GAP);
      let left = r.right + GAP;
      let top = r.top;
      if (left + width > vw - GAP) left = r.left - GAP - width;
      if (left < GAP) {
        left = Math.min(Math.max(GAP, r.left), vw - GAP - width);
        top = r.bottom + GAP;
      }
      top = Math.max(GAP, Math.min(top, vh - GAP - h));
      setPos({ left, top });
    };
    place();
    const ro = new ResizeObserver(place);
    if (ref.current) ro.observe(ref.current);
    window.addEventListener('resize', place);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', place);
    };
  }, [anchor, items]);

  useEffect(() => {
    const down = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !anchor.contains(t)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose();
    };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    scroller?.addEventListener('scroll', onClose, { passive: true });
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key);
      scroller?.removeEventListener('scroll', onClose);
    };
  }, [anchor, onClose, scroller]);

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={title}
      tabIndex={-1}
      className="fixed z-50 max-h-[min(36rem,calc(100dvh-1rem))] w-[22rem] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-xl border bg-background text-sm shadow-2xl outline-none"
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: 0 }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-2 top-2 rounded-md p-1 text-[var(--viz-muted)] hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X aria-hidden className="h-4 w-4" />
      </button>
      <div className="space-y-2 p-4">
          <h2 className="pr-6 font-semibold text-[var(--viz-ink)]">{title}</h2>
          <ul className="space-y-1.5">
            {items.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={(e) => actions.open({ kind: 'item', key: item.key }, e.currentTarget)}
                  className="flex w-full items-center gap-2 rounded-md border border-l-[3px] px-2 py-1.5 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={{ borderLeftColor: sport(itemSport(item)).color }}
                >
                  <ItemIcon item={item} />
                  <span className="min-w-0 flex-1 truncate font-medium text-[var(--viz-ink)]">{itemName(item)}</span>
                  <span className="shrink-0 text-xs tabular-nums text-[var(--viz-ink-2)]">{itemLine(item)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
    </div>,
    document.body
  );
}

const itemSport = (item: Item) => (item.kind === 'planned' ? item.w.sport : item.kind === 'activity' ? item.a.sport : 'strength');
const itemName = (item: Item) =>
  item.kind === 'planned' ? plainTitle(item.w.title) : item.kind === 'activity' ? item.a.name || sport(item.a.sport).label : item.l.name;
const itemLine = (item: Item) => {
  if (item.kind === 'lift') return [item.a && dur(item.a.min), `${item.l.setsLogged} sets`].filter(Boolean).join(' · ');
  if (item.kind === 'activity') return dur(item.a.min);
  return item.w.duration ? dur(item.w.duration) : '';
};

function ItemIcon({ item }: { item: Item }) {
  if (item.kind === 'lift') return <Dumbbell aria-hidden className="h-3.5 w-3.5 shrink-0" style={{ color: sport('strength').color }} />;
  return <SportIcon id={itemSport(item)} className="h-3.5 w-3.5" />;
}
