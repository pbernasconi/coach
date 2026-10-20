import Link from 'next/link';
import { ChevronRight, Trophy } from 'lucide-react';
import { sessionMeta } from '@/lib/lift-dashboard/text.mjs';
import { compact, fmtDay, muscleName, type SessionRow, type Upcoming } from './types';

const SHOWN = 8;

function Row({ s, unit, max }: { s: SessionRow; unit: string; max: number }) {
  const meta = sessionMeta(s);
  return (
    <li>
      <Link href={`/lift/sessions/${s.id}`} className="group grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--viz-band)]">
        <span className="flex flex-col items-center rounded-lg border bg-background py-1 leading-none">
          <span className="text-[10px] uppercase text-[var(--viz-muted)]">{fmtDay(s.day, { weekday: 'short' })}</span>
          <span className="text-lg font-semibold tabular-nums text-[var(--viz-ink)]">{fmtDay(s.day, { day: 'numeric' })}</span>
          <span className="text-[10px] uppercase text-[var(--viz-muted)]">{fmtDay(s.day, { month: 'short' })}</span>
        </span>
        <span className="min-w-0 space-y-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium text-[var(--viz-ink)] group-hover:underline">{s.title || 'Lift session'}</span>
            {s.prs.length > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--color-amber-500)_18%,transparent)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-amber-600)] dark:text-[var(--color-amber-400)]" title={s.prs.join(', ')}>
                <Trophy aria-hidden className="h-3 w-3" /> {s.prs.length} {s.prs.length === 1 ? 'PR' : 'PRs'}
              </span>
            )}
          </span>
          <span className="block truncate text-xs text-[var(--viz-ink-2)]">{meta}</span>
          {s.muscles.length > 0 && (
            <span className="flex flex-wrap gap-1">
              {s.muscles.map((m) => (
                <span key={m} className="rounded-full bg-[color-mix(in_oklab,var(--sport-strength)_12%,transparent)] px-2 py-0.5 text-[10px] text-[var(--viz-ink-2)]">{muscleName(m)}</span>
              ))}
            </span>
          )}
        </span>
        <span className="flex items-center gap-2">
          <span className="w-16 text-right sm:w-24">
            <span className="block text-sm font-semibold tabular-nums text-[var(--viz-ink)]">{s.volume > 0 ? compact(s.volume) : '–'}</span>
            <span className="block text-[10px] text-[var(--viz-muted)]">{s.volume > 0 ? unit : 'no weights'}</span>
            <span className="mt-1 hidden h-1 overflow-hidden rounded-full bg-[var(--viz-grid)] sm:block">
              <span className="block h-full rounded-full" style={{ width: `${(s.volume / max) * 100}%`, background: 'var(--sport-strength)' }} />
            </span>
          </span>
          <ChevronRight aria-hidden className="h-4 w-4 text-[var(--viz-muted)] transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </li>
  );
}

/** Planned sessions, then the logged ones, newest first. Each row opens the session. */
export default function SessionList({ sessions, upcoming, unit, today }: { sessions: SessionRow[]; upcoming: Upcoming[]; unit: string; today: string }) {
  const max = Math.max(1, ...sessions.map((s) => s.volume));
  const first = sessions.slice(0, SHOWN);
  const more = sessions.slice(SHOWN);
  return (
    <section id="sessions" className="scroll-mt-20 overflow-hidden rounded-xl border bg-card" aria-labelledby="sessions-h">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <h2 id="sessions-h" className="font-semibold">Sessions</h2>
        <span className="text-xs text-[var(--viz-muted)]">{sessions.length} logged · volume = reps × weight, warm-ups out</span>
      </div>
      {upcoming.length > 0 && (
        <ul className="divide-y border-b bg-[color-mix(in_oklab,var(--sport-strength)_5%,transparent)]">
          {upcoming.map((u) => (
            <li key={u.id}>
              <Link href={`/lift/sessions/${u.id}`} className="group flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[var(--viz-band)]">
                <span className="rounded-full border border-dashed border-[var(--sport-strength)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--sport-strength)' }}>
                  {u.day === today ? 'Today' : 'Planned'}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium group-hover:underline">{u.title || 'Lift session'}</span>
                <span className="shrink-0 text-xs text-[var(--viz-ink-2)]">{fmtDay(u.day, { weekday: 'short', month: 'short', day: 'numeric' })} · {u.sets} sets</span>
                <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-[var(--viz-muted)]" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <ul className="divide-y">
        {first.map((s) => <Row key={s.id} s={s} unit={unit} max={max} />)}
      </ul>
      {more.length > 0 && (
        <details className="group border-t">
          <summary className="cursor-pointer list-none px-4 py-3 text-center text-sm text-[var(--viz-ink-2)] hover:bg-[var(--viz-band)] [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Show {more.length} older sessions</span>
            <span className="hidden group-open:inline">Show fewer</span>
          </summary>
          <ul className="divide-y border-t">
            {more.map((s) => <Row key={s.id} s={s} unit={unit} max={max} />)}
          </ul>
        </details>
      )}
    </section>
  );
}
