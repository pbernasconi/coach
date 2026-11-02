'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { DraftEvent } from '@/lib/plan/planner-week';
import type { CalendarBlock } from '@/lib/plan/planning-context';
import { clock, dayNum, days, hm, minutesOf, sportStyle, weekday } from './plannerUi';

/** The grid runs 5:00 to 23:00, at least 44 px an hour and taller to fill the screen; a drag snaps to 15 minutes. */
const H0 = 5;
const H1 = 23;
const MIN_HOUR = 44;
const SNAP = 15;

type Drag = { index: number; x0: number; y0: number; dx: number; dy: number; moved: boolean };

/**
 * The draft week over Paolo's calendar: grey blocks are his events, coloured cards are Coach's sessions. Drag a
 * session to another time or day (onMove), click it for its details (onSelect).
 */
export default function WeekGrid({
  weekStart, events, calendar, selected, changed, today, onSelect, onMove,
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
  const timed = events.filter((e) => e.start && e.minutes);
  const untimed = events.filter((e) => !e.start || !e.minutes);
  // Days off are marked only once there is a draft.
  const drafted = events.length > 0;

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
      <div className="sticky top-0 z-20 grid grid-cols-[48px_repeat(7,minmax(0,1fr))] border-b bg-background/95 backdrop-blur">
        <span />
        {week.map((d) => {
          const total = events.filter((e) => e.date === d).reduce((n, e) => n + (e.minutes ?? 0), 0);
          return (
            <div key={d} className="flex items-baseline justify-between px-2 py-2">
              <span className={cn('text-sm font-semibold', d === today && 'text-brand-ink')}>
                {weekday(d)} {dayNum(d)}
              </span>
              {drafted && <span className={cn('text-xs', total ? 'text-muted-foreground' : 'font-medium text-brand-ink')}>{total ? hm(total) : 'Off'}</span>}
            </div>
          );
        })}
      </div>
      {untimed.length > 0 && (
        <div className="grid grid-cols-[48px_repeat(7,minmax(0,1fr))] border-b py-1">
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
      <div className="grid grid-cols-[48px_minmax(0,1fr)]">
        <div className="relative" style={{ height: (H1 - H0) * HOUR }}>
          {Array.from({ length: H1 - H0 }, (_, i) => (
            <span key={i} className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-muted-foreground" style={{ top: i * HOUR }}>
              {i ? `${H0 + i}:00` : ''}
            </span>
          ))}
        </div>
        <div ref={cols} className="relative grid grid-cols-7 border-l" style={{ height: (H1 - H0) * HOUR }}>
          {Array.from({ length: H1 - H0 }, (_, i) => (
            <div key={i} className="pointer-events-none absolute inset-x-0 border-t border-border/60" style={{ top: i * HOUR }} />
          ))}
          {week.map((d) => {
            const off = drafted && !events.some((e) => e.date === d);
            return (
              <div key={d} className="relative border-r border-border/60"
                style={off ? { backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 7px, var(--color-border) 7px 8px)' } : undefined}>
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
                {calendar.filter((c) => c.date === d && c.allDay).slice(0, 1).map((c, i) => (
                  <div key={`a${i}`} className="absolute inset-x-1 top-1 truncate rounded bg-muted px-1.5 text-[11px] text-muted-foreground">{c.title}</div>
                ))}
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
