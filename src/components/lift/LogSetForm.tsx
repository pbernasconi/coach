'use client';

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import type { RichSet } from '@/lib/lift/session';

/** Logs one set (reps and, with a load, the weight); resolves when saved. */
export type LogSet = (setId: string, reps: number, weight: number | null | undefined) => Promise<void>;

const box =
  'h-7 w-full min-w-0 rounded-md border bg-background px-1.5 text-right text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';
const show = (v: number | null | undefined) => (v == null ? '' : String(Math.round(v * 10) / 10));

/**
 * A planned set's quick log on the web, for a session done without the phone (a home session): the reps (the target
 * to start), the weight when the exercise has a load, and a check that logs it.
 */
export default function LogSetForm({ s, loadMode, unit, onLog }: { s: RichSet; loadMode: string | null; unit: string; onLog: LogSet }) {
  const [reps, setReps] = useState(show(s.target.reps ?? s.target.repMax ?? s.target.repMin));
  const [weight, setWeight] = useState(show(s.target.weight));
  const [busy, setBusy] = useState(false);
  const weighted = loadMode !== 'bodyweight';
  async function save() {
    const r = Number(reps);
    const w = weight.trim() === '' ? null : Number(weight.replace(',', '.'));
    if (!Number.isInteger(r) || r < 1 || (w != null && !Number.isFinite(w))) return;
    setBusy(true);
    try {
      await onLog(s.id, r, weighted ? w : undefined);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="mt-1 flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <input inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} disabled={busy} aria-label={`Set ${s.label} reps`} placeholder="reps" className={box} />
      {weighted && (
        <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} disabled={busy} aria-label={`Set ${s.label} weight (${unit})`} placeholder={unit} className={box} />
      )}
      <button
        type="submit"
        disabled={busy || !reps.trim()}
        title="Log this set"
        aria-label={`Log set ${s.label}`}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md border text-[var(--viz-ink-2)] hover:border-[var(--viz-good)] hover:text-[var(--viz-good)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
      >
        {busy ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : <Check aria-hidden className="h-3.5 w-3.5" />}
      </button>
    </form>
  );
}
