import Link from 'next/link';
import type { WeekStats } from '@/lib/performance/queries';
import type { Week } from '@/lib/plan/queries';
import { zonesFor } from '@/lib/plan/zones.mjs';
import type { Targets } from '@/lib/status';

const ICON: Record<string, string> = { run: '🏃', ride: '🚴', swim: '🏊', strength: '🏋️', yoga: '🧘', rest: '😴', other: '•' };
const stripEmoji = (s: string) => s.replace(/^[\p{Extended_Pictographic}️‍\s]+/u, '');

function Bar({ label, value, target, fmt }: { label: string; value: number; target: number; fmt: (n: number) => string }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span>{fmt(value)} / {fmt(target)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Today's plan with its zones, and this week against the targets. */
export default function TodayCard({ week, thisWeek, targets }: { week: Week; thisWeek: WeekStats | undefined; targets: Targets }) {
  const today = week.workouts.filter((w) => w.date === week.today && w.status !== 'skipped');
  const plannedTss = week.workouts.filter((w) => w.status !== 'skipped').reduce((n, w) => n + (w.tss ?? 0), 0);
  const hm = (h: number) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
  return (
    <div className="grid gap-4 rounded-lg border p-4 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Today</h2>
          <Link href={`/plan#day-${week.today}`} className="text-xs underline underline-offset-4">Week plan →</Link>
        </div>
        {today.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {week.planId ? 'Nothing planned today.' : 'No plan this week. Run /plan in Claude Code to make one.'}
          </p>
        )}
        {today.map((w) => {
          const zones = zonesFor(w);
          return (
            <Link key={w.id} href={`/plan#w-${w.id}`} className="block space-y-2 rounded-md bg-muted/40 p-3 hover:bg-muted/70">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{ICON[w.sport] ?? '•'} {stripEmoji(w.title)}</span>
                <span className="text-xs text-muted-foreground">
                  {[w.startTime, w.duration ? `${w.duration} min` : null, w.tss ? `${Math.round(w.tss)} TSS` : null].filter(Boolean).join(' · ')}
                  {w.state === 'done' && ' · ✓ done'}
                </span>
              </div>
              {zones.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {zones.map((z) => (
                    <span key={z.label} className="rounded border bg-background px-2 py-0.5 text-xs">
                      <b>{z.zone}</b> {z.label}: {z.target}
                    </span>
                  ))}
                </div>
              )}
              {w.description && <p className="line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">{w.description}</p>}
            </Link>
          );
        })}
      </div>
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">This week</h2>
          <Link href="/settings" className="text-xs text-muted-foreground underline underline-offset-4">Targets</Link>
        </div>
        <Bar label="Run" value={thisWeek?.runKm ?? 0} target={targets.runKm} fmt={(n) => `${Math.round(n)} km`} />
        <Bar label="Ride" value={thisWeek?.rideHours ?? 0} target={targets.rideHours} fmt={hm} />
        <Bar label="Strength" value={thisWeek?.strength ?? 0} target={targets.strength} fmt={(n) => String(n)} />
        {plannedTss > 0 && <Bar label="TSS" value={thisWeek?.tss ?? 0} target={plannedTss} fmt={(n) => String(Math.round(n))} />}
      </div>
    </div>
  );
}
