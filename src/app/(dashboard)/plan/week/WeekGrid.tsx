'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { DraftEvent } from '@/lib/plan/planner-week';
import type { CalendarBlock, WeekWhere } from '@/lib/plan/planning-context';
import { convert } from '@/lib/plan/where.mjs';
import { clock, dayNum, days, hm, minutesOf, sportStyle, weekday } from './plannerUi';

type DayType = 'free' | 'busy' | 'travel' | 'rest' | 'sick';
const DAY_LABEL: Record<DayType, string> = { free: 'Free', busy: 'Busy', travel: 'Travel', rest: 'Rest', sick: 'Sick' };
/** The header badge and the column tint of each day type (rest and sick are also hatched). */
const DAY_STYLE: Record<DayType, { badge: string; column: string }> = {
  free: { badge: '', column: '' },
  busy: { badge: 'bg-sky-500/15 text-sky-800 dark:text-sky-300', column: 'bg-sky-500/5' },
  travel: { badge: 'bg-amber-500/15 text-amber-800 dark:text-amber-300', column: 'bg-amber-500/8' },
  rest: { badge: 'bg-muted text-muted-foreground', column: '' },
  sick: { badge: 'bg-rose-500/15 text-rose-800 dark:text-rose-300', column: 'bg-rose-500/5' },
};

/** The grid runs 5:00 to 23:00, at least 44 px an hour and taller to fill the screen; a drag snaps to 15 minutes. */
const H0 = 5;
const H1 = 23;
const MIN_HOUR = 44;
const SNAP = 15;
/** The hour labels' column, one per time zone of the week. */
const ZONE_COL = 46;

type Drag = { index: number; x0: number; y0: number; dx: number; dy: number; moved: boolean };

/**
 * The draft week over Paolo's calendar: grey blocks are his events, coloured cards are Coach's sessions. Drag a
 * session to another time or day (onMove), click it for its details (onSelect).
 */
export default function WeekGrid({
  weekStart, events, calendar, selected, changed, today, onSelect, onMove, windows, modes, notes, writing = false, where,
}: {
  weekStart: string;
  events: DraftEvent[];
  calendar: CalendarBlock[];
  selected: number | null;
  /** Sessions the last change touched, drawn dashed. */
  changed: Set<string>;
  today: string;
  onSelect: (index: number) => void;
  onMove: (index: number, date: string, time: string) => void;
  /** Free windows to draw, by day (the Your week step). */
  windows?: Record<string, { start: string; end: string }[]>;
  /** What each day is (the Your week step): busy, travelling, rest or sick are marked. */
  modes?: Record<string, DayType>;
  /** Paolo's note per day, shown with the all-day events. */
  notes?: Record<string, string>;
  /** Coach is still writing the draft: a day with no session yet is not a day off. */
  writing?: boolean;
  /** Where Paolo is each day: each day is drawn on its own clock, with a column of hours per zone of the week. */
  where?: WeekWhere;
}) {
  const cols = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [HOUR, setHour] = useState(MIN_HOUR);
  // Fill the space below the day headers: the scroll area's height, less what sits above the hour grid and its 24 px bottom padding.
  useEffect(() => {
    const box = root.current?.parentElement;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const fit = () => {
      const above = (cols.current?.getBoundingClientRect().top ?? 0) - (root.current?.getBoundingClientRect().top ?? 0);
      setHour(Math.max(MIN_HOUR, Math.floor((box.clientHeight - above - 24) / (H1 - H0))));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);
  const bottom = (H1 - H0) * HOUR;
  const week = days(weekStart);
  // Time zones, as Notion Calendar shows them: one column of hours per zone he is in this week. Each day runs on its
  // own clock; the columns convert the hours of the day under the pointer (today, or Monday, otherwise).
  const zones = where && where.zones.length > 1 ? where.zones : [];
  const zoneOfDay = (d: string) => where?.days.find((x) => x.date === d)?.tz ?? zones[0]?.tz ?? '';
  const [hover, setHover] = useState<string | null>(null);
  const focus = hover ?? (week.includes(today) ? today : week[0]);
  const focusTz = zoneOfDay(focus);
  const gutter = zones.length ? zones.length * ZONE_COL : 48;
  const columns = { gridTemplateColumns: `${gutter}px repeat(7, minmax(0, 1fr))` };
  const placeOf = (d: string) => where?.days.find((x) => x.date === d);
  /** The hour labels of one zone column: the focused day's hours on that zone's clock. */
  const hourLabel = (i: number, tz: string) => {
    const h = `${String(H0 + i).padStart(2, '0')}:00`;
    if (!tz || tz === focusTz) return `${H0 + i}:00`;
    const at = convert(focus, h, focusTz, tz);
    const shift = at.date === focus ? '' : at.date > focus ? '⁺¹' : '⁻¹';
    return `${Number(at.time.slice(0, 2))}:${at.time.slice(3, 5)}${shift}`;
  };
  const timed = events.filter((e) => e.start && e.minutes);
  const untimed = events.filter((e) => !e.start || !e.minutes);
  // Days off are marked only once there is a draft.
  const drafted = events.length > 0;
  const allDay = calendar.filter((c) => c.allDay);

  const finish = (e: DraftEvent, d: Drag) => {
    if (!d.moved) return onSelect(e.index);
    const width = (cols.current?.clientWidth ?? 700) / 7;
    const col = Math.min(6, Math.max(0, week.indexOf(e.date) + Math.round(d.dx / width)));
    const start = minutesOf(e.start!) + (d.dy / HOUR) * 60;
    const snapped = Math.min((H1 * 60) - (e.minutes ?? 60), Math.max(H0 * 60, Math.round(start / SNAP) * SNAP));
    const time = `${String(Math.floor(snapped / 60)).padStart(2, '0')}:${String(snapped % 60).padStart(2, '0')}`;
    if (week[col] !== e.date || time !== e.start) onMove(e.index, week[col], time);
  };

  return (
    <div ref={root} className="flex min-w-[760px] flex-col">
      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
      <div className="grid" style={columns}>
        {zones.length ? (
          <div className="flex items-end pb-2">
            {zones.map((z) => (
              <span key={z.tz} title={z.tz.replace(/_/g, ' ')}
                className={cn('truncate pr-2 text-right text-[11px] font-semibold', z.tz === focusTz ? 'text-foreground' : 'text-muted-foreground')}
                style={{ width: ZONE_COL }}>
                {z.short}
              </span>
            ))}
          </div>
        ) : <span />}
        {week.map((d) => {
          const total = events.filter((e) => e.date === d).reduce((n, e) => n + (e.minutes ?? 0), 0);
          const place = zones.length ? placeOf(d) : undefined;
          return (
            <div key={d} className={cn('flex min-w-0 flex-wrap items-baseline justify-between gap-x-1 px-2 py-2', zones.length && d === focus && hover && 'bg-muted/50')}>
              <span className={cn('text-sm font-semibold whitespace-nowrap', d === today && 'text-brand-ink')}>
                {weekday(d)} {dayNum(d)}
              </span>
              {drafted && (total || !writing) && <span className={cn('text-xs', total ? 'text-muted-foreground' : 'font-medium text-brand-ink')}>{total ? hm(total) : 'Off'}</span>}
              {!drafted && modes?.[d] && modes[d] !== 'free' && (
                <span className={cn('min-w-0 truncate rounded-full px-2 text-[11px] font-semibold', DAY_STYLE[modes[d]].badge)}>
                  {DAY_LABEL[modes[d]]}
                </span>
              )}
              {place && (
                <span title={`${place.label} · ${place.tz.replace(/_/g, ' ')}`}
                  className={cn('basis-full truncate text-[11px] font-medium', place.home ? 'text-muted-foreground' : 'text-sky-700 dark:text-sky-300')}>
                  {place.travel ? '✈ ' : ''}{place.short}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {/* All-day events and Paolo's notes sit above the hours, as in Google Calendar. */}
      {(allDay.length > 0 || week.some((d) => notes?.[d])) && (
        <div className="grid border-t border-border/60 py-1" style={columns}>
          <span className="self-start pt-0.5 pr-2 text-right text-[11px] text-muted-foreground">All day</span>
          {week.map((d) => (
            <div key={d} className="flex min-w-0 flex-col gap-0.5 px-1">
              {allDay.filter((c) => c.date === d).map((c, i) => (
                <span key={i} title={c.title} className="truncate rounded bg-amber-500/15 px-1.5 py-px text-[11px] font-medium text-amber-900 dark:text-amber-200">{c.title}</span>
              ))}
              {notes?.[d] && (
                <span title={notes[d]} className="truncate rounded border border-dashed border-brand/50 px-1.5 text-[11px] text-brand-ink">{notes[d]}</span>
              )}
            </div>
          ))}
        </div>
      )}
      </div>
      {untimed.length > 0 && (
        <div className="grid border-b py-1" style={columns}>
          <span className="self-center pr-2 text-right text-[11px] text-muted-foreground">Any time</span>
          {week.map((d) => (
            <div key={d} className="flex flex-col gap-1 px-1">
              {untimed.filter((e) => e.date === d).map((e) => (
                <button key={e.index} type="button" onClick={() => onSelect(e.index)} style={sportStyle(e)}
                  className={cn('truncate rounded-md border-l-[3px] px-2 py-1 text-left text-xs font-semibold', selected === e.index && 'ring-2 ring-ring')}>
                  {e.title}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="grid" style={{ gridTemplateColumns: `${gutter}px minmax(0, 1fr)` }}>
        <div className="flex">
          {(zones.length ? zones : [{ tz: '', short: '' }]).map((z) => (
            <div key={z.tz || 'local'} className="relative" style={{ height: (H1 - H0) * HOUR, width: zones.length ? ZONE_COL : 48 }}>
              {Array.from({ length: H1 - H0 }, (_, i) => (
                <span key={i} className={cn('absolute right-2 -translate-y-1/2 text-[11px] tabular-nums whitespace-nowrap',
                  zones.length && z.tz === focusTz ? 'font-medium text-foreground/80' : 'text-muted-foreground')} style={{ top: i * HOUR }}>
                  {i ? hourLabel(i, z.tz) : ''}
                </span>
              ))}
            </div>
          ))}
        </div>
        <div ref={cols} className="relative grid grid-cols-7 border-l" style={{ height: (H1 - H0) * HOUR }}
          onPointerMove={zones.length ? (ev) => {
            const box = cols.current?.getBoundingClientRect();
            if (!box) return;
            const i = Math.min(6, Math.max(0, Math.floor(((ev.clientX - box.left) / box.width) * 7)));
            if (week[i] !== hover) setHover(week[i]);
          } : undefined}
          onPointerLeave={zones.length ? () => setHover(null) : undefined}>
          {Array.from({ length: H1 - H0 }, (_, i) => (
            <div key={i} className="pointer-events-none absolute inset-x-0 border-t border-border/60" style={{ top: i * HOUR }} />
          ))}
          {week.map((d) => {
            const mode = modes?.[d];
            const off = (drafted && !writing && !events.some((e) => e.date === d)) || mode === 'rest' || mode === 'sick';
            return (
              <div key={d} className={cn('relative border-r border-border/60', mode && DAY_STYLE[mode].column,
                zones.length > 0 && week.indexOf(d) > 0 && zoneOfDay(d) !== zoneOfDay(week[week.indexOf(d) - 1]) && 'border-l-2 border-l-sky-500/40')}
                style={off ? { backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 7px, var(--color-border) 7px 8px)' } : undefined}>
                {(mode === 'free' || mode === 'busy') && (windows?.[d] ?? []).map((w) => {
                  const top = ((minutesOf(w.start) - H0 * 60) / 60) * HOUR;
                  const height = ((minutesOf(w.end) - minutesOf(w.start)) / 60) * HOUR;
                  return (
                    <div key={w.start} className="pointer-events-none absolute inset-x-1 rounded-md border-[1.5px] border-dashed border-emerald-600/60 bg-emerald-500/6 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-400/50 dark:text-emerald-300"
                      style={{ top: top + 1, height: height - 2 }}>
                      Free {clock(w.start)}–{clock(w.end)}
                    </div>
                  );
                })}
                {calendar.filter((c) => c.date === d && !c.allDay && c.start).map((c, i) => {
                  const top = ((minutesOf(c.start!) - H0 * 60) / 60) * HOUR;
                  if (top + (c.minutes / 60) * HOUR < 0 || top > (H1 - H0) * HOUR) return null;
                  return (
                    <div key={i} title={`${clock(c.start)} ${c.title}`}
                      className="absolute inset-x-1 overflow-hidden rounded-md bg-muted px-1.5 py-0.5 text-[11px] leading-tight text-muted-foreground"
                      style={{ top: Math.max(0, top) + 1, height: Math.max(14, Math.min(top + (c.minutes / 60) * HOUR, bottom) - Math.max(0, top) - 2) }}>
                      {c.title}
                    </div>
                  );
                })}
                {timed.filter((e) => e.date === d).map((e) => {
                  const dragging = drag?.index === e.index ? drag : null;
                  const top = ((minutesOf(e.start!) - H0 * 60) / 60) * HOUR;
                  const height = Math.max(20, Math.min(((e.minutes ?? 30) / 60) * HOUR, bottom - top) - 2);
                  const small = height < 34;
                  return (
                    <button
                      key={e.index}
                      type="button"
                      aria-label={`${e.title}, ${weekday(e.date)} ${clock(e.start)}, ${hm(e.minutes)}. Drag to move.`}
                      style={{
                        ...sportStyle(e),
                        top: top + 1,
                        height,
                        transform: dragging ? `translate(${dragging.dx}px, ${dragging.dy}px)` : undefined,
                        zIndex: dragging ? 30 : 10,
                      }}
                      className={cn(
                        'absolute inset-x-1 cursor-grab touch-none overflow-hidden rounded-md border-l-[3px] px-1.5 text-left',
                        small ? 'py-0' : 'py-1',
                        selected === e.index && 'ring-2 ring-ring',
                        changed.has(`${e.date}|${e.title}`) && 'outline-dashed outline-[1.5px] outline-offset-[-1px]',
                        dragging?.moved && 'cursor-grabbing shadow-lg',
                      )}
                      onPointerDown={(ev) => {
                        ev.currentTarget.setPointerCapture(ev.pointerId);
                        setDrag({ index: e.index, x0: ev.clientX, y0: ev.clientY, dx: 0, dy: 0, moved: false });
                      }}
                      onPointerMove={(ev) => {
                        if (!dragging) return;
                        const dx = ev.clientX - dragging.x0;
                        const dy = ev.clientY - dragging.y0;
                        setDrag({ ...dragging, dx, dy, moved: dragging.moved || Math.abs(dx) + Math.abs(dy) > 4 });
                      }}
                      onPointerUp={() => {
                        if (dragging) finish(e, dragging);
                        setDrag(null);
                      }}
                      onPointerCancel={() => setDrag(null)}
                    >
                      <span className={cn('flex items-center gap-1 truncate font-semibold', small ? 'text-[11px] leading-[18px]' : 'text-xs')}>
                        <span className="truncate">{e.title}</span>
                        {e.hard && <span className="shrink-0 rounded bg-rose-600 px-1 text-[9px] font-bold leading-[14px] text-white">HARD</span>}
                      </span>
                      {!small && <span className="block truncate text-[11px] opacity-80">{clock(e.start)} · {hm(e.minutes)}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
