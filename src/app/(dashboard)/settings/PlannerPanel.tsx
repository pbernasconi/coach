import type { PlannerStatus } from '@/lib/planner/run';

const usd = (n: number) => `$${n.toFixed(2)}`;

/** The planner (Claude API): ready or why not, this month's spend against the cap, and the last run. */
export default function PlannerPanel({ status }: { status: PlannerStatus }) {
  return (
    <div className="space-y-1 text-sm">
      <p>{status.ready ? 'Ready.' : status.reason}</p>
      <p className="text-muted-foreground">
        {usd(status.spent)} of the {usd(status.cap)} monthly budget used.
        {status.lastRun && ` Last run: ${status.lastRun.status === 'ok' ? 'planned' : status.lastRun.status}, ${usd(status.lastRun.costUsd)}.`}
      </p>
    </div>
  );
}
