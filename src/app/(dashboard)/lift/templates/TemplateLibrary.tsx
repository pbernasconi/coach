'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import ExerciseThumb from '@/components/lift/ExerciseThumb';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TemplateSlotView, TemplateView } from '@/lib/lift/templates';
import { REST_CHOICES, repsLabel, restLabel, type TemplateEdit } from '@/lib/lift/templates.mjs';
import { editTemplateAction } from './actions';

const input =
  'h-8 w-full rounded-md border bg-background px-2 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';
const iconBtn =
  'grid h-8 w-8 place-items-center rounded-md text-[var(--viz-muted)] hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30 disabled:hover:bg-transparent';
/** # · exercise · sets × reps · load · rest (· the edit buttons). */
const COLS = 'grid grid-cols-[1.5rem_minmax(0,1fr)_5.5rem_5.5rem_3.5rem] items-center gap-x-3';
const EDIT_COLS = 'grid grid-cols-[1.5rem_minmax(0,1fr)_4rem_5rem_5.5rem_5.5rem_6.5rem] items-start gap-x-2';

const dayText = (day: string) =>
  new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));

/** "1:30" for a rest choice; "None" for 0. */
const restOption = (s: number) => (s ? restLabel(s) : 'None');

/** Sends one edit; a problem shows as a toast. Returns whether it saved. */
async function send(edit: TemplateEdit): Promise<boolean> {
  try {
    const r = await editTemplateAction(edit);
    if ('error' in r) {
      toast.error(r.error);
      return false;
    }
    return true;
  } catch {
    toast.error('Could not save the change');
    return false;
  }
}

/**
 * The template library: each Lift template as a card with every exercise (sets × reps, load, rest, cue) and the
 * lifts planned on it. Edit turns a card into a form that saves each change at once, through Lift sync, so the
 * iPhone has it on its next sync and the lifts that have not started are planned again.
 */
export default function TemplateLibrary({ templates, library, today }: { templates: TemplateView[]; library: { id: string; name: string }[]; today: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--viz-ink-2)]">
        {templates.length} templates. The coach plans each lift from one; a change here reaches the iPhone on its next sync and re-plans the lifts that haven&apos;t started.
      </p>
      <div className="grid items-start gap-4 xl:grid-cols-2">
        {templates.map((t) => (
          <TemplateCard
            key={t.id}
            t={t}
            today={today}
            library={library}
            editing={editing === t.id}
            onEdit={() => setEditing(t.id)}
            onDone={() => setEditing(null)}
          />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({ t, today, library, editing, onEdit, onDone }: {
  t: TemplateView;
  today: string;
  library: { id: string; name: string }[];
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const run = (edit: TemplateEdit, ok?: string) =>
    start(async () => {
      if ((await send(edit)) && ok) toast.success(ok);
    });
  const sets = t.slots.reduce((n, s) => n + s.sets, 0);
  const next = t.planned[0];
  const size = `${t.slots.length} ${t.slots.length === 1 ? 'exercise' : 'exercises'} · ${sets} sets`;

  return (
    <article className={cn('rounded-xl border bg-card', editing && 'ring-2 ring-brand/40 xl:col-span-2')} aria-label={t.name}>
      <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <NameField t={t} pending={pending} run={run} />
          ) : (
            <h2 className="truncate text-lg font-semibold text-[var(--viz-ink)]">{t.name}</h2>
          )}
          <p className="mt-0.5 text-xs text-[var(--viz-muted)]">
            {size}
            {next ? (
              <>
                {' · Next '}
                <Link href={`/plan?week=${next.day}`} className="underline-offset-2 hover:underline">
                  {next.day === today ? 'today' : dayText(next.day)}
                </Link>
                {t.planned.length > 1 && ` (+${t.planned.length - 1} in 4 weeks)`}
              </>
            ) : (
              ' · Not planned in the next 4 weeks'
            )}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          {pending && <Loader2 aria-label="Saving" className="h-4 w-4 animate-spin text-[var(--viz-muted)]" />}
          {editing ? (
            <Button size="sm" onClick={onDone}>
              <Check aria-hidden className="mr-1 h-4 w-4" /> Done
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={onEdit} aria-label={`Edit ${t.name}`}>
              <Pencil aria-hidden className="mr-1 h-3.5 w-3.5" /> Edit
            </Button>
          )}
        </span>
      </header>

      {editing ? (
        <div className="px-4 py-3">
          <div className={cn(EDIT_COLS, 'pb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--viz-muted)]')}>
            <span />
            <span>Exercise</span>
            <span className="text-right">Sets</span>
            <span className="text-right">Reps</span>
            <span className="text-right">Load ({t.slots.find((s) => s.unit)?.unit ?? 'lb'})</span>
            <span className="text-right">Rest</span>
            <span />
          </div>
          <ol className="divide-y">
            {t.slots.map((s, i) => (
              <EditRow key={s.id} s={s} n={i + 1} first={i === 0} last={i === t.slots.length - 1} pending={pending} run={run} />
            ))}
          </ol>
          <AddExercise t={t} library={library} pending={pending} run={run} />
          <p className="mt-3 text-xs text-[var(--viz-muted)]">
            Changes save as you go. Leave the load empty to let Lift pick it from your last session.
          </p>
        </div>
      ) : t.slots.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">No exercises yet. Edit to add some.</p>
      ) : (
        <ol className="divide-y px-4">
          {t.slots.map((s, i) => (
            <ViewRow key={s.id} s={s} n={i + 1} />
          ))}
        </ol>
      )}
    </article>
  );
}

function ViewRow({ s, n }: { s: TemplateSlotView; n: number }) {
  return (
    <li className={cn(COLS, 'py-2.5')}>
      <span className="text-right text-xs tabular-nums text-[var(--viz-muted)]">{n}</span>
      <span className="flex min-w-0 items-center gap-3">
        <ExerciseThumb image={s.image} gif={s.gif} name={s.exercise} size="sm" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-[var(--viz-ink)]">{s.exercise}</span>
          {s.note && <span className="block truncate text-xs text-[var(--viz-muted)]" title={s.note}>{s.note}</span>}
        </span>
      </span>
      <span className="text-right text-sm tabular-nums text-[var(--viz-ink)]">
        {s.sets} × {repsLabel(s.repMin, s.repMax)}
      </span>
      <span className="text-right text-sm tabular-nums text-[var(--viz-ink-2)]">
        {s.weight != null ? `${s.weight} ${s.unit ?? ''}` : <span className="text-[var(--viz-muted)]" title="Lift picks the load from the last session">auto</span>}
      </span>
      <span className="text-right text-sm tabular-nums text-[var(--viz-ink-2)]" title="Rest between sets">
        {restLabel(s.rest)}
      </span>
    </li>
  );
}

function NameField({ t, pending, run }: { t: TemplateView; pending: boolean; run: (e: TemplateEdit, ok?: string) => void }) {
  return (
    <input
      key={t.name}
      defaultValue={t.name}
      disabled={pending}
      onBlur={(e) => e.currentTarget.value.trim() !== t.name && run({ kind: 'rename', templateId: t.id, name: e.currentTarget.value }, 'Renamed')}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      aria-label="Template name"
      maxLength={60}
      className="h-9 w-full max-w-sm rounded-md border bg-background px-2 text-lg font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

/** A text field that saves on blur or Enter when its text changed. */
function Cell({ value, label, onSave, pending, className, inputMode, placeholder }: {
  value: string;
  label: string;
  onSave: (v: string) => void;
  pending: boolean;
  className?: string;
  inputMode?: 'numeric' | 'decimal' | 'text';
  placeholder?: string;
}) {
  // Uncontrolled, keyed by the saved value: a save (or another device's change) brings the new text in.
  return (
    <input
      key={value}
      defaultValue={value}
      inputMode={inputMode}
      placeholder={placeholder}
      disabled={pending}
      aria-label={label}
      onBlur={(e) => e.currentTarget.value.trim() !== value && onSave(e.currentTarget.value)}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className={cn(input, className)}
    />
  );
}

function EditRow({ s, n, first, last, pending, run }: {
  s: TemplateSlotView;
  n: number;
  first: boolean;
  last: boolean;
  pending: boolean;
  run: (e: TemplateEdit, ok?: string) => void;
}) {
  const slot = (field: 'sets' | 'reps' | 'weight' | 'rest' | 'note') => (value: unknown) => run({ kind: 'slot', slotId: s.id, field, value });
  const rests = REST_CHOICES.includes(s.rest ?? 0) ? REST_CHOICES : [...REST_CHOICES, s.rest ?? 0].sort((a, b) => a - b);
  return (
    <li className={cn(EDIT_COLS, 'py-2')}>
      <span className="pt-1.5 text-right text-xs tabular-nums text-[var(--viz-muted)]">{n}</span>
      <span className="flex min-w-0 items-start gap-2">
        <ExerciseThumb image={s.image} gif={s.gif} name={s.exercise} size="xs" className="mt-0.5" />
        <span className="min-w-0 flex-1 space-y-1">
          <span className="block truncate pt-1 text-sm font-medium text-[var(--viz-ink)]">{s.exercise}</span>
          <Cell value={s.note ?? ''} label={`Cue for ${s.exercise}`} placeholder="Cue (optional)" pending={pending} onSave={slot('note')} className="text-xs" />
        </span>
      </span>
      <Cell value={String(s.sets)} label={`Sets of ${s.exercise}`} inputMode="numeric" pending={pending} onSave={slot('sets')} className="text-right" />
      <Cell value={repsLabel(s.repMin, s.repMax)} label={`Reps of ${s.exercise}`} pending={pending} onSave={slot('reps')} className="text-right" />
      <Cell value={s.weight != null ? String(s.weight) : ''} label={`Load of ${s.exercise}`} inputMode="decimal" placeholder="auto" pending={pending} onSave={slot('weight')} className="text-right" />
      <select
        value={s.rest ?? 0}
        disabled={pending}
        aria-label={`Rest after each set of ${s.exercise}`}
        onChange={(e) => slot('rest')(Number(e.target.value))}
        className={cn(input, 'text-right')}
      >
        {rests.map((r) => (
          <option key={r} value={r}>
            {restOption(r)}
          </option>
        ))}
      </select>
      <span className="flex justify-end">
        <button type="button" className={iconBtn} disabled={pending || first} onClick={() => run({ kind: 'move', slotId: s.id, by: -1 })} aria-label={`Move ${s.exercise} up`}>
          <ArrowUp aria-hidden className="h-4 w-4" />
        </button>
        <button type="button" className={iconBtn} disabled={pending || last} onClick={() => run({ kind: 'move', slotId: s.id, by: 1 })} aria-label={`Move ${s.exercise} down`}>
          <ArrowDown aria-hidden className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={cn(iconBtn, 'hover:text-[var(--plan-missed)]')}
          disabled={pending}
          onClick={() => run({ kind: 'remove', slotId: s.id }, `Removed ${s.exercise}`)}
          aria-label={`Remove ${s.exercise}`}
        >
          <Trash2 aria-hidden className="h-4 w-4" />
        </button>
      </span>
    </li>
  );
}

function AddExercise({ t, library, pending, run }: { t: TemplateView; library: { id: string; name: string }[]; pending: boolean; run: (e: TemplateEdit, ok?: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inTemplate = useMemo(() => new Set(t.slots.map((s) => s.exercise.toLowerCase())), [t.slots]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return library.filter((x) => !inTemplate.has(x.name.toLowerCase()) && (!q || x.name.toLowerCase().includes(q))).slice(0, 50);
  }, [library, query, inTemplate]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2.5 text-sm font-medium text-[var(--viz-ink-2)] hover:border-[var(--viz-ink-2)] hover:text-[var(--viz-ink)]"
      >
        <Plus aria-hidden className="h-4 w-4" /> Add exercise
      </button>
    );
  }
  return (
    <section className="mt-2 space-y-2 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the Lift library"
          aria-label="Search the Lift library"
          className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2.5 text-sm"
        />
        <button type="button" className={iconBtn} onClick={() => setOpen(false)} aria-label="Close">
          <X aria-hidden className="h-4 w-4" />
        </button>
      </div>
      <ul className="max-h-56 divide-y overflow-y-auto rounded-md border">
        {shown.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No exercises match.</li>}
        {shown.map((x) => (
          <li key={x.id}>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                run({ kind: 'add', templateId: t.id, exerciseId: x.id }, `Added ${x.name}: 3 × 8–12`);
                setOpen(false);
                setQuery('');
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent/50"
            >
              <span className="truncate text-[var(--viz-ink)]">{x.name}</span>
              <Plus aria-hidden className="h-4 w-4 shrink-0 text-[var(--viz-muted)]" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
