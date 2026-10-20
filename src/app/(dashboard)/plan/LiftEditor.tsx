'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Loader2, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import ExerciseThumb from '@/components/lift/ExerciseThumb';
import { loadModeNote } from '@/components/lift/format';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LiftEdit } from '@/lib/lift/edit.mjs';
import type { RichExercise, RichSession } from '@/lib/lift/session';
import { editLiftAction, liftLibraryAction } from './actions';

const ACCENT = '#fc4c02';
const cell = 'h-8 w-full rounded-md border bg-background px-2 text-right text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-muted/50 disabled:text-[var(--viz-muted)]';
const iconBtn = 'grid h-8 w-8 place-items-center rounded-md text-[var(--viz-muted)] hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30 disabled:hover:bg-transparent';

/** A number from an input, null when empty, undefined when not a number. */
/** A weight as the input shows it: to 0.1, no trailing zeros. */
const show = (v: number | null) => (v == null ? '' : String(Math.round(v * 10) / 10));

const parse = (v: string) => (v.trim() === '' ? null : Number.isFinite(Number(v.replace(',', '.'))) ? Number(v.replace(',', '.')) : undefined);

/**
 * Edits a planned Lift session in the item modal: the target weight and reps of each set, add or remove sets, move or
 * remove exercises, and add one from the Lift library. Each change saves at once through Lift sync, so the iPhone has
 * it on its next sync; logged sets stay as they are.
 */
export default function LiftEditor({ lift, onChanged, onDone }: { lift: RichSession; onChanged: () => Promise<void> | void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const unit = lift.unit;

  async function run(edits: LiftEdit[], ok?: string) {
    setBusy(true);
    try {
      const r = await editLiftAction(lift.id, edits);
      if ('error' in r) toast.error(r.error);
      else {
        await onChanged();
        if (ok) toast.success(ok);
      }
    } catch {
      toast.error('Could not save the change');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 rounded-xl border bg-muted/40 px-4 py-2.5 text-sm">
        <span className="text-[var(--viz-ink-2)]">
          Editing the session. Changes save at once and reach Lift on the next sync.
        </span>
        <span className="flex items-center gap-2">
          {busy && <Loader2 aria-label="Saving" className="h-4 w-4 animate-spin text-[var(--viz-muted)]" />}
          <Button size="sm" onClick={onDone} className="text-white hover:opacity-90" style={{ background: ACCENT }}>
            <Check aria-hidden className="mr-1 h-4 w-4" /> Done
          </Button>
        </span>
      </div>
      {lift.exercises.map((e, i) => (
        <ExerciseEditor key={e.id} e={e} unit={unit} first={i === 0} last={i === lift.exercises.length - 1} busy={busy} run={run} />
      ))}
      <AddExercise unit={unit} busy={busy} run={run} />
    </div>
  );
}

function ExerciseEditor({ e, unit, first, last, busy, run }: { e: RichExercise; unit: string; first: boolean; last: boolean; busy: boolean; run: (edits: LiftEdit[], ok?: string) => Promise<void> }) {
  const logged = e.sets.some((s) => s.status === 'done');
  const [note, setNote] = useState(e.note ?? '');
  useEffect(() => setNote(e.note ?? ''), [e.note]);
  return (
    <article className="rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <ExerciseThumb image={e.media?.image} gif={e.media?.gif} name={e.name} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-[var(--viz-ink)]">{e.name}</h3>
          <p className="text-xs text-[var(--viz-muted)]">{[loadModeNote(e.loadMode) && `Load ${loadModeNote(e.loadMode)}`, logged && 'Has logged sets'].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex shrink-0 items-center">
          <button type="button" className={iconBtn} disabled={busy || first} onClick={() => run([{ type: 'moveExercise', sessionExerciseId: e.id, dir: -1 }])} aria-label={`Move ${e.name} up`}>
            <ArrowUp aria-hidden className="h-4 w-4" />
          </button>
          <button type="button" className={iconBtn} disabled={busy || last} onClick={() => run([{ type: 'moveExercise', sessionExerciseId: e.id, dir: 1 }])} aria-label={`Move ${e.name} down`}>
            <ArrowDown aria-hidden className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={cn(iconBtn, 'hover:text-[var(--plan-missed)]')}
            disabled={busy || logged}
            title={logged ? 'It has logged sets' : undefined}
            onClick={() => run([{ type: 'removeExercise', sessionExerciseId: e.id }], `Removed ${e.name}`)}
            aria-label={`Remove ${e.name}`}
          >
            <Trash2 aria-hidden className="h-4 w-4" />
          </button>
        </div>
      </div>

      <table className="mt-3 w-full text-sm">
        <thead className="text-[11px] text-[var(--viz-muted)]">
          <tr>
            <th className="w-14 pb-1 text-left font-medium">Set</th>
            <th className="pb-1 text-right font-medium">Weight ({unit}{e.loadMode === 'bodyweight' ? ', added' : ''})</th>
            <th className="pb-1 pl-2 text-right font-medium">Reps</th>
            <th className="w-10 pb-1"><span className="sr-only">Remove</span></th>
          </tr>
        </thead>
        <tbody>
          {e.sets.map((s) => (
            <SetRow key={s.id} s={s} unit={unit} busy={busy} run={run} />
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => run([{ type: 'addSet', sessionExerciseId: e.id }])}>
          <Plus aria-hidden className="mr-1 h-3.5 w-3.5" /> Add set
        </Button>
        <input
          value={note}
          onChange={(ev) => setNote(ev.target.value)}
          onBlur={() => note.trim() !== (e.note ?? '').trim() && run([{ type: 'exerciseNote', sessionExerciseId: e.id, note }])}
          placeholder="Cue or note for this exercise"
          aria-label={`Note for ${e.name}`}
          maxLength={500}
          className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
    </article>
  );
}

function SetRow({ s, unit, busy, run }: { s: RichExercise['sets'][number]; unit: string; busy: boolean; run: (edits: LiftEdit[], ok?: string) => Promise<void> }) {
  const done = s.status === 'done';
  const reps0 = s.target.reps ?? s.target.repMin;
  const [weight, setWeight] = useState(show(s.target.weight));
  const [reps, setReps] = useState(reps0 != null ? String(reps0) : '');
  useEffect(() => setWeight(show(s.target.weight)), [s.target.weight]);
  useEffect(() => setReps(reps0 != null ? String(reps0) : ''), [reps0]);
  function save() {
    const w = parse(weight);
    const r = parse(reps);
    if (w === undefined || r === undefined) return toast.error('Type a number.');
    const edit: LiftEdit = { type: 'setTarget', setId: s.id, unit: unit as 'kg' | 'lb' };
    if (show(w) !== show(s.target.weight)) edit.weight = w;
    if (r !== reps0 && r != null) edit.reps = r;
    if ('weight' in edit || 'reps' in edit) void run([edit]);
  }
  return (
    <tr className={cn('border-t', s.kind === 'warmUp' && 'text-[var(--viz-muted)]')}>
      <td className="py-1.5 text-xs">
        {s.kind === 'warmUp' ? 'Warm-up' : `Set ${s.label}`}
        {done && <span className="ml-1 text-[var(--viz-good)]">✓</span>}
      </td>
      <td className="py-1.5">
        <input inputMode="decimal" value={weight} disabled={busy || done} onChange={(e) => setWeight(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} aria-label={`Set ${s.label} weight`} placeholder="–" className={cell} />
      </td>
      <td className="py-1.5 pl-2">
        <input inputMode="numeric" value={reps} disabled={busy || done} onChange={(e) => setReps(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} aria-label={`Set ${s.label} reps`} placeholder="–" className={cell} />
      </td>
      <td className="py-1.5 text-right">
        <button type="button" className={cn(iconBtn, 'ml-auto hover:text-[var(--plan-missed)]')} disabled={busy || done} onClick={() => run([{ type: 'removeSet', setId: s.id }])} aria-label={`Remove set ${s.label}`}>
          <X aria-hidden className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

function AddExercise({ unit, busy, run }: { unit: string; busy: boolean; run: (edits: LiftEdit[], ok?: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [lib, setLib] = useState<{ id: string; name: string; loadMode: string | null; equipment: string | null }[] | null>(null);
  const [query, setQuery] = useState('');
  const [pick, setPick] = useState<string | null>(null);
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('8');
  const [weight, setWeight] = useState('');
  useEffect(() => {
    if (open && !lib) liftLibraryAction().then(setLib, () => toast.error('Could not load the Lift library'));
  }, [open, lib]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (lib ?? []).filter((x) => !q || x.name.toLowerCase().includes(q)).slice(0, 40);
  }, [lib, query]);
  const chosen = lib?.find((x) => x.id === pick);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-3 text-sm font-medium text-[var(--viz-ink-2)] hover:border-[var(--viz-ink-2)] hover:text-[var(--viz-ink)]">
        <Plus aria-hidden className="h-4 w-4" /> Add exercise
      </button>
    );
  }
  async function add() {
    if (!chosen) return;
    const n = Number(sets);
    const r = parse(reps);
    const w = parse(weight);
    if (!(n >= 1 && n <= 10) || r === undefined || w === undefined) return toast.error('Sets 1–10; reps and weight as numbers.');
    await run([{ type: 'addExercise', exerciseId: chosen.id, sets: n, reps: r, weight: w, unit: unit as 'kg' | 'lb' }], `Added ${chosen.name}`);
    setOpen(false);
    setPick(null);
    setQuery('');
  }
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--viz-ink)]">Add exercise</h3>
        <button type="button" className={iconBtn} onClick={() => setOpen(false)} aria-label="Close">
          <X aria-hidden className="h-4 w-4" />
        </button>
      </div>
      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the Lift library" aria-label="Search the Lift library" className="h-9 w-full rounded-md border bg-background px-2.5 text-sm" />
      <ul className="max-h-48 divide-y overflow-y-auto rounded-lg border">
        {lib === null && <li className="px-3 py-2 text-sm text-muted-foreground">Loading…</li>}
        {lib && shown.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No exercises match.</li>}
        {shown.map((x) => (
          <li key={x.id}>
            <button type="button" onClick={() => setPick(x.id)} className={cn('flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent/50', pick === x.id && 'bg-accent')}>
              <span className="truncate text-[var(--viz-ink)]">{x.name}</span>
              <span className="shrink-0 text-xs text-[var(--viz-muted)]">{x.equipment ?? ''}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-[repeat(3,minmax(0,1fr))_auto] items-end gap-2">
        <label className="space-y-1 text-xs text-[var(--viz-ink-2)]">Sets<input inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} className={cell} /></label>
        <label className="space-y-1 text-xs text-[var(--viz-ink-2)]">Reps<input inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} className={cell} /></label>
        <label className="space-y-1 text-xs text-[var(--viz-ink-2)]">Weight ({unit})<input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="–" className={cell} /></label>
        <Button type="button" disabled={busy || !chosen} onClick={() => void add()} className="text-white hover:opacity-90" style={{ background: ACCENT }}>
          Add
        </Button>
      </div>
    </section>
  );
}
