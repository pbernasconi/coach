import Link from 'next/link';
import { Check } from 'lucide-react';
import ExerciseThumb from '@/components/lift/ExerciseThumb';
import { loadModeNote, loadText, repsText } from '@/components/lift/format';
import { cn } from '@/lib/utils';
import type { LiftSessionDetail } from '@/lib/plan/month';

type SetRow = LiftSessionDetail['exercises'][number]['sets'][number];

function target(s: SetRow, loadMode: string | null, unit: string) {
  const reps = repsText(s.target);
  const w = loadText(s.target.weight, loadMode, unit);
  if (!reps && !w) return '–';
  return [w, reps && `× ${reps}`].filter(Boolean).join(' ');
}

function logged(s: SetRow, loadMode: string | null, unit: string) {
  if (s.status === 'skipped') return 'Skipped';
  if (s.status !== 'done') return null;
  return [loadText(s.weight, loadMode, unit), `× ${s.reps ?? '?'}`].filter(Boolean).join(' ');
}

/**
 * Every exercise of a Lift session in the plan preview: its picture, and every set with the target Lift planned and
 * what was logged. The full session page (/lift/sessions/<id>) shows the same data with history.
 */
export default function LiftSessionSets({ lift }: { lift: LiftSessionDetail }) {
  const unit = lift.unit;
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-[var(--viz-ink)]">Lift: {lift.title || 'Lift session'}</span>
        <span className="tabular-nums text-[var(--viz-muted)]">
          {lift.setsLogged} / {lift.setsTotal} sets logged
        </span>
      </div>
      <ol className="space-y-3">
        {lift.exercises.map((e) => (
          <li key={e.id} className="flex gap-2.5">
            <ExerciseThumb image={e.media?.image} gif={e.media?.gif} name={e.name} size="sm" />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <Link href={`/lift/exercises/${encodeURIComponent(e.key)}`} className="truncate text-xs font-semibold text-[var(--viz-ink)] hover:underline">
                  {e.name}
                </Link>
                <span className="shrink-0 text-[11px] text-[var(--viz-muted)]">{loadModeNote(e.loadMode)}</span>
              </div>
              <table className="w-full text-xs tabular-nums">
                <tbody>
                  {e.sets.map((s) => {
                    const done = logged(s, e.loadMode, unit);
                    return (
                      <tr key={s.id} className={cn(s.kind === 'warmUp' && 'text-[var(--viz-muted)]')}>
                        <td className="w-5 py-0.5 text-[var(--viz-muted)]" title={s.kind === 'warmUp' ? 'Warm-up' : undefined}>{s.label}</td>
                        <td className="py-0.5 text-[var(--viz-ink-2)]">{target(s, e.loadMode, unit)}</td>
                        <td className={cn('py-0.5 text-right', s.status === 'done' ? 'font-medium text-[var(--viz-ink)]' : 'text-[var(--viz-muted)]')}>
                          {done ? (
                            <span className="inline-flex items-center gap-1">
                              {s.status === 'done' && <Check aria-hidden className="h-3 w-3 text-[var(--viz-good)]" />}
                              {done}
                            </span>
                          ) : (
                            '–'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
