'use client';

import { memo } from 'react';
import { Plus } from 'lucide-react';
import WeatherBadge from '@/components/plan/WeatherBadge';
import { AgendaDayLabel } from '@/components/plan/CalendarDay';
import { cn } from '@/lib/utils';
import { weekColumnMode } from '@/lib/plan/cells.mjs';
import { addDays } from '@/lib/plan/week.mjs';
import type { DayWeather } from '@/lib/plan/weather';
import { longDate, shortDate, type Handlers, type WeekRow } from './calendarShared';
import { DayMenu } from './DayMenu';
import { Chip } from './ItemChips';
import { WeekTotals } from './WeekColumn';

// ---------------------------------------------------------------------------------------------------------------
// Agenda (phones)

export const AgendaWeek = memo(function AgendaWeek({
  week, today, weather, clip, h,
}: {
  week: WeekRow;
  clip: string | null;
  today: string;
  weather: Record<string, DayWeather>;
  h: Handlers;
}) {
  const weatherUntil = addDays(today, 14);
  const s = week.summary;
  const days = week.days.filter((d) => d.items.length > 0 || d.date === today || (d.date >= today && d.date <= weatherUntil && weather[d.date]));
  return (
    <section data-week={week.monday} className="plan-agenda-week overflow-hidden rounded-lg border bg-background">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b bg-[var(--viz-surface)] px-3 py-2">
        <span className="text-sm font-semibold text-[var(--viz-ink)]">Week of {shortDate(week.monday)}</span>
        {s && weekColumnMode(s, today) === 'empty' && week.monday > today && <span className="text-[11px] text-[var(--viz-muted)]">No plan</span>}
        {s && weekColumnMode(s, today) !== 'empty' && <WeekTotals s={s} />}
      </header>
      {days.length === 0 ? (
        <p className="px-3 py-3 text-xs text-[var(--viz-muted)]">Nothing this week.</p>
      ) : (
        <ul className="divide-y">
          {days.map((day) => {
            const d = day.date;
            const past = d < today;
            const isToday = d === today;
            const wx = d >= today && d <= weatherUntil ? weather[d] : undefined;
            return (
              <li key={d} className={cn('flex gap-3 px-3 py-2', past && 'bg-muted/30', isToday && 'bg-primary/[0.05]')}>
                <AgendaDayLabel date={d} today={today} />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="group/day flex items-center justify-end gap-1">
                    {wx && <WeatherBadge w={wx} date={d} />}
                    <button
                      type="button"
                      onClick={() => h.day(d, 'add')}
                      aria-label={`Add a workout on ${longDate(d)}`}
                      className="grid h-8 w-8 place-items-center rounded-md text-[var(--viz-muted)] hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Plus aria-hidden className="h-4 w-4" />
                    </button>
                    <span className="[&>button]:opacity-100"><DayMenu d={d} day={day} clip={clip} h={h} /></span>
                  </div>
                  {day.items.map((item) => <Chip key={item.key} item={item} h={h} roomy />)}
                  {day.items.length === 0 && <p className="py-1 text-xs text-[var(--viz-muted)]">Nothing planned</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
});
