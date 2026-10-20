'use client';

import { memo } from 'react';
import { Plus } from 'lucide-react';
import WeatherBadge from '@/components/plan/WeatherBadge';
import HealthBadge from '@/components/plan/HealthBadge';
import { cn } from '@/lib/utils';
import { visibleChips } from '@/lib/plan/cells.mjs';
import { addDays } from '@/lib/plan/week.mjs';
import type { DayWeather } from '@/lib/plan/weather';
import type { Item } from './ItemPreview';
import { COLS, ROW_H, longDate, monthShort, type Day, type Handlers, type WeekRow } from './calendarShared';
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
        <HealthBadge
          date={d}
          label={`Health on ${longDate(d)}`}
          className="rounded text-[var(--viz-muted)] opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/day:opacity-100"
        />
      )}
      <span className="flex-1" />
      {wx && <WeatherBadge w={wx} date={d} compact={!roomy} />}
      {menu}
    </div>
  );
}
