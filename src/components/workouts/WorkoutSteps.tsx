import { STEP_KIND, stepLength, stepTarget, stepZone } from '@/lib/workouts/steps.mjs';
import type { StructuredWorkout } from '@/lib/plan/queries';
import { ZONE_COLOR } from './WorkoutChart';

type Node = {
  kind: string;
  count?: number;
  steps?: Node[];
  duration?: { type: string; s?: number; m?: number };
  target?: { type: string };
  ramp?: boolean;
  cadence?: [number, number];
  notes?: string;
};

const KIND: Record<string, string> = STEP_KIND;

function Row({ n, sport }: { n: Node; sport: string }) {
  const zone = stepZone(n as never, sport) as string;
  return (
    <li className="grid grid-cols-[0.5rem_4.5rem_1fr_auto] items-baseline gap-2 py-1 text-xs">
      <span className="h-2.5 w-2 self-center rounded-sm" style={{ background: ZONE_COLOR[zone] }} aria-hidden />
      <span className="tabular-nums text-[var(--viz-ink)]">{stepLength(n as never)}</span>
      <span className="min-w-0 truncate text-[var(--viz-ink-2)]" title={n.notes}>
        {KIND[n.kind] ?? n.kind}
        {n.notes ? ` · ${n.notes}` : ''}
      </span>
      <span className="whitespace-nowrap text-right tabular-nums text-[var(--viz-ink)]">
        {stepTarget(n as never)}
      </span>
    </li>
  );
}

function List({ nodes, sport }: { nodes: Node[]; sport: string }) {
  return (
    <ol className="divide-y">
      {nodes.map((n, i) =>
        n.kind === 'repeat' ? (
          <li key={i} className="py-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--viz-muted)]">{n.count} ×</p>
            <div className="ml-3 border-l pl-3">
              <List nodes={n.steps ?? []} sport={sport} />
            </div>
          </li>
        ) : (
          <Row key={i} n={n} sport={sport} />
        )
      )}
    </ol>
  );
}

/** The steps as a list: time or distance, kind and cue, and the target in watts or beats with today's anchors. */
export default function WorkoutSteps({ workout }: { workout: StructuredWorkout }) {
  return <List nodes={workout.steps as Node[]} sport={workout.sport} />;
}
