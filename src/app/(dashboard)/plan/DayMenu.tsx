'use client';

import { ClipboardPaste, Copy, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { longDate, type Day, type Handlers } from './calendarShared';

/** The day menu (TrainingPeaks style): add a workout, copy or paste planned workouts, delete them. */
export function DayMenu({ d, day, clip, h }: { d: string; day: Day; clip: string | null; h: Handlers }) {
  const planned = day.items.filter((i) => i.kind === 'planned' && i.w.state !== 'done').length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Menu for ${longDate(d)}`}
        className="rounded p-0.5 text-[var(--viz-muted)] opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/day:opacity-100 data-[state=open]:opacity-100"
      >
        <MoreHorizontal aria-hidden className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={() => h.day(d, 'add')}>
          <Plus aria-hidden className="mr-2 h-4 w-4" /> Add a workout…
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!planned} onSelect={() => h.day(d, 'copy')}>
          <Copy aria-hidden className="mr-2 h-4 w-4" /> Copy {planned > 1 ? `${planned} workouts` : 'workout'}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!clip} onSelect={() => h.day(d, 'paste')}>
          <ClipboardPaste aria-hidden className="mr-2 h-4 w-4" />
          <span className="truncate">Paste{clip ? ` ${clip}` : ''}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!planned} onSelect={() => h.day(d, 'clear')} className="text-[var(--plan-missed)] focus:text-[var(--plan-missed)]">
          <Trash2 aria-hidden className="mr-2 h-4 w-4" /> Delete {planned > 1 ? `${planned} planned` : 'planned'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
