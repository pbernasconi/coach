'use client';

import { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft, Library, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import SportIcon from '@/components/SportIcon';
import WorkoutChart from '@/components/workouts/WorkoutChart';
import WorkoutSteps from '@/components/workouts/WorkoutSteps';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { sport } from '@/lib/sports';
import { dur } from '@/lib/plan/cells.mjs';
import { EFFORTS, SPORT_IDS, estimateTss } from '@/lib/plan/create.mjs';
import { BANK, bankWorkout } from '@/lib/workouts/bank.mjs';
import { clock, totals } from '@/lib/workouts/steps.mjs';
import type { CalendarWorkout, LibraryItem } from '@/lib/plan/month';
import type { StructuredWorkout } from '@/lib/plan/queries';
import { createWorkoutAction, updateWorkoutAction } from './actions';

/** The brand (the logo orange), as in the item modal. */
const ACCENT = 'var(--k-brand)';

const longDay = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** "1:30", "90" or "1h30" as minutes; null when empty or not a time. */
export function parseMinutes(v: string): number | null {
  const s = v.trim().toLowerCase();
  if (!s) return null;
  const hm = /^(\d{1,2})[:h](\d{1,2})m?$/.exec(s);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
  const m = /^(\d{1,4})\s*(m|min)?$/.exec(s);
  return m ? Number(m[1]) : null;
}

const toClock = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;

type Props = {
  date: string;
  library: LibraryItem[];
  onClose: () => void;
  /** After a save: the day to load again. */
  onCreated: (date: string) => void;
  onAddFromLibrary: (itemId: string, date: string) => void;
};

/**
 * Adds a workout to a day, TrainingPeaks style: first pick a sport (or a library workout), then fill in the plan.
 * Runs and rides can take their steps from the coach's bank, with a live interval chart; time and TSS then come
 * from the steps.
 */
export default function CreateWorkout({ date, library, onClose, onCreated, onAddFromLibrary }: Props) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[calc(100dvh-3rem)] sm:w-[min(52rem,calc(100vw-3rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border"
        >
          {picked ? (
            <Form key={picked} date={date} sportId={picked} onBack={() => setPicked(null)} onClose={onClose} onCreated={onCreated} />
          ) : (
            <Picker date={date} library={library} onPick={setPicked} onClose={onClose} onAddFromLibrary={onAddFromLibrary} />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Edits a planned workout (the modal's Edit): the same form as a new workout, filled in. A run or ride from the
 * coach's bank keeps its workout and step; changing either rebuilds the steps.
 */
export function EditWorkout({ w, onClose, onSaved }: { w: CalendarWorkout; onClose: () => void; onSaved: (days: { from: string; to: string }) => void }) {
  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-background shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[calc(100dvh-3rem)] sm:w-[min(52rem,calc(100vw-3rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border"
        >
          <Form date={w.date} sportId={SPORT_IDS.includes(w.sport) ? w.sport : 'other'} existing={w} onClose={onClose} onSaved={onSaved} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Top({ title, sub, onBack, onClose }: { title: string; sub?: string; onBack?: () => void; onClose: () => void }) {
  return (
    <header className="flex shrink-0 items-center gap-2 border-b px-4 py-3 sm:px-6 sm:py-4">
      {onBack && (
        <button type="button" onClick={onBack} aria-label="Back" className="rounded-md p-1.5 text-[var(--viz-muted)] hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowLeft aria-hidden className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <Dialog.Title className="truncate text-lg font-bold tracking-tight text-[var(--viz-ink)] sm:text-xl">{title}</Dialog.Title>
        {sub && <p className="text-xs text-[var(--viz-muted)] sm:text-sm">{sub}</p>}
      </div>
      <Dialog.Close aria-label="Close" className="rounded-md p-1.5 text-[var(--viz-muted)] hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={onClose}>
        <X aria-hidden className="h-5 w-5" />
      </Dialog.Close>
    </header>
  );
}

// ---------------------------------------------------------------------------------------------------------------

function Picker({ date, library, onPick, onClose, onAddFromLibrary }: { date: string; library: LibraryItem[]; onPick: (s: string) => void; onClose: () => void; onAddFromLibrary: (id: string, date: string) => void }) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (q ? library.filter((i) => `${i.title} ${sport(i.sport).label}`.toLowerCase().includes(q)) : library).slice(0, 8);
  }, [library, query]);
  return (
    <>
      <Top title={longDay(date)} sub="Add a workout" onClose={onClose} />
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--viz-ink)]">New workout</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SPORT_IDS.map((id) => {
              const s = sport(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onPick(id)}
                  className="group flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors hover:border-[var(--viz-ink-2)] hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: `color-mix(in srgb, ${s.color} 14%, transparent)` }}>
                    <SportIcon id={id} className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[var(--viz-ink)]">{id === 'rest' ? 'Day off' : s.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {library.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--viz-ink)]">
                <Library aria-hidden className="h-4 w-4" /> From your library
              </h3>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                aria-label="Search the library"
                className="h-8 w-44 rounded-md border bg-background px-2 text-sm"
              />
            </div>
            <ul className="divide-y rounded-xl border">
              {shown.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onAddFromLibrary(item.id, date);
                      onClose();
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <SportIcon id={item.sport} className="h-4 w-4" />
                    <span className="min-w-0 flex-1 truncate text-sm text-[var(--viz-ink)]">{item.title}</span>
                    <span className="shrink-0 text-xs tabular-nums text-[var(--viz-muted)]">
                      {[item.duration ? dur(item.duration) : null, item.tss ? `${Math.round(item.tss)} TSS` : null].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                </li>
              ))}
              {shown.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">No workouts match.</li>}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------

type BankKey = keyof typeof BANK;
const BANK_KEYS = Object.keys(BANK) as BankKey[];
const bankLabel = (k: BankKey) => (BANK[k] as { name?: string }).name ?? k;

function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block min-w-0 space-y-1', className)}>
      <span className="block text-xs font-medium text-[var(--viz-ink-2)]">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-[var(--viz-muted)]">{hint}</span>}
    </label>
  );
}

const input = 'h-9 w-full rounded-md border bg-background px-2.5 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

type FormProps = {
  date: string;
  sportId: string;
  onClose: () => void;
  onBack?: () => void;
  onCreated?: (d: string) => void;
  /** Edit mode: the workout to change, and what to do after a save. */
  existing?: CalendarWorkout;
  onSaved?: (days: { from: string; to: string }) => void;
};

/** The effort level whose label matches a stored intensity ("Easy"), or easy. */
const effortOf = (intensity: string | null | undefined) =>
  ((Object.keys(EFFORTS) as (keyof typeof EFFORTS)[]).find((k) => EFFORTS[k].label === intensity) ?? 'easy');

function Form({ date: day, sportId, onBack, onClose, onCreated, existing, onSaved }: FormProps) {
  const s = sport(sportId);
  const structured = sportId === 'run' || sportId === 'ride';
  const rest = sportId === 'rest';
  const old = existing?.steps as (StructuredWorkout & { bank?: string; level?: number }) | null | undefined;
  const oldBank = old?.bank && old.bank in BANK ? (old.bank as BankKey) : '';
  const [title, setTitle] = useState(existing?.title ?? '');
  const [date, setDate] = useState(day);
  const [time, setTime] = useState(existing?.startTime?.slice(0, 5) ?? '');
  const [durationText, setDurationText] = useState(existing?.duration ? toClock(existing.duration) : '');
  const [distanceText, setDistanceText] = useState('');
  // A stored TSS that the steps give anyway stays automatic.
  const [tssText, setTssText] = useState(() => {
    if (existing?.tss == null) return '';
    const auto = old ? (totals(old as never) as { tss: number }).tss : null;
    return auto != null && Math.round(auto) === Math.round(existing.tss) ? '' : String(Math.round(existing.tss));
  });
  const [effort, setEffort] = useState<keyof typeof EFFORTS>(effortOf(existing?.intensity));
  const [description, setDescription] = useState(existing?.description ?? '');
  const [bank, setBank] = useState<BankKey | ''>(oldBank);
  const [level, setLevel] = useState(old?.level ?? 0);
  // Steps that are not from the bank (none today, but an import could make them) stay as they are until a bank
  // workout is picked.
  const [keepOldSteps, setKeepOldSteps] = useState(Boolean(old && !oldBank));
  const [saving, setSaving] = useState(false);

  const minutes = parseMinutes(durationText);
  const steps = useMemo(() => {
    if (keepOldSteps && old) return old;
    if (!structured || !bank) return null;
    try {
      return bankWorkout(bank, sportId as 'ride' | 'run', level, minutes ?? (sportId === 'ride' ? 90 : 60)) as StructuredWorkout;
    } catch {
      return null;
    }
  }, [keepOldSteps, old, structured, bank, sportId, level, minutes]);
  const fromSteps = steps ? (totals(steps as never) as { minutes: number; tss: number; if: number }) : null;
  const plannedMin = minutes ?? fromSteps?.minutes ?? null;
  const autoTss = fromSteps?.tss ?? (plannedMin ? estimateTss(plannedMin, EFFORTS[effort].if) : null);
  const levels = bank ? (BANK[bank] as { levels: number }).levels : 0;
  const describe = bank ? (BANK[bank] as { describe?: (l: number) => string }).describe : undefined;

  async function save() {
    if (durationText && minutes == null) return toast.error('The duration must be like 1:30 or 90.');
    setSaving(true);
    try {
      const km = distanceText.trim() ? Number(distanceText.replace(',', '.')) : null;
      const input = {
        sport: sportId,
        date,
        startTime: time || null,
        title,
        duration: minutes ?? fromSteps?.minutes ?? null,
        distance: km != null && Number.isFinite(km) ? km * 1000 : null,
        tss: tssText.trim() ? Number(tssText) : autoTss,
        intensity: !rest && !steps ? EFFORTS[effort].label : null,
        description,
        steps,
      };
      if (existing) {
        const r = await updateWorkoutAction(existing.id, input);
        if ('error' in r) {
          toast.error(r.error);
          return;
        }
        toast.success('Workout saved');
        onSaved?.(r);
        onClose();
        return;
      }
      const r = await createWorkoutAction(input);
      if ('error' in r) {
        toast.error(r.error);
        return;
      }
      toast.success(`Added ${title.trim() || steps?.name || (rest ? 'a day off' : s.label)} on ${longDay(date)}`);
      onCreated?.(date);
      onClose();
    } catch {
      toast.error(existing ? 'Could not save the workout' : 'Could not add the workout');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Top title={existing ? `Edit ${s.label.toLowerCase()}` : rest ? 'Day off' : `New ${s.label.toLowerCase()}`} sub={longDay(date)} onBack={onBack} onClose={onClose} />
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: `color-mix(in srgb, ${s.color} 14%, transparent)` }}>
              <SportIcon id={sportId} className="h-5 w-5" />
            </span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={steps?.name ?? (rest ? 'Rest day' : 'Untitled workout')}
              aria-label="Title"
              maxLength={120}
              className="h-11 min-w-0 flex-1 rounded-lg border bg-background px-3 text-lg font-semibold text-[var(--viz-ink)] placeholder:font-normal placeholder:text-[var(--viz-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Day">
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={input} />
            </Field>
            <Field label="Start time" hint="Optional">
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={input} />
            </Field>
            {!rest && (
              <>
                <Field label="Duration" hint={fromSteps && minutes == null ? `${toClock(fromSteps.minutes)} from the steps` : 'h:mm or minutes'}>
                  <input inputMode="numeric" value={durationText} onChange={(e) => setDurationText(e.target.value)} placeholder={fromSteps ? toClock(fromSteps.minutes) : '1:00'} className={input} />
                </Field>
                <Field label="Distance" hint="km, optional">
                  <input inputMode="decimal" value={distanceText} onChange={(e) => setDistanceText(e.target.value)} placeholder="–" className={input} />
                </Field>
              </>
            )}
          </div>

          {!rest && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {!steps && (
                <Field label="Effort" className="col-span-2 sm:col-span-2">
                  <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Effort">
                    {(Object.keys(EFFORTS) as (keyof typeof EFFORTS)[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={effort === k}
                        onClick={() => setEffort(k)}
                        className={cn(
                          'h-9 rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          effort === k ? 'border-transparent text-on-brand' : 'text-[var(--viz-ink-2)] hover:bg-accent'
                        )}
                        style={effort === k ? { background: ACCENT } : undefined}
                      >
                        {EFFORTS[k].label}
                      </button>
                    ))}
                  </div>
                </Field>
              )}
              <Field label="TSS" hint={autoTss != null && !tssText ? `Auto: ${autoTss}${fromSteps ? ` · IF ${fromSteps.if.toFixed(2)}` : ''}` : undefined}>
                <input inputMode="numeric" value={tssText} onChange={(e) => setTssText(e.target.value)} placeholder={autoTss != null ? String(autoTss) : '–'} className={input} />
              </Field>
            </div>
          )}

          {structured && (
            <section className="space-y-3 rounded-xl border p-4">
              <div className="flex flex-wrap items-end gap-3">
                <h3 className="flex flex-1 items-center gap-1.5 text-sm font-semibold text-[var(--viz-ink)]">
                  <Sparkles aria-hidden className="h-4 w-4" style={{ color: ACCENT }} /> Structure
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Workout">
                  <select
                    value={bank}
                    onChange={(e) => {
                      setBank(e.target.value as BankKey | '');
                      setLevel(0);
                      setKeepOldSteps(false);
                    }}
                    className={input}
                  >
                    <option value="">None (free text)</option>
                    {BANK_KEYS.map((k) => (
                      <option key={k} value={k}>{bankLabel(k)}</option>
                    ))}
                  </select>
                </Field>
                {levels > 1 && (
                  <Field label="Step of the progression">
                    <select value={level} onChange={(e) => { setLevel(Number(e.target.value)); setKeepOldSteps(false); }} className={input}>
                      {Array.from({ length: levels }, (_, l) => (
                        <option key={l} value={l}>{l + 1}{describe ? ` · ${describe(l)}` : ''}</option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>
              {steps ? (
                <div className="space-y-3">
                  <div className="rounded-lg bg-muted/40 p-3">
                    <WorkoutChart workout={steps} />
                  </div>
                  <p className="text-xs tabular-nums text-[var(--viz-ink-2)]">
                    {steps.name} · {clock(fromSteps!.minutes * 60)} · {fromSteps!.tss} TSS · IF {fromSteps!.if.toFixed(2)}
                  </p>
                  <WorkoutSteps workout={steps} />
                </div>
              ) : (
                <p className="text-xs text-[var(--viz-muted)]">Pick a workout to add its steps. Without steps, the description says what to do.</p>
              )}
            </section>
          )}

          <Field label={steps ? 'Notes' : 'Description'}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={4000}
              placeholder={rest ? 'Optional' : 'What to do: the main set, the targets, the cues.'}
              className="w-full rounded-md border bg-background px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </Field>
        </div>
        <footer className="flex shrink-0 items-center justify-between gap-2 border-t px-4 py-3 sm:px-6">
          <span className="text-xs tabular-nums text-[var(--viz-muted)]">
            {!rest && plannedMin ? `${dur(plannedMin)} planned${autoTss != null || tssText ? ` · ${tssText || autoTss} TSS` : ''}` : ''}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? (existing ? 'Saving…' : 'Adding…') : existing ? 'Save' : 'Add workout'}
            </Button>
          </div>
        </footer>
      </form>
    </>
  );
}
