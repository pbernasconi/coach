'use client';

import type { ReactNode } from 'react';
import ExerciseCard from '@/components/lift/ExerciseCard';
import ExerciseThumb from '@/components/lift/ExerciseThumb';
import { loadText, muscleLabel, repsText } from '@/components/lift/format';
import { plannedVolume, sessionMuscles, type RichExercise, type RichSession } from '@/lib/lift/session';

// The Lift session in the item modal, planned or done: the session page's exercise cards (picture, muscles, sets,
// last time, best estimated 1RM), with a side column for the session at a glance and the muscles it works.

/** The big numbers for a Lift session. */
export function liftStats(lift: RichSession) {
  const working = lift.exercises.flatMap((e) => e.sets.filter((s) => s.kind !== 'warmUp'));
  const planned = plannedVolume(lift);
  return {
    exercises: lift.exercises.length,
    workingSets: working.length,
    plannedVolume: planned,
    reps: working.reduce((n, s) => n + (s.status === 'done' ? (s.reps ?? 0) : 0), 0),
  };
}

/** "3 × 8 · 230 lb" for an exercise's working sets, or a list when they differ. */
function summary(e: RichExercise, unit: string) {
  const working = e.sets.filter((s) => s.kind !== 'warmUp');
  if (!working.length) return '–';
  const texts = working.map((s) => [repsText(s.target), loadText(s.target.weight, e.loadMode, unit)].filter(Boolean).join(' · ') || '–');
  return texts.every((t) => t === texts[0]) ? `${working.length} × ${texts[0]}` : texts.join(', ');
}

function Side({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border p-4">
      <h3 className="mb-3 text-sm font-semibold text-[var(--viz-ink)]">{title}</h3>
      {children}
    </section>
  );
}

/** Scrolls the modal to an exercise card. */
const jump = (id: string) => document.getElementById(`ex-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

export default function LiftView({ lift, extra }: { lift: RichSession; extra?: ReactNode }) {
  const unit = lift.unit;
  const muscles = sessionMuscles(lift).slice(0, 8);
  const top = Math.max(1, ...muscles.map((m) => m.sets));
  return (
    <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
      <div className="min-w-0 space-y-3">
        {lift.exercises.length === 0 && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No exercises in this session.</p>}
        {lift.exercises.map((e, i) => (
          <ExerciseCard key={e.id} e={e} unit={unit} index={i} />
        ))}
      </div>
      <aside className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:self-start">
        <Side title="At a glance">
          <ol className="space-y-1">
            {lift.exercises.map((e, i) => {
              const working = e.sets.filter((s) => s.kind !== 'warmUp');
              const done = working.filter((s) => s.status === 'done').length;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => jump(e.id)}
                    className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ExerciseThumb image={e.media?.image} gif={e.media?.gif} name={e.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-[var(--viz-ink)]">
                        <span className="mr-1 tabular-nums text-[var(--viz-muted)]">{i + 1}</span>
                        {e.name}
                      </span>
                      <span className="block truncate text-[11px] tabular-nums text-[var(--viz-ink-2)]">{summary(e, unit)}</span>
                    </span>
                    {done > 0 && <span className="shrink-0 text-[11px] tabular-nums text-[var(--viz-muted)]">{done}/{working.length}</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </Side>
        {muscles.length > 0 && (
          <Side title="Muscles">
            <ul className="space-y-1.5">
              {muscles.map((m) => (
                <li key={m.muscle} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2 text-xs">
                  <span className="truncate text-[var(--viz-ink-2)]">{muscleLabel(m.muscle)}</span>
                  <span className="h-2 rounded-full bg-muted">
                    <span className="block h-full rounded-full" style={{ width: `${(m.sets / top) * 100}%`, background: 'var(--sport-strength)' }} />
                  </span>
                  <span className="text-right tabular-nums text-[var(--viz-ink)]">{m.sets % 1 ? m.sets.toFixed(1) : m.sets} sets</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-[var(--viz-muted)]">Working sets; a secondary muscle counts half.</p>
          </Side>
        )}
        {extra}
      </aside>
    </div>
  );
}
