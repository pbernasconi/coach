'use client';

import { useState, type ReactNode } from 'react';
import { HelpTooltip } from '@kobo/web';
import { Info, Pencil } from 'lucide-react';
import ExerciseCard from '@/components/lift/ExerciseCard';
import ExerciseThumb from '@/components/lift/ExerciseThumb';
import { loadText, muscleLabel, repsText } from '@/components/lift/format';
import { plannedVolume, sessionMuscles, sessionState, type RichExercise, type RichSession } from '@/lib/lift/session';
import type { LogSet } from '@/components/lift/LogSetForm';
import LiftEditor from './LiftEditor';

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

function Side({ title, help, children }: { title: string; help?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border p-4">
      <h3 className="mb-3 flex items-center gap-1 text-sm font-semibold text-[var(--viz-ink)]">
        {title}
        {help && <HelpTooltip label={`About ${title}`} icon={<Info aria-hidden />}>{help}</HelpTooltip>}
      </h3>
      {children}
    </section>
  );
}

/** Scrolls the modal to an exercise card. */
const jump = (id: string) => document.getElementById(`ex-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/**
 * `onUnlog`: un-logs a logged or skipped set (a tap logged by mistake); `unlogging` is the set being saved.
 * `onLog`: logs a planned set from here (a session done without the phone).
 */
export default function LiftView({ lift, extra, onChanged, onUnlog, unlogging = null, onLog }: { lift: RichSession; extra?: ReactNode; onChanged?: () => Promise<void> | void; onUnlog?: (setId: string) => void; unlogging?: string | null; onLog?: LogSet }) {
  const unit = lift.unit;
  const [editing, setEditing] = useState(false);
  // A finished session is edited in Lift; a planned or started one can change here (logged sets stay).
  const editable = Boolean(onChanged) && sessionState(lift) !== 'done';
  const muscles = sessionMuscles(lift).slice(0, 8);
  const top = Math.max(1, ...muscles.map((m) => m.sets));
  return (
    <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
      <div className="min-w-0 space-y-3">
        {editing && onChanged ? (
          <LiftEditor lift={lift} onChanged={onChanged} onDone={() => setEditing(false)} />
        ) : (
          <>
            {editable && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Pencil aria-hidden className="h-3.5 w-3.5" /> Edit session
                </button>
              </div>
            )}
            {lift.exercises.length === 0 && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No exercises in this session.</p>}
            {lift.exercises.map((e, i) => (
              <ExerciseCard key={e.id} e={e} unit={unit} index={i} onUnlog={onUnlog} unlogging={unlogging} onLog={onLog} />
            ))}
          </>
        )}
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
          <Side title="Muscles" help="Working sets; a secondary muscle counts half.">
            <ul className="space-y-1.5">
              {muscles.map((m) => (
                <li key={m.muscle} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-2 text-xs">
                  <span className="truncate text-[var(--viz-ink-2)]">{muscleLabel(m.muscle)}</span>
                  <span className="h-2 rounded-full bg-muted">
                    <span className="block h-full rounded-full" style={{ width: `${(m.sets / top) * 100}%`, background: 'var(--sport-strength)' }} />
                  </span>
                  <span className="whitespace-nowrap text-right tabular-nums text-[var(--viz-ink)]">{m.sets % 1 ? m.sets.toFixed(1) : m.sets} sets</span>
                </li>
              ))}
            </ul>
          </Side>
        )}
        {extra}
      </aside>
    </div>
  );
}
