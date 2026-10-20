'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Dumbbell, X } from 'lucide-react';
import SportIcon from '@/components/SportIcon';
import ComplianceMark from '@/components/plan/ComplianceMark';
import RemoveWorkout from '@/components/plan/RemoveWorkout';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { sport } from '@/lib/sports';
import { plainTitle } from '@/lib/plan/calendar.mjs';
import { dur } from '@/lib/plan/cells.mjs';
import type { CalendarActivity, CalendarLift, CalendarWorkout } from '@/lib/plan/month';

export type Item =
  | { kind: 'planned'; key: string; w: CalendarWorkout; actual: CalendarActivity | null }
  | { kind: 'activity'; key: string; a: CalendarActivity }
  | { kind: 'lift'; key: string; l: CalendarLift };

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

const longDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });

export const liftHref = (id: string) => `/lift/sessions/${encodeURIComponent(id)}`;

/** Where a done item opens in full: the activity page or the Lift session page. Null when there is no page. */
export function detailHref(item: Item): { href: string; label: string } | null {
  if (item.kind === 'activity') return { href: item.a.url, label: 'Open activity' };
  if (item.kind === 'lift') return { href: liftHref(item.l.id), label: 'Open session' };
  const m = item.w.match;
  if (item.actual) return { href: item.actual.url, label: 'Open activity' };
  if (m?.source === 'strava') return { href: `/activities/${m.id}`, label: 'Open activity' };
  if (m?.source === 'lift') return { href: liftHref(m.id), label: 'Open session' };
  return null;
}

/**
 * A preview card next to the clicked chip. It shows the main numbers, and a button opens the full page.
 * Escape, a click outside or a scroll of the calendar closes it.
 */
export default function ItemPreview({
  anchor, items, title, onClose, actions, disabled, scroller,
}: {
  anchor: HTMLElement;
  /** One item, or the items of a day. */
  items: Item[];
  /** The day heading for a day list. */
  title?: string;
  onClose: () => void;
  actions: PreviewActions;
  disabled: boolean;
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

  const one = items.length === 1 && !title ? items[0] : null;
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={one ? itemName(one) : title}
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
      {one ? (
        <ItemBody item={one} actions={actions} disabled={disabled} />
      ) : (
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
      )}
    </div>,
    document.body
  );
}

const itemSport = (item: Item) => (item.kind === 'planned' ? item.w.sport : item.kind === 'activity' ? item.a.sport : 'strength');
const itemName = (item: Item) =>
  item.kind === 'planned' ? plainTitle(item.w.title) : item.kind === 'activity' ? item.a.name || sport(item.a.sport).label : item.l.name;
const itemLine = (item: Item) => {
  if (item.kind === 'lift') return `${item.l.setsLogged} sets`;
  if (item.kind === 'activity') return dur(item.a.min);
  return item.w.duration ? dur(item.w.duration) : '';
};

function ItemIcon({ item }: { item: Item }) {
  if (item.kind === 'lift') return <Dumbbell aria-hidden className="h-3.5 w-3.5 shrink-0" style={{ color: sport('strength').color }} />;
  return <SportIcon id={itemSport(item)} className="h-3.5 w-3.5" />;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-[var(--viz-muted)]">{label}</dt>
      <dd className="truncate text-base font-semibold tabular-nums text-[var(--viz-ink)]">
        {value}
        {sub && <span className="ml-1 text-xs font-normal text-[var(--viz-muted)]">{sub}</span>}
      </dd>
    </div>
  );
}

/** Pace (min/km) for runs, walks and hikes; speed (km/h) for rides. */
function paceOrSpeed(sportId: string, km: number, min: number): [string, string] | null {
  if (!km || !min) return null;
  if (sportId === 'ride') return ['Speed', `${(km / (min / 60)).toFixed(1)} km/h`];
  if (sportId === 'run' || sportId === 'walk' || sportId === 'hike') {
    const p = min / km;
    const s = Math.round((p % 1) * 60);
    return ['Pace', `${Math.floor(p) + (s === 60 ? 1 : 0)}:${String(s === 60 ? 0 : s).padStart(2, '0')} /km`];
  }
  return null;
}

function ItemBody({ item, actions, disabled }: { item: Item; actions: PreviewActions; disabled: boolean }) {
  const detail = detailHref(item);
  const head = (date: string, extra?: string | null) => (
    <header className="space-y-1 pr-6">
      <p className="flex items-center gap-1.5 text-xs text-[var(--viz-muted)]">
        <ItemIcon item={item} />
        {sport(itemSport(item)).label} · {longDate(date)}
        {extra && <> · {extra}</>}
      </p>
      <h2 className="text-base font-semibold leading-snug text-[var(--viz-ink)]">{itemName(item)}</h2>
    </header>
  );
  const open = detail && (
    <Button asChild className="w-full">
      <Link href={detail.href}>
        {detail.label} <ArrowRight aria-hidden className="ml-1 h-4 w-4" />
      </Link>
    </Button>
  );

  if (item.kind === 'activity') {
    const a = item.a;
    const ps = paceOrSpeed(a.sport, a.km, a.min);
    return (
      <div className="space-y-4 p-4">
        {head(a.date, a.commute ? 'Commute' : null)}
        <dl className="grid grid-cols-3 gap-3">
          <Stat label="Time" value={dur(a.min)} />
          {a.km >= 0.5 && <Stat label="Distance" value={`${a.km} km`} />}
          {a.tss != null && <Stat label="TSS" value={String(Math.round(a.tss))} />}
          {ps && <Stat label={ps[0]} value={ps[1]} />}
        </dl>
        <p className="text-xs text-[var(--viz-muted)]">Completed. Not in the plan.</p>
        {open}
      </div>
    );
  }

  if (item.kind === 'lift') {
    return (
      <div className="space-y-4 p-4">
        {head(item.l.date)}
        <dl className="grid grid-cols-3 gap-3">
          <Stat label="Sets logged" value={String(item.l.setsLogged)} />
        </dl>
        {open}
      </div>
    );
  }

  const { w, actual } = item;
  const editable = w.state !== 'done';
  const pct = w.compliance.ratio != null ? `${Math.round(w.compliance.ratio * 100)} % of planned ${w.compliance.basis === 'tss' ? 'TSS' : 'time'}` : null;
  return (
    <div className="space-y-4 p-4">
      {head(w.date, w.startTime)}
      <div className="flex items-center gap-1.5 text-xs">
        <ComplianceMark level={w.compliance.level} showLabel />
        {pct && <span className="text-[var(--viz-muted)]">· {pct}</span>}
      </div>
      <dl className="grid grid-cols-3 gap-3">
        <Stat label="Time" value={actual ? dur(actual.min) : w.duration ? dur(w.duration) : '–'} sub={actual && w.duration ? `/ ${dur(w.duration)}` : null} />
        {(w.tss || actual?.tss) && (
          <Stat
            label="TSS"
            value={actual?.tss != null ? String(Math.round(actual.tss)) : String(Math.round(w.tss ?? 0))}
            sub={actual?.tss != null && w.tss ? `/ ${Math.round(w.tss)}` : null}
          />
        )}
        {actual && actual.km >= 0.5 && <Stat label="Distance" value={`${actual.km} km`} />}
      </dl>
      {w.intensity && <p className="text-xs text-[var(--viz-ink-2)]">Intensity: {w.intensity}</p>}
      {w.match && (
        <p className="text-xs text-[var(--viz-ink-2)]">
          Done as {w.match.source === 'lift' ? 'Lift session' : 'activity'}: <span className="font-medium text-[var(--viz-ink)]">{w.match.name}</span>
        </p>
      )}
      {w.description && (
        <div className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs leading-relaxed text-[var(--viz-ink)]">
          {w.description}
        </div>
      )}
      {w.why && <p className="text-xs text-[var(--viz-muted)]">Why: {w.why}</p>}
      {w.adaptedFrom && <p className="text-xs text-[var(--plan-partial)]">Changed for how you feel.</p>}
      {open}
      {editable && (
        <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-xs">
          <label className="flex items-center gap-1.5 text-[var(--viz-ink-2)]">
            Move to
            <input
              type="date"
              value={w.date}
              disabled={disabled}
              onChange={(e) => e.target.value && actions.move(w.id, e.target.value)}
              className="h-8 rounded-md border bg-background px-2 text-xs"
            />
          </label>
          <Button size="sm" variant="outline" className={cn('h-8')} disabled={disabled} onClick={() => actions.skip(w)}>
            {w.status === 'skipped' ? 'Unskip' : 'Skip'}
          </Button>
          <RemoveWorkout
            workout={{ title: plainTitle(w.title), date: w.date, state: w.state, imported: w.imported }}
            onRemove={() => actions.remove(w.id)}
            disabled={disabled}
            className="ml-auto"
          />
        </div>
      )}
    </div>
  );
}
