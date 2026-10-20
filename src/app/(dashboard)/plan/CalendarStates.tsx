'use client';

import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COLS, ROW_H, longDate } from './calendarShared';

export function LoadError({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <p role="status" className="flex h-10 items-center justify-center gap-2 border-b text-xs text-[var(--viz-ink-2)]">
      <TriangleAlert aria-hidden className="h-3.5 w-3.5 text-[var(--plan-off)]" />
      {text}
      <span aria-hidden className="text-[var(--viz-muted)]">·</span>
      <button type="button" onClick={onRetry} className="rounded font-medium text-[var(--viz-ink)] underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Retry
      </button>
    </p>
  );
}

export function EdgeNote({ earliest }: { earliest: string | null }) {
  return (
    <p className="flex h-8 items-center justify-center border-b text-[11px] text-[var(--viz-muted)]">
      {earliest ? `Earliest data: ${longDate(earliest)}` : 'No earlier data'}
    </p>
  );
}

export function SkeletonWeek() {
  return (
    <div aria-hidden className={cn(COLS, ROW_H, 'border-b')}>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className={cn('space-y-1.5 p-1.5', i < 7 ? 'border-r' : 'bg-[var(--viz-surface)]')}>
          <div className="h-3 w-5 animate-pulse rounded bg-muted" />
          {i % 3 !== 1 && <div className="h-[34px] animate-pulse rounded-[5px] bg-muted/70" />}
        </div>
      ))}
    </div>
  );
}

export function SkeletonAgenda() {
  return <div aria-hidden className="my-2 h-40 animate-pulse rounded-lg border bg-muted/40" />;
}
