import Link from 'next/link';
import { CircleAlert, CircleCheck, Lightbulb } from 'lucide-react';
import type { Tip } from './types';

const TONE = {
  good: { icon: CircleCheck, color: 'var(--viz-good)' },
  warn: { icon: CircleAlert, color: 'var(--color-amber-500)' },
  info: { icon: Lightbulb, color: 'var(--sport-strength)' },
} as const;

/** Tips from fixed rules over the numbers on this page (src/lib/lift-dashboard/overview.mjs), most pressing first. */
export default function CoachTips({ tips }: { tips: Tip[] }) {
  return (
    <aside className="overflow-hidden rounded-xl border bg-card" aria-labelledby="tips-h">
      <div className="flex items-baseline justify-between border-b px-4 py-3">
        <h2 id="tips-h" className="font-semibold">Coach notes</h2>
        <span className="text-xs text-[var(--viz-muted)]">Lean and strong</span>
      </div>
      <ul className="divide-y">
        {tips.map((t) => {
          const { icon: Icon, color } = TONE[t.tone];
          const body = (
            <>
              <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" style={{ color }} />
              <span className="min-w-0 space-y-0.5">
                <span className="block text-sm font-medium text-[var(--viz-ink)]">{t.title}</span>
                <span className="block text-xs leading-relaxed text-[var(--viz-ink-2)]">{t.body}</span>
              </span>
            </>
          );
          return (
            <li key={t.id}>
              {t.href ? (
                <Link href={t.href} className="flex gap-3 px-4 py-3 transition-colors hover:bg-[var(--viz-band)]">{body}</Link>
              ) : (
                <div className="flex gap-3 px-4 py-3">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
