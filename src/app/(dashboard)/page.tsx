import Link from 'next/link';
import { ownerForSignedInUser } from '@/lib/owner';
import { cookies } from 'next/headers';
import { loadPerformance } from '@/lib/performance/queries';
import PerformanceView from './PerformanceView';
import TodayCard from './TodayCard';
import LiftSection from './LiftSection';
import { loadLiftModel } from '@/lib/lift-dashboard/queries';
import { muscleSets, topLifts } from '@/lib/lift-dashboard/stats.mjs';
import { loadWeek } from '@/lib/plan/queries';
import { addDays, mondayOf, todayIn } from '@/lib/plan/week.mjs';
import SectionError from '@/components/SectionError';
import { load, safe } from '@/lib/safe';
import { DEFAULT_TARGETS, loadTargets } from '@/lib/status';

export const dynamic = 'force-dynamic';

function zone(tz: string | undefined) {
  try {
    if (tz) {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return tz;
    }
  } catch {}
  return 'America/Los_Angeles';
}

export default async function PerformancePage() {
  const userId = await ownerForSignedInUser();
  if (!userId) return <p className="text-sm text-muted-foreground">This account has no Coach data.</p>;
  const today = todayIn(zone((await cookies()).get('tz')?.value));
  const monday = mondayOf(today);
  // Each section loads on its own: a failure shows SectionError for that section and leaves the others.
  const [perf, week, targets, lift] = await Promise.all([
    load('Performance', () => loadPerformance(userId, today)),
    load("This week's plan", () => loadWeek(userId, monday, today)),
    safe('targets', () => loadTargets(userId), DEFAULT_TARGETS),
    load('Lift', async () => {
      const { model, unit } = await loadLiftModel();
      return {
        thisWeek: muscleSets(model, monday, addDays(monday, 6)),
        last4: muscleSets(model, addDays(monday, -28), addDays(monday, -1)),
        top: topLifts(model, unit, addDays(monday, -77)),
        unit,
        hasData: model.sessions.size > 0,
      };
    }),
  ]);
  return (
    <div className="space-y-6" data-smoke="performance">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Performance</h1>
          <p className="text-muted-foreground">The last 12 weeks: Strava, Lift and your plan.</p>
        </div>
        <Link href="/plan" className="text-sm underline underline-offset-4">This week&apos;s plan →</Link>
      </div>
      {week.ok ? <TodayCard week={week.value} thisWeek={perf.ok ? perf.value.weeks.at(-1) : undefined} targets={targets} /> : <SectionError label="Today" />}
      {perf.ok ? <PerformanceView perf={perf.value} today={today} strengthTarget={targets.strength} /> : <SectionError label="Performance" />}
      {lift.ok ? <LiftSection {...lift.value} /> : <SectionError label="Lift" />}
    </div>
  );
}
