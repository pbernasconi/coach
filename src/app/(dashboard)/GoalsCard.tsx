import { Info } from 'lucide-react';
import { HelpTooltip } from '@kobo/web';
import Link from 'next/link';
import type { GoalProgress } from '@/lib/goals/goals.mjs';
import { goalView } from '@/lib/performance/display.mjs';

const BADGE: Record<GoalProgress['status'], string> = {
  done: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  on_track: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  behind: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  missed: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
  open: 'bg-muted text-muted-foreground',
  not_started: 'bg-muted text-muted-foreground',
};

/** The milestone goals: the value now against the target, and the time left. */
export default function GoalsCard({ goals }: { goals: GoalProgress[] }) {
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Goals</h2>
        <Link href="/settings#goals" className="text-xs underline underline-offset-4">Edit goals →</Link>
      </div>
      {goals.length === 0 && <p className="text-sm text-muted-foreground">No goals. Add milestones in Settings.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {goals.map(goalView).map((g) => (
          <div key={g.id} className="space-y-2 rounded-md bg-muted/40 p-3">
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-medium">
                {g.title}
                {g.detail.length > 0 && (
                  <HelpTooltip label={`About ${g.title}`} icon={<Info aria-hidden />}>
                    {g.detail.join('. ')}.
                  </HelpTooltip>
                )}
              </span>
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${BADGE[g.status]}`}>{g.statusText}</span>
            </div>
            <div className="flex items-baseline justify-between text-sm">
              <span><b className="text-lg">{g.currentText}</b> <span className="text-muted-foreground">/ {g.targetText}</span></span>
              <span className="text-xs text-muted-foreground">
                {g.timeText}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${g.status === 'done' ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${Math.round(g.progress * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
