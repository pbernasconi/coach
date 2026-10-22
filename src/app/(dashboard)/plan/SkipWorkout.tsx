'use client';

import { Ban, Undo2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@kobo/web';
import { SKIP_LABEL, SKIP_REASONS } from '@/lib/plan/skip.mjs';
import type { CalendarWorkout } from '@/lib/plan/month';

const btn = 'inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-accent';

/**
 * Skip a planned workout and say why, or put a skipped one back. The workout stays on the plan, marked skipped.
 * A skip of today's workout for fatigue also eases the next quality session (src/lib/plan/skip.mjs).
 */
export default function SkipWorkout({ w, onSkip }: { w: CalendarWorkout; onSkip: (w: CalendarWorkout, reason?: string | null) => void }) {
  if (w.status === 'skipped') {
    return (
      <button type="button" onClick={() => onSkip(w)} className={btn}>
        <Undo2 aria-hidden className="h-3.5 w-3.5" /> Undo skip
      </button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={btn}>
          <Ban aria-hidden className="h-3.5 w-3.5" /> Skip
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[60]">
        <DropdownMenuLabel>Why?</DropdownMenuLabel>
        {(SKIP_REASONS as string[]).map((r) => (
          <DropdownMenuItem key={r} onSelect={() => onSkip(w, r)}>
            {(SKIP_LABEL as Record<string, string>)[r]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
