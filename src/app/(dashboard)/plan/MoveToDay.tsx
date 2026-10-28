'use client';

import { useState } from 'react';
import { CalendarDays, Trash2 } from 'lucide-react';
import { DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, FormDialog, Input } from '@kobo/web';
import { addDays, mondayOf } from '@/lib/plan/week.mjs';
import type { CalendarWorkout } from '@/lib/plan/month';

const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * The Edit menu's "Move to" and "Delete" for a workout that is not done, past days too: a lift done a day late moves
 * onto the day it was done, and a copy left behind goes. Both go to the plan change log as web changes.
 */
export function MoveDeleteItems({ w, onMove, onRemove, onPickDay }: { w: CalendarWorkout; onMove?: (w: CalendarWorkout, date: string) => void; onRemove?: (w: CalendarWorkout) => void; onPickDay: () => void }) {
  if (w.state === 'done' || (!onMove && !onRemove)) return null;
  const monday = mondayOf(w.date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter((d) => d !== w.date);
  return (
    <>
      {onMove && (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <CalendarDays aria-hidden className="h-3.5 w-3.5" /> Move to
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="z-[60] data-[state=closed]:animate-none!">
            {days.map((d) => (
              <DropdownMenuItem key={d} onSelect={() => onMove(w, d)}>
                {dayLabel(d)}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onPickDay}>Other day…</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )}
      {onRemove && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onRemove(w)} className="text-destructive focus:text-destructive">
            <Trash2 aria-hidden className="h-3.5 w-3.5" /> Delete
          </DropdownMenuItem>
        </>
      )}
    </>
  );
}

/** Picks any day to move the workout to. */
export function PickDayDialog({ w, open, onOpenChange, onMove }: { w: CalendarWorkout; open: boolean; onOpenChange: (open: boolean) => void; onMove: (w: CalendarWorkout, date: string) => void }) {
  const [date, setDate] = useState(w.date);
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Move to another day"
      submitLabel="Move"
      submitDisabled={!/^\d{4}-\d{2}-\d{2}$/.test(date) || date === w.date}
      onSubmit={() => {
        onOpenChange(false);
        onMove(w, date);
      }}
    >
      <Input type="date" aria-label="Day" value={date} onChange={(e) => setDate(e.target.value)} />
    </FormDialog>
  );
}
