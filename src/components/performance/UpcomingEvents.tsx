import Link from 'next/link';
import type { EventWithCountdown } from '@/lib/performance/events';

const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** The next events with their countdown, for the home page. Data: loadUpcomingEvents (src/lib/performance/events.ts). */
export default function UpcomingEvents({ events, max = 3 }: { events: EventWithCountdown[]; max?: number }) {
  const shown = events.slice(0, max);
  return (
    <section className="rounded-lg border bg-[var(--viz-surface)] p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="font-semibold text-[var(--viz-ink)]">Events</h2>
        <Link href="/goals" className="text-xs underline underline-offset-4">All events →</Link>
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-[var(--viz-muted)]">No upcoming events. <Link href="/goals" className="underline underline-offset-4">Add one</Link>.</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((e) => (
            <li key={e.id} className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <span className="mr-2 inline-block w-5 rounded border text-center text-[11px] font-semibold text-[var(--viz-ink)]" title={`Priority ${e.priority}`}>{e.priority}</span>
                <span className="font-medium text-[var(--viz-ink)]">{e.name}</span>
                <span className="block pl-7 text-xs text-[var(--viz-muted)]">{fmtDate(e.date)}{e.target ? ` · ${e.target}` : ''}</span>
              </div>
              <span className="shrink-0 text-sm tabular-nums text-[var(--viz-ink-2)]">{e.countdown.label}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
