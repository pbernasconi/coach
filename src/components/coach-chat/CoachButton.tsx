'use client';

import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCoach } from './CoachProvider';

/** The nav's Coach button: opens and closes the Coach panel (`c`). On /coach it is the current page. */
export default function CoachButton() {
  const { open, toggle, onCoachPage } = useCoach();
  const on = open || onCoachPage;
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={onCoachPage}
      aria-pressed={on}
      aria-keyshortcuts="c"
      title={on ? 'Close Coach · press c' : 'Ask Coach · press c'}
      className={cn(
        'mr-3 inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring',
        on ? 'border-brand/40 bg-brand-soft text-foreground' : 'border-brand-wash-line bg-background/70 text-muted-foreground hover:text-foreground',
      )}
    >
      <MessageCircle aria-hidden className={cn('h-4 w-4', on && 'text-brand')} />
      Coach
    </button>
  );
}
