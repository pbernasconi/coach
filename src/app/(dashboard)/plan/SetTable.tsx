'use client';

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { LIFT_MARKER } from '@/lib/plan/lift-plan.mjs';
import { strengthExercises, strengthNotes } from '@/lib/plan/strength-text.mjs';
import type { CalendarWorkout } from '@/lib/plan/month';
import { editLiftAction, logPlanSetAction } from './actions';

type Line = { name: string; sets: number; reps: number; repsMax: number | null; note: string | null };
type Row = { id: string | null; target: number | null; status: string; reps: number | null; weight: number | null; targetWeight: number | null };
type Exercise = { name: string; note: string | null; weighted: boolean; rows: Row[] };

/** "3 × 12", or the targets in a list when they differ. */
function plan(e: Exercise) {
  const t = e.rows.map((r) => r.target ?? '–');
  return t.every((x) => x === t[0]) ? `${t.length} × ${t[0]}` : t.join(', ');
}

/** The coach's part of the description (above the Lift copy of the sets). */
const coachText = (w: CalendarWorkout) => (w.description ?? '').split(LIFT_MARKER)[0].trim();

/** The exercise lines of a strength workout written as text ("1) Standing calf raise 3x15: …"), or none. */
export function textLines(w: CalendarWorkout): Line[] {
  if (w.steps || w.sport !== 'strength') return [];
  return strengthExercises(coachText(w)) as Line[];
}

/**
 * A strength workout written as text (a home session): the workout window shows its sets as a table to log, not a
 * Lift session page. A gym session (its Lift session has weights to lift) keeps the Lift page.
 */
export const isTextSession = (w: CalendarWorkout) =>
  textLines(w).length > 0 && !w.lift?.exercises.some((e) => e.sets.some((s) => s.target.weight != null && s.target.weight > 0));

/** The coach's notes without the exercise lines the table shows. */
export const textNotes = (w: CalendarWorkout) => strengthNotes(coachText(w)) as string | null;

/** The table's exercises: the linked Lift session's sets once it exists, else the coach's lines (nothing logged). */
function exercisesOf(w: CalendarWorkout): Exercise[] {
  if (w.lift) {
    return w.lift.exercises.map((e) => {
      const rows = e.sets
        .filter((s) => s.kind !== 'warmUp')
        .map((s) => ({ id: s.id, target: s.target.reps ?? s.target.repMax ?? s.target.repMin, status: s.status, reps: s.reps, weight: s.weight, targetWeight: s.target.weight }));
      return { name: e.name, note: e.note, weighted: e.loadMode !== 'bodyweight' && rows.some((r) => r.targetWeight != null || r.weight != null), rows };
    });
  }
  return textLines(w).map((l) => ({
    name: l.name,
    note: l.note,
    weighted: false,
    rows: Array.from({ length: l.sets }, () => ({ id: null, target: l.repsMax ?? l.reps, status: 'planned', reps: null, weight: null, targetWeight: null })),
  }));
}

/** Logged and planned working sets, for the window's numbers. */
export function setCounts(w: CalendarWorkout) {
  const rows = exercisesOf(w).flatMap((e) => e.rows);
  const done = rows.filter((r) => r.status === 'done');
  return { done: done.length, total: rows.length, reps: done.reduce((n, r) => n + (r.reps ?? 0), 0) };
}

const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

/**
 * The sets of a home session, one table per exercise: target, the reps done (the target until changed) and a check
 * that logs the set. A logged set's check un-logs it; changing its reps logs it again. The first log makes the
 * workout's Lift session, so the phone has it too. `onChanged` loads the day again.
 */
export default function SetTable({ w, loggable, onChanged }: { w: CalendarWorkout; loggable: boolean; onChanged?: (date: string) => Promise<void> | void }) {
  const exercises = exercisesOf(w);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, call: () => Promise<{ ok: true } | { error: string }>) {
    setBusy(key);
    try {
      const r = await call();
      if ('error' in r) toast.error(r.error);
      else await onChanged?.(w.date);
    } catch {
      toast.error('Could not save the set');
    } finally {
      setBusy(null);
    }
  }
  const log = (ei: number, si: number, row: Row, reps: number, weight?: number | null) =>
    run(`${ei}:${si}`, () => logPlanSetAction(w.id, row.id ? { setId: row.id } : { exercise: ei, set: si }, { reps, ...(weight !== undefined && { weight }) }));
  const unlog = (ei: number, si: number, row: Row) =>
    w.lift && row.id ? run(`${ei}:${si}`, () => editLiftAction(w.lift!.id, [{ type: 'unlogSet', setId: row.id! }])) : undefined;

  return (
    <div className="space-y-5">
      {exercises.map((e, ei) => {
        const done = e.rows.filter((r) => r.status === 'done').length;
        return (
          <section key={ei}>
            <div className="flex items-baseline justify-between gap-3">
              <h4 className="min-w-0 truncate text-sm font-semibold text-[var(--viz-ink)]">
                <span className="mr-2 tabular-nums text-[var(--viz-muted)]">{ei + 1}</span>
                {e.name}
                <span className="ml-2 font-normal tabular-nums text-[var(--viz-ink-2)]">{plan(e)}</span>
              </h4>
              <span className={cn('shrink-0 text-xs tabular-nums', done === e.rows.length ? 'font-medium text-[var(--viz-good)]' : done ? 'text-[var(--viz-ink-2)]' : 'text-[var(--viz-muted)]')}>
                {done}/{e.rows.length}
              </span>
            </div>
            {e.note && <p className="mt-0.5 pl-5 text-xs text-[var(--viz-muted)]">{e.note}</p>}
            <table className="mt-1.5 w-full text-sm tabular-nums">
              <thead className="text-[11px] text-[var(--viz-muted)]">
                <tr>
                  <th className="w-12 pb-1 pl-5 text-left font-medium">Set</th>
                  <th className="w-24 pb-1 text-left font-medium">Reps</th>
                  {e.weighted && <th className="w-24 pb-1 text-left font-medium">Weight ({w.lift?.unit ?? 'lb'})</th>}
                  <th className="pb-1">
                    <span className="sr-only">Logged</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {e.rows.map((r, si) => (
                  <SetRow
                    // A new key when the set is logged or un-logged starts the row's inputs from the saved values.
                    key={`${r.id ?? si}:${r.status}:${r.reps}`}
                    n={si + 1}
                    row={r}
                    weighted={e.weighted}
                    loggable={loggable}
                    busy={busy === `${ei}:${si}`}
                    locked={busy != null}
                    onLog={(reps, weight) => log(ei, si, r, reps, weight)}
                    onUnlog={() => unlog(ei, si, r)}
                  />
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}

function SetRow({ n, row, weighted, loggable, busy, locked, onLog, onUnlog }: { n: number; row: Row; weighted: boolean; loggable: boolean; busy: boolean; locked: boolean; onLog: (reps: number, weight?: number | null) => void; onUnlog: () => void }) {
  const done = row.status === 'done';
  const [reps, setReps] = useState(done && row.reps != null ? String(row.reps) : '');
  const [weight, setWeight] = useState(row.weight != null ? String(row.weight) : row.targetWeight != null ? String(row.targetWeight) : '');
  const value = () => {
    const r = num(reps) ?? row.target;
    if (r == null || !Number.isInteger(r) || r < 1 || r > 200) return null;
    return r;
  };
  const submit = () => {
    const r = value();
    if (r == null) return toast.error('Reps must be a whole number from 1 to 200.');
    const wt = weighted ? num(weight) : undefined;
    onLog(r, wt != null && Number.isFinite(wt) ? wt : weighted ? null : undefined);
  };
  // A logged set whose reps were changed logs again with the new number.
  const relog = () => done && num(reps) != null && num(reps) !== row.reps && submit();
  const box =
    'h-7 w-16 rounded-md border bg-background px-2 text-sm tabular-nums placeholder:text-[var(--viz-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:border-transparent disabled:bg-transparent disabled:px-0';
  return (
    <tr className={cn('border-t transition-colors', done && 'bg-[color-mix(in_oklab,var(--viz-good)_7%,transparent)]')}>
      <td className="py-1 pl-5 text-[var(--viz-muted)]">{n}</td>
      <td className="py-1">
        <input
          inputMode="numeric"
          value={reps}
          placeholder={row.target != null ? String(row.target) : '–'}
          disabled={!loggable || locked}
          onChange={(e) => setReps(e.target.value)}
          onBlur={relog}
          onKeyDown={(e) => e.key === 'Enter' && (done ? e.currentTarget.blur() : submit())}
          aria-label={`Set ${n} reps`}
          className={cn(box, done && 'font-semibold text-[var(--viz-ink)]')}
        />
      </td>
      {weighted && (
        <td className="py-1">
          <input inputMode="decimal" value={weight} disabled={!loggable || locked || done} onChange={(e) => setWeight(e.target.value)} aria-label={`Set ${n} weight`} placeholder="–" className={box} />
        </td>
      )}
      <td className="py-1 pr-1 text-right">
        {loggable && (
          <button
            type="button"
            onClick={() => (done ? onUnlog() : submit())}
            disabled={locked}
            aria-pressed={done}
            aria-label={done ? `Un-log set ${n}` : `Log set ${n}`}
            title={done ? 'Logged. Click to un-log' : 'Log this set'}
            className={cn(
              'ml-auto grid h-7 w-7 place-items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
              done ? 'border-[var(--viz-good)] bg-[var(--viz-good)] text-white' : 'text-[var(--viz-muted)] hover:border-[var(--viz-good)] hover:text-[var(--viz-good)]'
            )}
          >
            {busy ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : <Check aria-hidden className="h-3.5 w-3.5" />}
          </button>
        )}
      </td>
    </tr>
  );
}
