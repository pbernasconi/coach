import Link from 'next/link';

type MuscleRow = { muscle: string; sets: number; status: string };
type TopLift = { key: string; name: string; sessions: number; points: { day: string; e1rm: number }[]; latest: number | null; change: number | null };

const label = (m: string) => m.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

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
  const MAX = 24;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-semibold">Hard sets per muscle</h2>
          <span className="text-xs text-muted-foreground">this week · bar mark: 4-week average · band 10–20</span>
        </div>
        <div className="space-y-2">
          {muscles.map((m) => (
            <div key={m.muscle} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-2 text-xs">
              <span className="truncate">{label(m.muscle)}</span>
              <div className="relative h-2 rounded-full bg-muted">
                <div className="absolute inset-y-0 rounded-full bg-emerald-500/15" style={{ left: `${(10 / MAX) * 100}%`, width: `${(10 / MAX) * 100}%` }} />
                <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${Math.min(100, (m.week / MAX) * 100)}%` }} />
                <div className="absolute -inset-y-0.5 w-0.5 bg-foreground/60" style={{ left: `${Math.min(100, (m.avg / MAX) * 100)}%` }} title={`4-week average ${m.avg.toFixed(1)}`} />
              </div>
              <span className="text-right">{m.week % 1 ? m.week.toFixed(1) : m.week}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border p-4">
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
