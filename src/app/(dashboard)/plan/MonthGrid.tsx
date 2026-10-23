'use client';

import { memo } from 'react';
import { Plus } from 'lucide-react';
import { CalendarDayHead, dayCellClass } from '@/components/plan/CalendarDay';
import { cn } from '@/lib/utils';
import { visibleChips } from '@/lib/plan/cells.mjs';
import { addDays } from '@/lib/plan/week.mjs';
import type { DayWeather } from '@/lib/plan/weather';
import type { Item } from './ItemPreview';
import { COLS, ROW_H, longDate, type Day, type Handlers, type WeekRow } from './calendarShared';
import { DayMenu } from './DayMenu';
import { Chip } from './ItemChips';
import { WeekColumn } from './WeekColumn';

// ---------------------------------------------------------------------------------------------------------------
// Grid (tablet and desktop)

export const GridWeek = memo(function GridWeek({
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
          rest={(week.summary?.planned.count ?? 0) > 0}
        />
      ))}
      <WeekColumn s={week.summary} monday={week.monday} today={today} pace={paceOf(week, today)} />
    </div>
  );
});

/** The share of the week's planned time and TSS due by the end of today (the pace mark on the week bars). */
function paceOf(week: WeekRow, today: string) {
  if (week.monday > today || addDays(week.monday, 6) < today) return null;
  let min = 0, tss = 0, dueMin = 0, dueTss = 0;
  for (const d of week.days) for (const i of d.items) {
    if (i.kind !== 'planned') continue;
    min += i.w.duration ?? 0;
    tss += i.w.tss ?? 0;
    if (d.date <= today) { dueMin += i.w.duration ?? 0; dueTss += i.w.tss ?? 0; }
  }
  return { min: min ? dueMin / min : null, tss: tss ? dueTss / tss : null };
}

function DayCell({ day, today, wx, over, clip, h, rest }: { day: Day; today: string; wx?: DayWeather; over: boolean; clip: string | null; h: Handlers; rest: boolean }) {
  const d = day.date;
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
      className={cn(dayCellClass(d, today), over && 'bg-primary/10 ring-2 ring-inset ring-primary/70')}
    >
      <CalendarDayHead date={d} today={today} weather={wx} health menu={<DayMenu d={d} day={day} clip={clip} h={h} />} />
      {rest && day.items.length === 0 && <span className="px-1 text-[12px] text-[var(--viz-muted)]">Rest</span>}
      {shown.map((item) => <Chip key={item.key} item={item} h={h} />)}
      {more > 0 && (
        <button
          type="button"
          onClick={(e) => h.open({ kind: 'day', date: d }, e.currentTarget)}
          className="rounded px-1 text-left text-[12px] font-medium text-[var(--viz-ink-2)] hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          +{more} more
        </button>
      )}
      {more === 0 && (
        <button
          type="button"
          onClick={() => h.day(d, 'add')}
          aria-label={`Add a workout on ${longDate(d)}`}
          className="plan-day-add mt-0.5 flex h-6 shrink-0 items-center justify-center rounded-[5px] border border-dashed border-[var(--viz-axis)] text-[var(--viz-muted)] opacity-0 transition-opacity hover:border-[var(--viz-ink-2)] hover:text-[var(--viz-ink)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/day:opacity-100"
        >
          <Plus aria-hidden className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
