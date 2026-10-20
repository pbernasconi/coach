import Link from 'next/link';
import { Dumbbell } from 'lucide-react';
import SportIcon from '@/components/SportIcon';
import ComplianceMark from '@/components/plan/ComplianceMark';
import WeatherBadge from '@/components/plan/WeatherBadge';
import { cn } from '@/lib/utils';
import { plainTitle } from '@/lib/plan/calendar.mjs';
import { cellItems, dur } from '@/lib/plan/cells.mjs';
import type { CalendarActivity, CalendarLift, CalendarRange, CalendarWorkout, WeekSummary } from '@/lib/plan/month';
import type { DayWeather } from '@/lib/plan/weather';
import { addDays } from '@/lib/plan/week.mjs';
import { sport } from '@/lib/sports';

type Item =
  | { kind: 'planned'; key: string; w: CalendarWorkout; actual: CalendarActivity | null }
  | { kind: 'activity'; key: string; a: CalendarActivity }
  | { kind: 'lift'; key: string; l: CalendarLift };

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const hm = (min: number) => `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')}`;
const signed = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n)}`;

// Garmin's readiness bands, with what they mean for today's session.
function cueFor(readiness: number | null) {
  if (readiness == null) return null;
  if (readiness >= 75) return 'Readiness high: go as planned';
  if (readiness >= 50) return 'Readiness moderate: hold back about 10%';
  if (readiness >= 25) return 'Readiness low: keep it easy';
  return 'Readiness poor: consider rest';
}

const chipBase = 'block min-w-0 rounded-[5px] border border-l-[3px] px-1.5 py-1 text-[11px] leading-[15px] transition-shadow hover:shadow-md';

function Chip({ item }: { item: Item }) {
  if (item.kind === 'planned') {
    const { w, actual } = item;
    const done = w.state === 'done';
    const missed = w.state === 'missed';
    const planned = [w.duration ? dur(w.duration) : null, w.tss ? `${Math.round(w.tss)} TSS` : null].filter(Boolean).join(' · ');
    const doneText = actual ? [dur(actual.min), actual.tss ? `${Math.round(actual.tss)} TSS` : null].filter(Boolean).join(' · ') : null;
    return (
      <div
        className={cn(
          chipBase,
          done && 'border-transparent bg-card shadow-sm',
          missed && 'border-dashed border-[var(--plan-missed)]/50',
          !done && !missed && 'border-dashed border-[var(--viz-axis)] bg-background/80',
          w.state === 'skipped' && 'opacity-60'
        )}
        style={{ borderLeftColor: sport(w.sport).color, borderLeftStyle: 'solid' }}
        title={w.compliance.label}
      >
        <span className="flex min-w-0 items-center gap-1">
          <SportIcon id={w.sport} className="h-3 w-3" />
          <span className={cn('min-w-0 flex-1 truncate font-medium text-[var(--viz-ink)]', w.state === 'skipped' && 'line-through')}>{plainTitle(w.title)}</span>
          <ComplianceMark level={w.compliance.level} title={w.compliance.label} />
        </span>
        <span className="block truncate tabular-nums text-[var(--viz-ink-2)]">{done && doneText ? doneText : planned || sport(w.sport).label}</span>
      </div>
    );
  }
  if (item.kind === 'activity') {
    const a = item.a;
    const text = [dur(a.min), a.km >= 0.5 ? `${a.km} km` : null, a.tss ? `${Math.round(a.tss)} TSS` : null].filter(Boolean).join(' · ');
    return (
      <div className={cn(chipBase, 'border-transparent bg-card shadow-sm')} style={{ borderLeftColor: sport(a.sport).color }}>
        <span className="flex min-w-0 items-center gap-1">
          <SportIcon id={a.sport} className="h-3 w-3" />
          <span className="min-w-0 flex-1 truncate font-medium text-[var(--viz-ink)]">{a.name || sport(a.sport).label}</span>
        </span>
        <span className="block truncate tabular-nums text-[var(--viz-ink-2)]">{text}</span>
      </div>
    );
  }
  const l = item.l;
  return (
    <div className={cn(chipBase, 'border-transparent bg-card shadow-sm')} style={{ borderLeftColor: sport('strength').color }}>
      <span className="flex min-w-0 items-center gap-1">
        <Dumbbell aria-hidden className="h-3 w-3 shrink-0" style={{ color: sport('strength').color }} />
        <span className="min-w-0 flex-1 truncate font-medium text-[var(--viz-ink)]">{l.name}</span>
      </span>
      <span className="block tabular-nums text-[var(--viz-ink-2)]">{l.setsLogged} sets · Lift</span>
    </div>
  );
}

function WeekSide({ s }: { s: WeekSummary | null }) {
  if (!s) return <div className="hidden border-l bg-[var(--viz-surface)] md:block" />;
  const rows: [string, string, string | null][] = [
    ['Time', hm(s.done.min), s.planned.min ? hm(s.planned.min) : null],
    ['TSS', String(Math.round(s.done.tss)), s.planned.tss ? String(Math.round(s.planned.tss)) : null],
  ];
  if (s.done.km > 0) rows.push(['Dist', `${s.done.km} km`, null]);
  if (s.planned.count > 0) rows.push(['Done', `${s.planned.done}/${s.planned.count}`, null]);
  return (
    <div className="hidden flex-col gap-2 border-l bg-[var(--viz-surface)] px-2 py-1.5 text-[11px] leading-4 md:flex" aria-label="This week">
      {s.fitness && (
        <div className="grid grid-cols-3 gap-1">
          {([['Fit', String(Math.round(s.fitness.ctl)), 'var(--viz-ctl)'], ['Fat', String(Math.round(s.fitness.atl)), 'var(--viz-atl)'], ['Form', signed(s.fitness.tsb), 'var(--viz-tsb)']] as const).map(
            ([label, value, color]) => (
              <div key={label} className="min-w-0">
                <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--viz-muted)]">
                  <span className="h-0.5 w-2 shrink-0 rounded-full" style={{ background: color }} />
                  {label}
                </div>
                <div className="font-semibold tabular-nums text-[var(--viz-ink)]">{value}</div>
              </div>
            )
          )}
        </div>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 tabular-nums">
        {rows.map(([label, value, of]) => (
          <div key={label} className="contents">
            <dt className="text-[var(--viz-muted)]">{label}</dt>
            <dd className="text-right text-[var(--viz-ink)]">
              {value}
              {of && <span className="text-[var(--viz-muted)]"> / {of}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * This week on the home page, drawn like a week row of the Plan calendar (same chips, weather and week column),
 * with today's session and a readiness cue on one line above it. Read-only: each date links to the week in Plan.
 */
export default function HomeWeek({
  range, weather, readiness,
}: {
  range: CalendarRange;
  weather: Record<string, DayWeather>;
  readiness: number | null;
}) {
  const today = range.today;
  const monday = range.weeks[0];
  const summary = range.summaries.find((s) => s.monday === monday) ?? null;
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const items = cellItems(
      range.workouts.filter((w) => w.date === date),
      range.activities.filter((a) => a.date === date),
      range.lifts.filter((l) => l.date === date)
    ) as Item[];
    return { date, items };
  });
  const todays = range.workouts.filter((w) => w.date === today && w.status !== 'skipped');
  const cue = cueFor(readiness);
  const planHref = `/plan?week=${monday}`;
  return (
    <section className="overflow-hidden rounded-lg border bg-card" aria-labelledby="home-week">
      <div className="flex items-baseline justify-between gap-3 px-4 pb-3 pt-4">
        <h2 id="home-week" className="font-semibold">This week</h2>
        <Link href={planHref} className="text-xs text-[var(--viz-muted)] hover:text-foreground">Open Plan →</Link>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t bg-[var(--viz-surface)] px-4 py-2 text-sm">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--viz-muted)]">Today</span>
        {todays.length === 0 ? (
          <span className="text-[var(--viz-ink-2)]">{range.workouts.length ? 'Rest day' : 'No plan this week. Run /plan in Claude Code to make one.'}</span>
        ) : (
          todays.map((w) => (
            <span key={w.id} className="flex items-center gap-1.5 font-medium">
              <SportIcon id={w.sport} className="h-3.5 w-3.5" />
              {plainTitle(w.title)}
              <span className="font-normal tabular-nums text-[var(--viz-muted)]">
                {[w.startTime, w.duration ? dur(w.duration) : null].filter(Boolean).join(' · ')}
                {w.state === 'done' && ' · done'}
              </span>
            </span>
          ))
        )}
        {cue && todays.length > 0 && <span className="text-amber-800 dark:text-amber-300">{cue}</span>}
      </div>

      <div className="grid grid-cols-[repeat(7,minmax(0,1fr))] border-t md:grid-cols-[repeat(7,minmax(0,1fr))_7rem]">
        {days.map(({ date, items }, i) => {
          const isToday = date === today;
          const past = date < today;
          const wx = date >= today ? weather[date] : undefined;
          return (
            <div
              key={date}
              className={cn(
                'flex min-h-36 min-w-0 flex-col gap-1 border-r px-1 pb-1.5 pt-1',
                past && 'bg-muted/40',
                isToday && 'bg-primary/[0.04] ring-2 ring-inset ring-primary'
              )}
            >
              <span className="flex h-5 shrink-0 items-center gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--viz-muted)]">{WEEKDAYS[i]}</span>
                <Link
                  href={planHref}
                  aria-label={`${WEEKDAYS[i]} ${Number(date.slice(8))}${isToday ? ', today' : ''}: open in Plan`}
                  className={cn(
                    'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums hover:ring-1 hover:ring-border',
                    isToday ? 'bg-primary text-primary-foreground' : past ? 'text-[var(--viz-muted)]' : 'text-[var(--viz-ink)]'
                  )}
                >
                  {Number(date.slice(8))}
                </Link>
                <span className="flex-1" />
                {wx && <span className="hidden lg:inline"><WeatherBadge w={wx} date={date} compact /></span>}
              </span>
              {items.map((item) => <Chip key={item.key} item={item} />)}
            </div>
          );
        })}
        <WeekSide s={summary} />
      </div>
    </section>
  );
}
