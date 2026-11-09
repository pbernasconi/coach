'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { DraftEvent } from '@/lib/plan/planner-week';
import type { CalendarBlock, WeekWhere } from '@/lib/plan/planning-context';
import { convert, instantOf } from '@/lib/plan/where.mjs';
import { addDays } from '@/lib/plan/week.mjs';
import { clock, dayNum, days, hm, minutesOf, sportStyle, timeOf, weekday } from './plannerUi';

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

/** One zone: the grid runs 5:00 to 23:00. A week in several zones runs the whole day (it opens at 6:00). At least
 * 44 px an hour, taller to fill the screen; a drag snaps to 15 minutes. */
const SPAN_ONE = [5, 23] as const;
const SPAN_ALL = [0, 24] as const;
const MIN_HOUR = 44;
const SNAP = 15;
/** The hour labels' column, one per time zone of the week. */
const ZONE_COL = 48;
/** Night where he is: 22:00 to 6:00 on that day's clock, shaded. */
const NIGHT = ['22:00', '06:00'] as const;

type Drag = { index: number; x0: number; y0: number; dx: number; dy: number; moved: boolean };
/** A block placed on the grid's clock: the view day, minutes from that day's midnight, and its length. */
type Spot = { date: string; from: number; to: number };

/**
 * The draft week over Paolo's calendar: grey blocks are his events, coloured cards are Coach's sessions. Drag a
 * session to another time or day (onMove), click it for its details (onSelect).
 *
 * Time zones work as in Notion Calendar: the whole grid runs on one clock, and on a trip week a column of hours per
 * zone he is in shows the same rows on each clock. Click a zone to run the grid on it. Sessions keep their local time
 * on their card ("7:00 NYC") when the grid shows another clock.
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
  /** Where Paolo is each day: times are on each day's local clock, and the grid can show any of the week's zones. */
  where?: WeekWhere;
}) {
  const cols = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [HOUR, setHour] = useState(MIN_HOUR);
  const week = days(weekStart);
  const zones = where && where.zones.length > 1 ? where.zones : [];
  const multi = zones.length > 0;
  const [H0, H1] = multi ? SPAN_ALL : SPAN_ONE;
  const homeTz = where?.zones[0]?.tz ?? '';
  const zoneOfDay = (d: string) => where?.days.find((x) => x.date === d)?.tz ?? (d < week[0] ? where?.days[0]?.tz : where?.days.at(-1)?.tz) ?? homeTz;
  const placeOf = (d: string) => where?.days.find((x) => x.date === d);
  // The grid's clock: the zone he's in today on this week, else on Monday; a click on a zone column changes it.
  const [picked, setPicked] = useState<string | null>(null);
  const viewTz = picked && zones.some((z) => z.tz === picked) ? picked : zoneOfDay(week.includes(today) ? today : week[0]);

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
  }, [H0, H1]);
  // A whole-day grid opens at 6:00 (again when the hour height settles).
  useEffect(() => {
    if (multi) root.current?.parentElement?.scrollTo({ top: (6 - H0) * HOUR - 12 });
  }, [multi, H0, HOUR]);
  const bottom = (H1 - H0) * HOUR;

  /** A local wall time of a day on the grid's clock. */
  const toView = (date: string, time: string) => (multi ? convert(date, time, zoneOfDay(date), viewTz) : { date, time });
  /** A local block on the grid, cut at the grid's midnight (a late NYC meeting seen on Zurich time runs into the next day). */
  const spots = (date: string, start: string, minutes: number): Spot[] => {
    const v = toView(date, start);
    const out: Spot[] = [];
    let d = v.date;
    let from = minutesOf(v.time);
    let left = Math.max(minutes, 0);
    for (let i = 0; i < 3 && (left > 0 || !out.length); i++) {
      const to = Math.min(1440, from + left);
      out.push({ date: d, from, to });
      left -= to - from;
      d = addDays(d, 1);
      from = 0;
    }
    return out.filter((s) => week.includes(s.date) && s.to > H0 * 60 && s.from < H1 * 60);
  };
  /** Nights where he is, as spots on the grid's clock. */
  const nights: Spot[] = [addDays(week[0], -1), ...week].flatMap((d) => {
    const tz = zoneOfDay(d);
    const a = instantOf(d, NIGHT[0], tz);
    const b = instantOf(addDays(d, 1), NIGHT[1], tz);
    return spotsOfInstants(a, b);
  });
  function spotsOfInstants(a: number, b: number): Spot[] {
    const tz = viewTz || zoneOfDay(week[0]);
    if (!tz) return [];
    return week.flatMap((d) => {
      const s = instantOf(d, '00:00', tz);
      const e = instantOf(addDays(d, 1), '00:00', tz);
      const from = Math.max(a, s);
      const to = Math.min(b, e);
      return to > from ? [{ date: d, from: Math.round((from - s) / 60_000), to: Math.round((to - s) / 60_000) }] : [];
    });
  }
  const y = (min: number) => ((min - H0 * 60) / 60) * HOUR;

  /** The hour labels of one zone column: the grid's hours (on a midweek day) on that zone's clock. */
  const mid = week[3];
  const hourLabel = (h: number, tz: string) => {
    if (!tz || tz === viewTz) return `${h}:00`;
    const at = convert(mid, timeOf(h * 60), viewTz, tz);
    const shift = at.date === mid ? '' : at.date > mid ? '⁺¹' : '⁻¹';
    return `${clock(at.time)}${shift}`;
  };
  const timed = events.filter((e) => e.start && e.minutes);
  const untimed = events.filter((e) => !e.start || !e.minutes);
  // Days off are marked only once there is a draft.
  const drafted = events.length > 0;
  const allDay = calendar.filter((c) => c.allDay);
  /** Where a session sits on the grid: its view day and time (its own day and time if that falls outside the week). */
  const viewOf = (e: DraftEvent) => {
    const v = toView(e.date, e.start!);
    return week.includes(v.date) ? v : { date: e.date, time: e.start! };
  };

  const finish = (e: DraftEvent, d: Drag) => {
    if (!d.moved) return onSelect(e.index);
    const v = viewOf(e);
    const width = (cols.current?.clientWidth ?? 700) / 7;
    const col = Math.min(6, Math.max(0, week.indexOf(v.date) + Math.round(d.dx / width)));
    const start = minutesOf(v.time) + (d.dy / HOUR) * 60;
    const snapped = Math.min((H1 * 60) - (e.minutes ?? 60), Math.max(H0 * 60, Math.round(start / SNAP) * SNAP));
    let at = { date: week[col], time: timeOf(Math.min(snapped, 1439)) };
    if (multi) {
      // Back to local time on the day it lands on: that day's zone decides, so look again once the date is known.
      const first = convert(at.date, at.time, viewTz, zoneOfDay(at.date));
      at = zoneOfDay(first.date) === zoneOfDay(at.date) ? first : convert(at.date, at.time, viewTz, zoneOfDay(first.date));
    }
    if (at.date !== e.date || at.time !== e.start) onMove(e.index, at.date, at.time);
  };

  const gutter = multi ? zones.length * ZONE_COL : 48;
  const columns = { gridTemplateColumns: `${gutter}px repeat(7, minmax(0, 1fr))` };
  const hours = Array.from({ length: H1 - H0 }, (_, i) => H0 + i);

  return (
    <div ref={root} className="flex min-w-[760px] flex-col">
      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
      <div className="grid" style={columns}>
        {multi ? (
          <div className="flex items-end pb-1.5">
            {zones.map((z) => (
              <button key={z.tz} type="button" onClick={() => setPicked(z.tz)}
                title={`Show the week on ${z.short} time (${z.tz.replace(/_/g, ' ')})`}
                aria-pressed={z.tz === viewTz}
                className={cn('mx-0.5 truncate rounded px-1 py-0.5 text-right text-[11px] font-semibold transition-colors',
                  z.tz === viewTz ? 'bg-foreground/8 text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
                style={{ width: ZONE_COL - 4 }}>
                {z.short}
              </button>
            ))}
          </div>
        ) : <span />}
        {week.map((d) => {
          const total = events.filter((e) => e.date === d).reduce((n, e) => n + (e.minutes ?? 0), 0);
          const place = multi ? placeOf(d) : undefined;
          return (
            <div key={d} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-1 px-2 py-2">
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
          {(multi ? zones : [{ tz: '', short: '' }]).map((z) => (
            <div key={z.tz || 'local'} className="relative" style={{ height: bottom, width: multi ? ZONE_COL : 48 }}>
              {hours.map((h, i) => (
                <span key={h} className={cn('absolute right-2 -translate-y-1/2 text-[11px] tabular-nums whitespace-nowrap',
                  multi && z.tz === viewTz ? 'font-medium text-foreground/80' : 'text-muted-foreground')} style={{ top: i * HOUR }}>
                  {i ? hourLabel(h, z.tz) : ''}
                </span>
              ))}
            </div>
          ))}
        </div>
        <div ref={cols} className="relative grid grid-cols-7 border-l" style={{ height: bottom }}>
          {hours.map((h, i) => (
            <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-border/60" style={{ top: i * HOUR }} />
          ))}
          {week.map((d) => {
            const mode = modes?.[d];
            const off = (drafted && !writing && !events.some((e) => e.date === d)) || mode === 'rest' || mode === 'sick';
            return (
              <div key={d} className={cn('relative border-r border-border/60', mode && DAY_STYLE[mode].column)}
                style={off ? { backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 7px, var(--color-border) 7px 8px)' } : undefined}>
                {nights.filter((n) => n.date === d).map((n, i) => {
                  const top = Math.max(0, y(n.from));
                  const end = Math.min(bottom, y(n.to));
                  return end > top ? <div key={`n${i}`} className="pointer-events-none absolute inset-x-0 bg-foreground/[0.045]" style={{ top, height: end - top }} /> : null;
                })}
                {Object.entries(windows ?? {}).flatMap(([x, list]) => (modes?.[x] === 'free' || modes?.[x] === 'busy')
                  ? list.flatMap((w) => spots(x, w.start, minutesOf(w.end) - minutesOf(w.start)).filter((s) => s.date === d).map((s) => ({ s, w, x })))
                  : []).map(({ s, w, x }) => {
                  const top = Math.max(0, y(s.from));
                  const height = Math.min(bottom, y(s.to)) - top;
                  const away = multi && zoneOfDay(x) !== viewTz;
                  return (
                    <div key={`${x}${w.start}${s.date}`} className="pointer-events-none absolute inset-x-1 overflow-hidden rounded-md border-[1.5px] border-dashed border-emerald-600/60 bg-emerald-500/6 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-400/50 dark:text-emerald-300"
                      style={{ top: top + 1, height: height - 2 }}>
                      Free {clock(w.start)}–{clock(w.end)}{away ? ` ${placeOf(x)?.short ?? ''}` : ''}
                    </div>
                  );
                })}
                {calendar.filter((c) => !c.allDay && c.start).flatMap((c) => spots(c.date, c.start!, c.minutes).filter((s) => s.date === d).map((s) => ({ c, s })))
                  .map(({ c, s }, i) => {
                    const top = Math.max(0, y(s.from));
                    const end = Math.min(bottom, y(s.to));
                    return (
                      <div key={i} title={`${clock(c.start)}${multi && zoneOfDay(c.date) !== viewTz ? ` ${placeOf(c.date)?.short ?? ''}` : ''} ${c.title}`}
                        className="absolute inset-x-1 overflow-hidden rounded-md bg-muted px-1.5 py-0.5 text-[11px] leading-tight text-muted-foreground"
                        style={{ top: top + 1, height: Math.max(14, end - top - 2) }}>
                        {c.title}
                      </div>
                    );
                  })}
                {timed.filter((e) => viewOf(e).date === d).map((e) => {
                  const v = viewOf(e);
                  const dragging = drag?.index === e.index ? drag : null;
                  const top = y(minutesOf(v.time));
                  const height = Math.max(20, Math.min(((e.minutes ?? 30) / 60) * HOUR, bottom - top) - 2);
                  const small = height < 34;
                  const away = multi && zoneOfDay(e.date) !== viewTz ? ` ${placeOf(e.date)?.short ?? ''}` : '';
                  return (
                    <button
                      key={e.index}
                      type="button"
                      aria-label={`${e.title}, ${weekday(e.date)} ${clock(e.start)}${away}, ${hm(e.minutes)}. Drag to move.`}
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
                      {!small && <span className="block truncate text-[11px] opacity-80">{clock(e.start)}{away} · {hm(e.minutes)}</span>}
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
