import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { changeText, isNewBest, liftBestText, liftLastText } from '@/lib/lift-dashboard/text.mjs';
import ExerciseThumb from '@/components/lift/ExerciseThumb';
import LiftChart from './LiftChart';
import type { MainLift } from './types';

/** The most-done lifts of the last 12 weeks: estimated 1RM, its change, the best ever, and the last top set. */
export default function MainLifts({ lifts, unit, today }: { lifts: MainLift[]; unit: string; today: string }) {
  return (
    <section className="rounded-xl border bg-card" aria-labelledby="main-lifts">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <h2 id="main-lifts" className="font-semibold">Main lifts</h2>
        <span className="text-xs text-[var(--viz-muted)]">estimated 1RM per session · hover for the top set, click to open it</span>
      </div>
      {lifts.length === 0 ? (
        <p className="p-4 text-sm text-[var(--viz-muted)]">No lifts in the last 12 weeks.</p>
      ) : (
        <div className="grid sm:grid-cols-2">
          {lifts.map((l, i) => {
            const isPr = isNewBest(l, today);
            return (
              <div
                key={l.key}
                className={`flex min-w-0 flex-col gap-3 p-4 ${i % 2 ? 'sm:border-l' : ''} ${i > 0 ? 'border-t' : ''} ${i === 1 ? 'sm:border-t-0' : ''}`}
              >
                <Link href={`/lift/exercises/${encodeURIComponent(l.key)}`} className="group flex items-center gap-3">
                  <ExerciseThumb image={l.image} gif={l.gif} name={l.name} size="sm" className="transition group-hover:ring-2 group-hover:ring-[var(--sport-strength)]" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-[var(--viz-ink)] group-hover:underline">{l.name}</span>
                      {isPr ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--color-amber-500)_18%,transparent)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-amber-600)] dark:text-[var(--color-amber-400)]">
                          <Trophy aria-hidden className="h-3 w-3" /> New best
                        </span>
                      ) : (
                        <span className="shrink-0 text-[11px] text-[var(--viz-muted)]">{l.sessions} sessions</span>
                      )}
                    </span>
                    <span className="flex items-baseline gap-2 tabular-nums">
                      <b className="text-2xl font-semibold tracking-tight text-[var(--viz-ink)]">{l.latest ? Math.round(l.latest.e1rm) : '–'}</b>
                      <span className="text-sm text-[var(--viz-muted)]">{unit} e1RM</span>
                      {l.change !== null && (
                        <span className={`text-xs font-medium ${l.change >= 0 ? 'text-[var(--viz-up)]' : 'text-[var(--viz-down)]'}`}>
                          {changeText(l.change)}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
                <LiftChart points={l.points} best={l.best?.e1rm ?? null} unit={unit} name={l.name} />
                <div className="flex justify-between gap-2 text-[11px] text-[var(--viz-ink-2)]">
                  <span className="truncate">{liftLastText(l.latest, unit)}</span>
                  <span className="shrink-0 tabular-nums">{liftBestText(l.best, today.slice(0, 4))}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
