import Link from 'next/link';
import { Dumbbell } from 'lucide-react';
import SportIcon from '@/components/SportIcon';
import ComplianceMark from '@/components/plan/ComplianceMark';
import WeatherBadge from '@/components/plan/WeatherBadge';
import { cn } from '@/lib/utils';
import { plainTitle } from '@/lib/plan/calendar.mjs';
import { cellItems, dur } from '@/lib/plan/cells.mjs';
import type { CalendarActivity, CalendarLift, CalendarRange, CalendarWorkout } from '@/lib/plan/month';
import type { DayWeather } from '@/lib/plan/weather';
import { addDays } from '@/lib/plan/week.mjs';
import { todayWorkouts } from '@/lib/performance/display.mjs';
import TodayWorkout from './TodayWorkout';
import { sport } from '@/lib/sports';

type Item =
  | { kind: 'planned'; key: string; w: CalendarWorkout; actual: CalendarActivity | null }
  | { kind: 'activity'; key: string; a: CalendarActivity }
  | { kind: 'lift'; key: string; l: CalendarLift; a: CalendarActivity | null };

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const chipBase = 'relative z-10 block min-w-0 rounded-[5px] border border-l-[3px] px-1.5 py-1 text-[11px] leading-[15px] transition-shadow hover:shadow-md';

function Chip({ item, href }: { item: Item; href: string }) {
  if (item.kind === 'planned') {
    const { w, actual } = item;
    const done = w.state === 'done';
    const missed = w.state === 'missed';
    const planned = [w.duration ? dur(w.duration) : null, w.tss ? `${Math.round(w.tss)} TSS` : null].filter(Boolean).join(' · ');
    const doneText = actual ? [dur(actual.min), actual.tss ? `${Math.round(actual.tss)} TSS` : null].filter(Boolean).join(' · ') : null;
    return (
      <Link
        href={href}
        className={cn(
          chipBase,
          done && 'border-transparent bg-card shadow-sm',
          missed && 'border-dashed border-[var(--plan-missed)]/50',
          !done && !missed && 'border-dashed border-[var(--viz-axis)] bg-background/80',
          w.state === 'skipped' && 'opacity-60'
        )}
        style={{ borderLeftColor: sport(w.sport).color, borderLeftStyle: 'solid' }}
        title={`${plainTitle(w.title)}: ${w.compliance.label}`}
      >
        <span className="flex min-w-0 items-center gap-1">
          <SportIcon id={w.sport} className="h-3 w-3" />
          <span className={cn('min-w-0 flex-1 truncate font-medium text-[var(--viz-ink)]', w.state === 'skipped' && 'line-through')}>{plainTitle(w.title)}</span>
          <ComplianceMark level={w.compliance.level} title={w.compliance.label} />
        </span>
        <span className="block truncate tabular-nums text-[var(--viz-ink-2)]">{done && doneText ? doneText : planned || sport(w.sport).label}</span>
      </Link>
    );
  }
  if (item.kind === 'activity') {
    const a = item.a;
    const text = [dur(a.min), a.km >= 0.5 ? `${a.km} km` : null, a.tss ? `${Math.round(a.tss)} TSS` : null].filter(Boolean).join(' · ');
    return (
      <Link href={href} title={a.name || sport(a.sport).label} className={cn(chipBase, 'border-transparent bg-card shadow-sm')} style={{ borderLeftColor: sport(a.sport).color }}>
        <span className="flex min-w-0 items-center gap-1">
          <SportIcon id={a.sport} className="h-3 w-3" />
          <span className="min-w-0 flex-1 truncate font-medium text-[var(--viz-ink)]">{a.name || sport(a.sport).label}</span>
        </span>
        <span className="block truncate tabular-nums text-[var(--viz-ink-2)]">{text}</span>
      </Link>
    );
  }
  const l = item.l;
  return (
    <Link href={href} title={l.name} className={cn(chipBase, 'border-transparent bg-card shadow-sm')} style={{ borderLeftColor: sport('strength').color }}>
      <span className="flex min-w-0 items-center gap-1">
        <Dumbbell aria-hidden className="h-3 w-3 shrink-0" style={{ color: sport('strength').color }} />
        <span className="min-w-0 flex-1 truncate font-medium text-[var(--viz-ink)]">{l.name}</span>
      </span>
      <span className="block truncate tabular-nums text-[var(--viz-ink-2)]">
        {item.a ? [dur(item.a.min), item.a.tss ? `${Math.round(item.a.tss)} TSS` : null, `${l.setsLogged} sets`].filter(Boolean).join(' · ') : `${l.setsLogged} sets · Lift`}
      </span>
    </Link>
  );
}

/**
 * This week on the home page, drawn like a week row of the Plan calendar (same chips and weather), with today's
 * workouts above it: what is asked and the structure chart. Everything links on: a chip opens that item in Plan
 * (?open=), a day opens its week in Plan, and the date opens that day's health.
 */
export default function HomeWeek({ range, weather }: { range: CalendarRange; weather: Record<string, DayWeather> }) {
  const today = range.today;
  const monday = range.weeks[0];
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const items = cellItems(
      range.workouts.filter((w) => w.date === date),
      range.activities.filter((a) => a.date === date),
      range.lifts.filter((l) => l.date === date)
    ) as Item[];
    return { date, items };
  });
  const { items: todays, emptyText } = todayWorkouts(range);
  const skipped = range.workouts.filter((w) => w.date === today && w.status === 'skipped');
  const planHref = `/plan?week=${monday}`;
  const openHref = (key: string) => `${planHref}&open=${encodeURIComponent(key)}`;
  return (
    <section className="overflow-hidden rounded-lg border bg-card" aria-labelledby="home-week">
      <div className="flex items-baseline justify-between gap-3 px-4 pb-3 pt-4">
        <h2 id="home-week" className="font-semibold">
          <Link href={planHref} className="hover:underline hover:underline-offset-4">This week</Link>
        </h2>
        <Link href={planHref} className="text-xs text-[var(--viz-muted)] hover:text-foreground">Open Plan →</Link>
      </div>

      <div className="divide-y border-t bg-[var(--viz-surface)]">
        {todays.map((w) => <TodayWorkout key={w.id} w={w} href={openHref(`w-${w.id}`)} />)}
        {todays.length === 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--viz-muted)]">Today</span>
            {skipped.length > 0 ? (
              skipped.map((w) => (
                <Link key={w.id} href={openHref(`w-${w.id}`)} className="flex items-center gap-1.5 text-[var(--viz-ink-2)] hover:text-foreground">
                  <SportIcon id={w.sport} className="h-3.5 w-3.5" />
                  <span className="line-through">{plainTitle(w.title)}</span>
                  <span className="text-[var(--viz-muted)]">skipped</span>
                </Link>
              ))
            ) : (
              <Link href={planHref} className="text-[var(--viz-ink-2)] hover:text-foreground">{emptyText}</Link>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-[repeat(7,minmax(0,1fr))] border-t">
        {WEEKDAYS.map((d, i) => (
          <span key={d} className={cn('border-b px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--viz-muted)]', i < 6 && 'border-r')}>{d}</span>
        ))}
        {days.map(({ date, items }, i) => {
          const isToday = date === today;
          const past = date < today;
          const wx = date >= today ? weather[date] : undefined;
          const day = Number(date.slice(8));
          return (
            <div
              key={date}
              className={cn(
                'group relative flex min-h-32 min-w-0 flex-col gap-1 px-1 pb-1.5 pt-1 transition-colors hover:bg-[var(--viz-band)]',
                i < 6 && 'border-r',
                past && 'bg-muted/40',
                isToday && 'bg-primary/[0.04] ring-2 ring-inset ring-primary'
              )}
            >
              {/* The whole day opens its week in Plan; the date, weather and chips sit above this link. */}
              <Link href={planHref} className="absolute inset-0" aria-label={`${WEEKDAYS[i]} ${day}${isToday ? ', today' : ''}: open in Plan`} />
              <span className="relative z-10 flex h-5 shrink-0 items-center gap-1">
                <Link
                  href={`/health/day/${date}`}
                  title="Health that day"
                  className={cn(
                    'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums hover:ring-1 hover:ring-border',
                    isToday ? 'bg-primary text-primary-foreground' : past ? 'text-[var(--viz-muted)]' : 'text-[var(--viz-ink)]'
                  )}
                >
                  {day}
                </Link>
                <span className="flex-1" />
                {wx && <span className="hidden min-w-0 lg:inline"><WeatherBadge w={wx} date={date} compact /></span>}
              </span>
              {items.map((item) => <Chip key={item.key} item={item} href={openHref(item.key)} />)}
            </div>
          );
        })}
      </div>
    </section>
  );
}
