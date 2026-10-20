import Link from 'next/link';
import MuscleSetsChart from '@/components/charts/MuscleSetsChart';

type MuscleRow = { muscle: string; sets: number; status: string };
type TopLift = { key: string; name: string; sessions: number; points: { day: string; e1rm: number }[]; latest: number | null; change: number | null };


function Sparkline({ points }: { points: { e1rm: number }[] }) {
  if (points.length < 2) return <span className="text-xs text-muted-foreground">1 session</span>;
  const W = 120;
  const H = 28;
  const vals = points.map((p) => p.e1rm);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const d = vals
    .map((v, i) => `${i ? 'L' : 'M'}${((i / (vals.length - 1)) * W).toFixed(1)},${(H - ((v - lo) / (hi - lo || 1)) * (H - 4) - 2).toFixed(1)}`)
    .join('');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-7 w-28" aria-hidden>
      <path d={d} fill="none" className="stroke-primary" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * Lift data on Performance: hard sets per muscle this week against the 10-20 band (as in the Lift app),
 * and the estimated 1RM trend of the most frequent lifts.
 */
export default function LiftSection({
  thisWeek, last4, top, unit, hasData,
}: {
  thisWeek: MuscleRow[];
  last4: MuscleRow[];
  top: TopLift[];
  unit: string;
  hasData: boolean;
}) {
  if (!hasData) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        <h2 className="mb-1 font-semibold text-foreground">Strength (Lift)</h2>
        No Lift sessions on the server yet. Paste the sync token from <Link href="/settings" className="underline">Settings</Link> into Lift on the iPhone.
      </div>
    );
  }
  const avg = new Map(last4.map((m) => [m.muscle, m.sets / 4]));
  const muscles = [...new Set([...thisWeek.map((m) => m.muscle), ...last4.map((m) => m.muscle)])]
    .map((muscle) => ({ muscle, week: thisWeek.find((m) => m.muscle === muscle)?.sets ?? 0, avg: avg.get(muscle) ?? 0 }))
    .sort((a, b) => b.avg - a.avg || b.week - a.week)
    .slice(0, 10);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <MuscleSetsChart rows={muscles} />
      <div className="rounded-lg border bg-[var(--viz-surface)] p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-semibold">Main lifts</h2>
          <span className="text-xs text-muted-foreground">estimated 1RM, last 12 weeks</span>
        </div>
        <div className="divide-y">
          {top.map((l) => (
            <Link key={l.key} href={`/lift/exercises/${encodeURIComponent(l.key)}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-muted/40">
              <span className="min-w-0 flex-1 truncate">{l.name}</span>
              <Sparkline points={l.points} />
              <span className="w-20 text-right">{l.latest ? `${Math.round(l.latest)} ${unit}` : '-'}</span>
              <span className={`w-14 text-right text-xs ${l.change == null ? 'text-muted-foreground' : l.change >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                {l.change == null ? '' : `${l.change >= 0 ? '+' : ''}${Math.round(l.change * 100)}%`}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
