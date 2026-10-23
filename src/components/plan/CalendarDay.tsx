'use client';

import HealthBadge from '@/components/plan/HealthBadge';
import WeatherBadge from '@/components/plan/WeatherBadge';
import { cn } from '@/lib/utils';
import type { DayWeather } from '@/lib/plan/weather';

const monthShort = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
const longDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const weekday = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

/**
 * The top line of a calendar day cell: the date (a month name on the 1st, a ring today), the health badge on past
 * days, the weather, and an optional menu. Used by /plan's month grid and the plan review. `weekdayLabel` adds
 * "Mon" before the date (the review has no weekday header row).
 */
export function CalendarDayHead({
  date,
  today,
  weather,
  menu,
  health = false,
  weekdayLabel = false,
}: {
  date: string;
  today: string;
  weather?: DayWeather;
  menu?: React.ReactNode;
  health?: boolean;
  weekdayLabel?: boolean;
}) {
  const past = date < today;
  const isToday = date === today;
  return (
    <div className="flex h-5 shrink-0 items-center gap-1">
      {weekdayLabel && !isToday && <span className="pl-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--viz-muted)]">{weekday(date)}</span>}
      <span
        className={cn(
          'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums',
          isToday ? 'bg-primary text-primary-foreground' : past ? 'text-[var(--viz-muted)]' : 'text-[var(--viz-ink)]'
        )}
      >
        {date.slice(8) === '01' && !weekdayLabel && <span className="mr-1 uppercase tracking-wide">{monthShort(date)}</span>}
        {Number(date.slice(8))}
      </span>
      {isToday && <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-ink">Today</span>}
      {health && past && (
        <HealthBadge
          date={date}
          label={`Health on ${longDate(date)}`}
          className="rounded text-[var(--viz-muted)] opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/day:opacity-100"
        />
      )}
      <span className="flex-1" />
      {weather && <WeatherBadge w={weather} date={date} compact />}
      {menu}
    </div>
  );
}

/** The date column of a phone agenda row: weekday over a round day number (filled today). */
export function AgendaDayLabel({ date, today }: { date: string; today: string }) {
  const past = date < today;
  const isToday = date === today;
  return (
    <div className="w-9 shrink-0 text-center">
      <span className={cn('block text-[10px] font-semibold uppercase tracking-wide', isToday ? 'text-brand-ink' : 'text-[var(--viz-muted)]')}>
        {isToday ? 'Today' : weekday(date)}
      </span>
      <span
        className={cn(
          'mx-auto grid h-7 w-7 place-items-center rounded-full text-sm font-semibold tabular-nums',
          isToday ? 'bg-primary text-primary-foreground' : past ? 'text-[var(--viz-muted)]' : 'text-[var(--viz-ink)]'
        )}
      >
        {Number(date.slice(8))}
      </span>
    </div>
  );
}

/** The classes of a month-grid day cell (past days greyed, today ringed), shared by /plan and the plan review. */
export function dayCellClass(date: string, today: string) {
  return cn(
    'plan-day group/day relative flex min-h-0 min-w-0 flex-col gap-0.5 overflow-hidden border-r px-1 pb-1 pt-0.5 transition-colors',
    date < today && 'bg-muted/40',
    date === today && 'bg-primary/[0.04] ring-2 ring-inset ring-primary'
  );
}
