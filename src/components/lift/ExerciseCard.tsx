import Link from 'next/link';
import { Check, History, Timer, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RichExercise, RichSet } from '@/lib/lift/session';
import ExerciseThumb from './ExerciseThumb';
import Sparkline from './Sparkline';
import { loadModeNote, loadText, muscleLabel, num, repsText, restText } from './format';

const shortDay = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** The heaviest target load of the working sets, to compare with last time. */
function topTarget(e: RichExercise) {
  const loads = e.sets.filter((s) => s.kind !== 'warmUp' && s.target.weight != null).map((s) => s.target.weight as number);
  return loads.length ? Math.max(...loads) : null;
}

function SetTile({ s, loadMode, unit }: { s: RichSet; loadMode: string | null; unit: string }) {
  const reps = repsText(s.target);
  const load = loadText(s.target.weight, loadMode, unit);
  const target = [load, reps && `× ${reps}`].filter(Boolean).join(' ') || '–';
  const done = s.status === 'done';
  const skipped = s.status === 'skipped';
  const loggedLoad = loadText(s.weight, loadMode, unit);
  const beatTarget = done && s.weight != null && s.target.weight != null && s.weight > s.target.weight;
  return (
    <li
      className={cn(
        'flex min-w-0 flex-col gap-0.5 rounded-lg border px-3 py-2 tabular-nums',
        done && 'border-[color-mix(in_oklab,var(--viz-good)_45%,transparent)] bg-[color-mix(in_oklab,var(--viz-good)_7%,transparent)]',
        skipped && 'opacity-60',
        s.kind === 'warmUp' && 'border-dashed'
      )}
    >
      <span className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-[var(--viz-muted)]">
        {s.kind === 'warmUp' ? 'Warm-up' : `Set ${s.label}`}
        {done && <Check aria-label="Logged" className="h-3.5 w-3.5 text-[var(--viz-good)]" />}
        {skipped && <span className="normal-case tracking-normal">Skipped</span>}
      </span>
      {done ? (
        <>
          <span className="truncate text-sm font-semibold text-[var(--viz-ink)]">
            {[loggedLoad, `× ${s.reps ?? '?'}`].filter(Boolean).join(' ')}
            {beatTarget && <span className="ml-1 text-xs font-medium text-[var(--viz-up)]">↑</span>}
          </span>
          <span className="truncate text-[11px] text-[var(--viz-muted)]">target {target}</span>
        </>
      ) : (
        <span className={cn('truncate text-sm font-semibold', skipped ? 'text-[var(--viz-muted)] line-through' : 'text-[var(--viz-ink-2)]')}>{target}</span>
      )}
      {s.note && <span className="truncate text-[11px] text-[var(--viz-muted)]" title={s.note}>{s.note}</span>}
    </li>
  );
}

/**
 * One exercise of a Lift session: the catalog picture (the animation on hover), the muscles, the cue, one tile per
 * set with its target and what was logged, and what came before (last session, best estimated 1RM, trend).
 */
export default function ExerciseCard({ e, unit, index }: { e: RichExercise; unit: string; index: number }) {
  const h = e.history;
  const top = topTarget(e);
  const lastTop = h.last ? Math.max(...h.last.sets.map((s) => s.weight ?? 0)) : null;
  const delta = top != null && lastTop ? top - lastTop : null;
  const working = e.sets.filter((s) => s.kind !== 'warmUp');
  const media = e.media;
  const muscles = [...new Set([...(e.primary.length ? e.primary : media?.target ? [media.target] : [])])];
  const secondary = e.secondary.length ? e.secondary : (media?.secondary ?? []);
  const rest = restText(e.restSeconds);
  // An estimated 1RM from the added load alone (weighted pull-ups) means nothing, so bodyweight work shows none.
  const showE1rm = e.loadMode !== 'bodyweight';
  return (
    <article id={`ex-${e.id}`} className="scroll-mt-24 overflow-hidden rounded-xl border bg-card">
      <div className="grid gap-5 p-4 sm:grid-cols-[9rem_1fr] sm:p-5">
        <div className="flex items-start gap-3 sm:block">
          <ExerciseThumb image={media?.image} gif={media?.gif} name={e.name} size="lg" className="hidden sm:block" />
          <ExerciseThumb image={media?.image} gif={media?.gif} name={e.name} size="md" className="sm:hidden" />
          <div className="sm:hidden">
            <Header e={e} index={index} />
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="hidden sm:block">
            <Header e={e} index={index} />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            {muscles.map((m) => (
              <span key={m} className="rounded-full px-2 py-0.5 font-medium text-white" style={{ background: 'var(--sport-strength)' }}>
                {muscleLabel(m)}
              </span>
            ))}
            {secondary.map((m) => (
              <span key={m} className="rounded-full border px-2 py-0.5 text-[var(--viz-ink-2)]">
                {muscleLabel(m)}
              </span>
            ))}
            {(e.equipment ?? media?.equipment) && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[var(--viz-ink-2)]">{muscleLabel(String(e.equipment ?? media?.equipment))}</span>
            )}
            {loadModeNote(e.loadMode) && <span className="rounded-full bg-muted px-2 py-0.5 text-[var(--viz-ink-2)]">Load {loadModeNote(e.loadMode)}</span>}
            {rest && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[var(--viz-ink-2)]">
                <Timer aria-hidden className="h-3 w-3" /> {rest}
              </span>
            )}
          </div>

          {e.note && <p className="border-l-2 pl-3 text-sm text-[var(--viz-ink-2)]" style={{ borderColor: 'var(--sport-strength)' }}>{e.note}</p>}

          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {e.sets.map((s) => (
              <SetTile key={s.id} s={s} loadMode={e.loadMode} unit={unit} />
            ))}
          </ol>

          <div className="grid gap-3 rounded-lg bg-muted/50 p-3 text-xs sm:grid-cols-[1fr_auto]">
            <div className="min-w-0 space-y-1.5">
              <p className="flex items-center gap-1.5 font-medium text-[var(--viz-ink)]">
                <History aria-hidden className="h-3.5 w-3.5 text-[var(--viz-muted)]" />
                {h.last ? (
                  <>
                    Last time · <Link href={`/lift/sessions/${h.last.sessionId}`} className="hover:underline">{shortDay(h.last.day)}</Link>
                    {delta != null && delta !== 0 && (
                      <span className={cn('ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums', delta > 0 ? 'bg-[color-mix(in_oklab,var(--viz-up)_12%,transparent)] text-[var(--viz-up)]' : 'bg-muted text-[var(--viz-ink-2)]')}>
                        {delta > 0 ? '+' : '−'}{num(Math.abs(delta))} {unit} vs last
                      </span>
                    )}
                  </>
                ) : (
                  'First time logged'
                )}
              </p>
              {h.last && (
                <p className="flex flex-wrap gap-1 tabular-nums">
                  {h.last.sets.map((s, i) => (
                    <span key={i} className="rounded border bg-background px-1.5 py-0.5 text-[var(--viz-ink-2)]">
                      {loadText(s.weight, e.loadMode, unit) || '–'} × {s.reps ?? '?'}
                    </span>
                  ))}
                </p>
              )}
              {showE1rm && h.best && (
                <p className="flex items-center gap-1.5 text-[var(--viz-ink-2)]">
                  <Trophy aria-hidden className="h-3.5 w-3.5 text-[var(--viz-muted)]" />
                  Best estimated 1RM <span className="font-semibold tabular-nums text-[var(--viz-ink)]">{num(h.best.e1rm, 0)} {unit}</span>
                  <span className="text-[var(--viz-muted)]">({shortDay(h.best.day)})</span>
                </p>
              )}
            </div>
            {showE1rm && h.trend.length >= 2 && (
              <Link href={`/lift/exercises/${encodeURIComponent(e.key)}`} className="flex flex-col items-start gap-0.5 sm:items-end" title="Estimated 1RM per session">
                <Sparkline values={h.trend.map((p) => p.e1rm)} label={`Estimated 1RM over the last ${h.trend.length} sessions`} />
                <span className="text-[10px] text-[var(--viz-muted)]">e1RM · last {h.trend.length} sessions</span>
              </Link>
            )}
          </div>

          {media && media.steps.length > 0 && (
            <details className="group text-xs">
              <summary className="cursor-pointer select-none text-[var(--viz-ink-2)] hover:text-[var(--viz-ink)]">How to do it</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-[var(--viz-ink-2)]">
                {media.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </details>
          )}
          <p className="sr-only">
            {working.filter((s) => s.status === 'done').length} of {working.length} working sets logged
          </p>
        </div>
      </div>
    </article>
  );
}

function Header({ e, index }: { e: RichExercise; index: number }) {
  const working = e.sets.filter((s) => s.kind !== 'warmUp');
  const logged = working.filter((s) => s.status === 'done').length;
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--viz-muted)]">Exercise {index + 1}</p>
        <h3 className="truncate text-lg font-semibold text-[var(--viz-ink)]">
          <Link href={`/lift/exercises/${encodeURIComponent(e.key)}`} className="hover:underline">
            {e.name}
          </Link>
        </h3>
      </div>
      <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs tabular-nums text-[var(--viz-ink-2)]">
        {logged}/{working.length} sets
      </span>
    </div>
  );
}
