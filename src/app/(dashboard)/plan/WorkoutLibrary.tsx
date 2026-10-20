'use client';

import { useMemo, useState } from 'react';
import { GripVertical, Plus, X } from 'lucide-react';
import SportIcon from '@/components/SportIcon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { sport } from '@/lib/sports';
import type { LibraryItem } from '@/lib/plan/month';

/** Drag data types: a library item id, or a planned workout id (both views read them). */
export const LIBRARY_MIME = 'application/x-coach-library';
export const WORKOUT_MIME = 'application/x-coach-workout';

/**
 * Reusable workouts: Lift templates and distinct workouts from past plans. Drag one onto a day. On a touch screen
 * (no drag), open an item, pick a day and tap Add. The calendar shows it as a panel from the Library button.
 */
export default function WorkoutLibrary({
  items, today, onAdd, disabled, className, onClose,
}: {
  items: LibraryItem[];
  today: string;
  onAdd: (itemId: string, date: string) => void;
  disabled?: boolean;
  className?: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => `${i.title} ${sport(i.sport).label} ${i.intensity ?? ''}`.toLowerCase().includes(q)) : items;
  }, [items, query]);

  return (
    <aside className={cn('rounded-lg border', className)} aria-label="Workout library">
      <div className="flex items-start justify-between gap-2 px-3 py-2">
        <span>
          <span className="block text-sm font-semibold">Workout library</span>
          <span className="block text-xs text-muted-foreground">Drag onto a day, or open one to add it</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the library"
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X aria-hidden className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-2 border-t p-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          aria-label="Search the library"
          className="h-9 w-full rounded-md border bg-background px-2 text-sm"
        />
        {shown.length === 0 && <p className="px-1 text-xs text-muted-foreground">No workouts match.</p>}
        <ul className="space-y-1">
          {shown.map((item) => (
            <li
              key={item.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(LIBRARY_MIME, item.id);
                e.dataTransfer.effectAllowed = 'copy';
                e.currentTarget.classList.add('opacity-50');
              }}
              onDragEnd={(e) => e.currentTarget.classList.remove('opacity-50')}
              className="cursor-grab rounded-md border bg-card text-xs shadow-sm transition-[box-shadow,opacity] hover:shadow-md active:cursor-grabbing"
            >
              <button
                type="button"
                className="flex w-full items-start gap-1.5 px-2 py-1.5 text-left"
                onClick={() => setOpen(open === item.id ? null : item.id)}
                aria-expanded={open === item.id}
              >
                <GripVertical aria-hidden className="mt-0.5 hidden h-3 w-3 shrink-0 text-muted-foreground md:block" />
                <SportIcon id={item.sport} className="mt-0.5 h-3 w-3" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.title}</span>
                  <span className="block truncate text-muted-foreground">
                    {[
                      item.source === 'lift' ? 'Lift template' : sport(item.sport).label,
                      item.duration ? `${item.duration} min` : null,
                      item.tss ? `${Math.round(item.tss)} TSS` : null,
                      item.uses > 1 ? `used ${item.uses}×` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              </button>
              {open === item.id && (
                <div className="space-y-2 border-t px-2 py-2">
                  {item.intensity && <p className="text-muted-foreground">{item.intensity}</p>}
                  {item.description && <p className="max-h-32 overflow-y-auto whitespace-pre-wrap">{item.description}</p>}
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      aria-label="Day to add the workout on"
                      className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs"
                    />
                    <Button size="sm" className="h-9" disabled={disabled || !date} onClick={() => onAdd(item.id, date)}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
