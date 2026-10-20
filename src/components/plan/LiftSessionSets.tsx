import Link from 'next/link';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LiftSessionDetail } from '@/lib/plan/month';

type Exercise = LiftSessionDetail['exercises'][number];
type SetRow = Exercise['sets'][number];

const n = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 1 });

/** "8", "8–10", or "" for the planned reps. */
function targetReps(t: SetRow['target']) {
  if (t.reps != null) return String(t.reps);
  if (t.repMin != null && t.repMax != null) return t.repMin === t.repMax ? String(t.repMin) : `${t.repMin}–${t.repMax}`;
  return '';
}

/** A load as the set shows it: "230 lb", "+25 lb" (added to bodyweight), "BW", or "" with no load. */
function load(weight: number | null, loadMode: string | null, unit: string) {
  if (loadMode === 'bodyweight') return weight ? `+${n(weight)} ${unit}` : 'BW';
  return weight == null ? '' : `${n(weight)} ${unit}`;
}

function target(s: SetRow, loadMode: string | null, unit: string) {
  const reps = targetReps(s.target);
  const w = load(s.target.weight, loadMode, unit);
  if (!reps && !w) return '–';
  return [reps, w].filter(Boolean).join(' × ');
}

function logged(s: SetRow, loadMode: string | null, unit: string) {
  if (s.status === 'skipped') return 'Skipped';
  if (s.status !== 'done') return null;
  const w = load(s.weight, loadMode, unit);
  return [s.reps ?? '?', w].filter(Boolean).join(' × ');
}

/**
 * Every exercise of a Lift session with every set: the target Lift planned, and what was logged. Planned sets
 * show only the target; a logged set shows the reps and load done next to it.
 */
export default function LiftSessionSets({ lift, compact = false }: { lift: LiftSessionDetail; compact?: boolean }) {
  const unit = lift.unit;
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-[var(--viz-ink)]">Lift: {lift.title || 'Lift session'}</span>
        <span className="tabular-nums text-[var(--viz-muted)]">
          {lift.setsLogged} / {lift.setsTotal} sets logged
        </span>
      </div>
      <ol className="space-y-2.5">
        {lift.exercises.map((e) => (
          <li key={e.id} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <Link
                href={`/lift/exercises/${encodeURIComponent(e.key)}`}
                className="truncate text-xs font-semibold text-[var(--viz-ink)] hover:underline"
              >
                {e.name}
              </Link>
              <span className="shrink-0 text-[11px] text-[var(--viz-muted)]">
                {e.loadMode === 'perHand' ? 'each hand' : e.loadMode === 'perSide' ? 'each side' : ''}
              </span>
            </div>
            <table className="w-full text-xs tabular-nums">
              <tbody>
                {e.sets.map((s) => {
                  const done = logged(s, e.loadMode, unit);
                  return (
                    <tr key={s.id} className={cn(s.kind === 'warmUp' && 'text-[var(--viz-muted)]')}>
                      <td className="w-6 py-0.5 text-[var(--viz-muted)]" title={s.kind === 'warmUp' ? 'Warm-up' : undefined}>
                        {s.label}
                      </td>
                      <td className="py-0.5 text-[var(--viz-ink-2)]">{target(s, e.loadMode, unit)}</td>
                      <td
                        className={cn(
                          'py-0.5 text-right',
                          s.status === 'done' ? 'font-medium text-[var(--viz-ink)]' : 'text-[var(--viz-muted)]'
                        )}
                      >
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
            {!compact && e.note && <p className="text-[11px] leading-snug text-[var(--viz-muted)]">{e.note}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
