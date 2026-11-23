import { Check, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WarmUpItem } from '@/lib/lift/warm-up.mjs';

/**
 * The warm-up Lift plans into every workout (easy cardio and a few prep moves), ticked in the app. The warm-up sets are
 * the "Warm-up" tiles in each exercise card.
 */
export default function WarmUpCard({ items }: { items: WarmUpItem[] }) {
  const done = items.filter((i) => i.done).length;
  return (
    <section aria-labelledby="warm-up-title" className="rounded-xl border p-4">
      <h3 id="warm-up-title" className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--viz-ink)]">
        <Flame aria-hidden className="h-4 w-4 text-[var(--sport-strength)]" />
        Warm-up
        <span className="ml-auto text-xs font-normal tabular-nums text-[var(--viz-muted)]">
          {done === items.length ? 'Done' : `${done} of ${items.length}`}
        </span>
      </h3>
      <ul className="grid gap-1 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.text} className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                'grid h-4 w-4 shrink-0 place-items-center rounded-full border',
                item.done ? 'border-transparent bg-[var(--viz-good)] text-white' : 'border-[var(--viz-muted)]'
              )}
            >
              {item.done && <Check aria-hidden className="h-3 w-3" />}
            </span>
            <span className={cn(item.done ? 'text-[var(--viz-muted)]' : 'text-[var(--viz-ink)]')}>
              {item.text}
              <span className="sr-only">{item.done ? ' (done)' : ' (to do)'}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
