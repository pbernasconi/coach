import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { fmtDay, weight, type Record } from './types';

/** The latest personal records: a session's best estimated 1RM above every session before it. */
export default function Records({ prs, unit }: { prs: Record[]; unit: string }) {
  return (
    <section id="records" className="scroll-mt-20 overflow-hidden rounded-xl border bg-card" aria-labelledby="records-h">
      <div className="flex items-baseline justify-between border-b px-4 py-3">
        <h2 id="records-h" className="font-semibold">Recent records</h2>
        <span className="text-xs text-[var(--viz-muted)]">estimated 1RM</span>
      </div>
      {prs.length === 0 ? (
        <p className="p-4 text-sm text-[var(--viz-muted)]">No records yet. They appear when a set beats every earlier session.</p>
      ) : (
        <ul className="divide-y">
          {prs.map((r) => (
            <li key={`${r.key}-${r.sessionId}`}>
              <Link href={`/lift/exercises/${encodeURIComponent(r.key)}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--viz-band)]">
                <Trophy aria-hidden className="h-4 w-4 shrink-0 text-[var(--color-amber-500)]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[var(--viz-ink)]">{r.name}</span>
                  <span className="block text-[11px] text-[var(--viz-ink-2)]">
                    {weight(r.weight, unit)} × {r.reps} · {fmtDay(r.day)}
                  </span>
                </span>
                <span className="text-right tabular-nums">
                  <span className="block text-sm font-semibold text-[var(--viz-ink)]">{Math.round(r.e1rm)}</span>
                  <span className="block text-[10px] text-[var(--viz-up)]">+{Math.max(1, Math.round(r.e1rm - r.previous))} {unit}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
