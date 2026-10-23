import Link from 'next/link';
import { CalendarClock, Dumbbell, Flame } from 'lucide-react';
import { nextWhen, plannedText, weekStats } from '@/lib/lift-dashboard/text.mjs';
import { fmtDay, type Overview } from './types';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** This week against the strength target: the 7 days, sets, volume, the last lift and the streak; and what is next. */
export default function WeekHero({ o }: { o: Overview }) {
  const week = o.calendar.at(-1) ?? [];
  const done = o.thisWeek.sessions;
  const pct = Math.min(1, done / Math.max(1, o.strengthTarget));
  const next = o.upcoming[0] ?? null;
  const plannedDays = new Map(o.upcoming.map((u) => [u.day, u]));
  const stats: [string, string, string][] = weekStats(o).map((s) => [s.label, s.value, s.detail]);
  return (
    <section
      className="overflow-hidden rounded-2xl border"
      style={{ background: 'linear-gradient(135deg, color-mix(in oklab, var(--sport-strength) 13%, var(--background)) 0%, var(--background) 65%)' }}
      aria-label="This week"
    >
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--sport-strength)' }}>
                <Dumbbell aria-hidden className="h-3.5 w-3.5" /> This week · {fmtDay(o.monday)}–{fmtDay(week.at(-1)?.day ?? o.monday)}
              </p>
              <p className="mt-1 tabular-nums text-[var(--viz-ink)]">
                <b className="text-4xl font-semibold tracking-tight">{done}</b>
                <span className="text-xl text-[var(--viz-muted)]"> / {o.strengthTarget}</span>
                <span className="ml-2 text-sm text-[var(--viz-ink-2)]">strength sessions</span>
              </p>
            </div>
            <ol className="flex gap-1.5" aria-label="Days this week">
              {week.map((d, i) => {
                const planned = plannedDays.get(d.day);
                const isToday = d.day === o.today;
                const cell = (
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-lg text-xs font-medium ${
                      d.sets ? 'text-white' : planned ? 'border border-dashed border-[var(--sport-strength)] text-[var(--sport-strength)]' : 'bg-[var(--viz-band)] text-[var(--viz-muted)]'
                    } ${isToday ? 'ring-2 ring-[var(--viz-ink)] ring-offset-2 ring-offset-background' : ''}`}
                    style={d.sets ? { background: 'var(--sport-strength)' } : undefined}
                  >
                    {DAYS[i]}
                  </span>
                );
                const title = d.sets ? `${fmtDay(d.day, { weekday: 'long' })}: ${d.title}, ${d.sets} sets` : planned ? `${fmtDay(d.day, { weekday: 'long' })}: ${planned.title} planned` : fmtDay(d.day, { weekday: 'long' });
                const href = d.sessionId ? `/lift/sessions/${d.sessionId}` : planned ? `/lift/sessions/${planned.id}` : null;
                return (
                  <li key={d.day} title={title}>
                    {href ? <Link href={href} aria-label={title}>{cell}</Link> : <span aria-label={title}>{cell}</span>}
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--viz-grid)]" role="img" aria-label={`${done} of ${o.strengthTarget} sessions`}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct * 100}%`, background: pct >= 1 ? 'var(--viz-good)' : 'var(--sport-strength)' }} />
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            {stats.map(([label, value, sub]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[11px] uppercase tracking-wide text-[var(--viz-muted)]">{label}</dt>
                <dd className="flex items-center gap-1 truncate text-lg font-semibold tabular-nums text-[var(--viz-ink)]">
                  {label === 'Streak' && o.streak > 1 && <Flame aria-hidden className="h-4 w-4 text-[var(--color-amber-500)]" />}
                  {value}
                </dd>
                <dd className="truncate text-[11px] text-[var(--viz-ink-2)]">{sub}</dd>
              </div>
            ))}
          </dl>
        </div>

        {next ? (
          <Link
            href={`/lift/sessions/${next.id}`}
            className="group flex flex-col justify-between gap-3 rounded-xl border bg-background/80 p-4 transition-colors hover:border-[var(--sport-strength)]"
          >
            <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--viz-muted)]">
              <CalendarClock aria-hidden className="h-3.5 w-3.5" /> Next up · {nextWhen(next.day, o.today)}
            </span>
            <span className="text-lg font-semibold leading-tight text-[var(--viz-ink)]">{next.title || 'Lift session'}</span>
            <span className="text-xs text-[var(--viz-ink-2)]">
              {plannedText(next)}
            </span>
            <span className="text-xs font-medium text-brand-ink">Open the plan →</span>
          </Link>
        ) : (
          <Link href="/plan" className="flex flex-col justify-between gap-3 rounded-xl border border-dashed bg-background/60 p-4 transition-colors hover:border-[var(--sport-strength)]">
            <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--viz-muted)]">
              <CalendarClock aria-hidden className="h-3.5 w-3.5" /> Next up
            </span>
            <span className="text-sm text-[var(--viz-ink-2)]">No Lift session planned. Put one on the plan, or start one from a template in Lift.</span>
            <span className="text-xs font-medium" style={{ color: 'var(--sport-strength)' }}>Open Plan →</span>
          </Link>
        )}
      </div>
    </section>
  );
}
