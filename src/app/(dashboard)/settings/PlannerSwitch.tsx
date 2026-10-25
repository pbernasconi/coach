'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import type { PlannerStatus } from '@/lib/planner/run';
import { setPlannerRunnerAction } from './actions';

const usd = (n: number) => `$${n.toFixed(2)}`;

/** Who plans the week (Claude API on the server, or the GitHub job), this month's spend, and the switch. */
export default function PlannerSwitch({ status }: { status: PlannerStatus }) {
  const [pending, start] = useTransition();
  const toggle = () =>
    start(async () => {
      try {
        await setPlannerRunnerAction(!status.switchedOn);
      } catch {
        toast.error('Could not save. Try again.');
      }
    });
  return (
    <div className="space-y-3 text-sm">
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          className="size-4 accent-[var(--color-brand)]"
          checked={status.switchedOn}
          disabled={pending || !status.hasKey}
          onChange={toggle}
        />
        <span>Plan on the server with the Claude API</span>
      </label>
      <p className="text-muted-foreground">
        {status.server
          ? `Now planning on the server. ${usd(status.spent)} of the ${usd(status.cap)} monthly budget used.`
          : `Now planning on the GitHub job. ${status.reason}`}
        {status.lastRun && ` Last server run: ${status.lastRun.status === 'ok' ? 'planned' : status.lastRun.status}, ${usd(status.lastRun.costUsd)}.`}
      </p>
      <p className="text-xs text-muted-foreground">Check-ins (this week) stay on the GitHub job for now. A failed server run hands the plan to the GitHub job.</p>
    </div>
  );
}
