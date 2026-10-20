'use client';

import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { removeNotice } from '@/lib/plan/remove.mjs';

type Props = {
  workout: { title: string; date: string; state?: string; imported?: boolean };
  onRemove: () => void;
  disabled?: boolean;
  /** icon: a small trash button (month view); text: an outline "Remove" button (week view). */
  variant?: 'icon' | 'text';
  className?: string;
  /** Classes for the small trash button only (variant "icon"). */
  iconClassName?: string;
};

/**
 * A Remove button with a confirm step inside the page: the first tap shows the question and what happens,
 * the second tap removes. Escape or Cancel closes it.
 */
export default function RemoveWorkout({ workout, onRemove, disabled, variant = 'text', className, iconClassName }: Props) {
  const [asking, setAsking] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const notice = removeNotice(workout);

  useEffect(() => {
    if (asking) confirmRef.current?.focus();
  }, [asking]);

  if (!asking) {
    return variant === 'icon' ? (
      <button
        type="button"
        aria-label={`Remove ${workout.title}`}
        title="Remove"
        disabled={disabled}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAsking(true); }}
        className={cn('rounded bg-card p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50', iconClassName)}
      >
        <Trash2 aria-hidden className="h-3 w-3" />
      </button>
    ) : (
      <Button size="sm" variant="outline" className={cn('h-6 px-2 text-xs', className)} disabled={disabled} onClick={() => setAsking(true)}>
        <Trash2 aria-hidden className="mr-1 h-3 w-3" /> Remove
      </Button>
    );
  }

  return (
    <div
      role="alertdialog"
      aria-label={notice.question}
      onKeyDown={(e) => { if (e.key === 'Escape') setAsking(false); }}
      onClick={(e) => e.stopPropagation()}
      className={cn('w-full space-y-1.5 rounded-md border border-[var(--plan-missed)] bg-background p-2 text-xs', className)}
    >
      <p className="font-medium">{notice.question}</p>
      <ul className="space-y-0.5 text-muted-foreground">
        {notice.notes.map((n) => <li key={n}>{n}</li>)}
      </ul>
      <div className="flex gap-2">
        <Button
          ref={confirmRef}
          size="sm"
          variant="destructive"
          className="h-8 px-3 text-xs"
          disabled={disabled}
          onClick={() => { setAsking(false); onRemove(); }}
        >
          Remove
        </Button>
        <Button size="sm" variant="ghost" className="h-8 px-3 text-xs" onClick={() => setAsking(false)}>Cancel</Button>
      </div>
    </div>
  );
}
