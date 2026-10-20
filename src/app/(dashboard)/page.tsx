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
import { loadTargets } from '@/lib/status';

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
  const [perf, week, targets, lift] = await Promise.all([
    loadPerformance(userId, today),
    loadWeek(userId, monday, today),
    loadTargets(userId),
    loadLiftModel(),
  ]);
  const liftView = {
    thisWeek: muscleSets(lift.model, monday, addDays(monday, 6)),
    last4: muscleSets(lift.model, addDays(monday, -28), addDays(monday, -1)),
    top: topLifts(lift.model, lift.unit, addDays(monday, -77)),
    unit: lift.unit,
    hasData: lift.model.sessions.size > 0,
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Performance</h1>
          <p className="text-muted-foreground">The last 12 weeks: Strava, Lift and your plan.</p>
        </div>
        <Link href="/plan" className="text-sm underline underline-offset-4">This week&apos;s plan →</Link>
      </div>
      <TodayCard week={week} thisWeek={perf.weeks.at(-1)} targets={targets} />
      <PerformanceView perf={perf} today={today} strengthTarget={targets.strength} />
      <LiftSection {...liftView} />
    </div>
  );
}
