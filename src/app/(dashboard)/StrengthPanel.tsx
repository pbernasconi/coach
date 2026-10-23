import Link from 'next/link';
import { Check } from 'lucide-react';
import ExerciseThumb from '@/components/lift/ExerciseThumb';
import { cn } from '@/lib/utils';
import type { StrengthLine } from '@/lib/performance/strength-lines.mjs';

const COLS = 3;
const ROWS = 3;
const MAX = COLS * ROWS;

/**
 * A strength workout in the space the structure chart takes for a run: each exercise with its picture, its name and
 * "3 × 10 · 25 lb", in three columns of up to three rows, so the row keeps the height a run's row has. An exercise
 * with every set logged gets a check. Each exercise opens its own page; one from the coach's text (no Lift exercise)
 * and "+N more" open the workout in Plan.
 */
export default function StrengthPanel({ lines, href, label, dim }: { lines: StrengthLine[]; href: string; label: string; dim?: boolean }) {
  const extra = lines.length > MAX ? lines.length - (MAX - 1) : 0;
  const shown = extra ? lines.slice(0, MAX - 1) : lines;
  const rows = Math.min(ROWS, Math.ceil((shown.length + (extra ? 1 : 0)) / COLS));
  return (
    <div className={cn('min-w-0 flex-1 rounded-md bg-muted/40 px-1 py-0.5', dim && 'opacity-60 hover:opacity-100')}>
      <ul className="grid grid-flow-col gap-x-2" style={{ gridTemplateRows: `repeat(${rows}, auto)`, gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
        {shown.map((l, i) => (
          <li key={i} className="min-w-0">
            <Link
              href={l.key ? `/lift/exercises/${encodeURIComponent(l.key)}` : href}
              title={`${l.name}: ${l.text}`}
              className="flex min-w-0 items-center gap-2 rounded px-1.5 py-0.5 transition-colors hover:bg-muted/60"
            >
              <ExerciseThumb image={l.image} name={l.name} size="xs" className="h-6 w-6 rounded-md" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-xs leading-[14px] text-[var(--viz-ink)]">
                  <span className="truncate">{l.name}</span>
                  {l.sets > 0 && l.done >= l.sets && <Check aria-label="Done" className="h-3 w-3 shrink-0 text-[var(--viz-good)]" strokeWidth={3} />}
                </span>
                <span className="block truncate text-[11px] leading-3 tabular-nums text-[var(--viz-muted)]">{l.text}</span>
              </span>
            </Link>
          </li>
        ))}
        {extra > 0 && (
          <li className="flex items-center">
            <Link href={href} aria-label={`${label}: open in Plan`} className="rounded px-1.5 py-0.5 pl-9 text-xs text-[var(--viz-muted)] hover:text-foreground hover:underline">
              +{extra} more
            </Link>
          </li>
        )}
      </ul>
    </div>
  );
}
