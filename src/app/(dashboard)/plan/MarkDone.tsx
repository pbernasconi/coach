'use client';

import { CircleCheck, Undo2 } from 'lucide-react';
import type { CalendarWorkout } from '@/lib/plan/month';

const btn = 'inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-accent';

/**
 * Marks a planned workout done by hand (a home session with no activity behind it), or puts it back. It then counts
 * as done on the calendar and in the week totals, at its planned time and TSS.
 */
export default function MarkDone({ w, onMarkDone }: { w: CalendarWorkout; onMarkDone: (w: CalendarWorkout, done: boolean) => void }) {
  if (w.status === 'done') {
    return (
      <button type="button" onClick={() => onMarkDone(w, false)} className={btn}>
        <Undo2 aria-hidden className="h-3.5 w-3.5" /> Undo done
      </button>
    );
  }
  return (
    <button type="button" onClick={() => onMarkDone(w, true)} className={btn}>
      <CircleCheck aria-hidden className="h-3.5 w-3.5 text-[var(--plan-good)]" /> Mark done
    </button>
  );
}
