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
        />
      ))}
      <WeekColumn s={week.summary} monday={week.monday} today={today} />
    </div>
  );
});

function DayCell({ day, today, wx, over, clip, h }: { day: Day; today: string; wx?: DayWeather; over: boolean; clip: string | null; h: Handlers }) {
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
          className="plan-day-add mt-0.5 flex h-6 shrink-0 items-center justify-center rounded-[5px] border border-dashed border-[var(--viz-axis)] text-[var(--viz-muted)] opacity-0 transition-opacity hover:border-[var(--viz-ink-2)] hover:text-[var(--viz-ink)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/day:opacity-100"
        >
          <Plus aria-hidden className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
