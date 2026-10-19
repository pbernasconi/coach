import Link from 'next/link';
import { ownerForSignedInUser } from '@/lib/owner';
import { cookies } from 'next/headers';
import { loadPerformance } from '@/lib/performance/queries';
import { todayIn } from '@/lib/plan/week.mjs';
import PerformanceView from './PerformanceView';

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
  const perf = await loadPerformance(userId, today);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Performance</h1>
          <p className="text-muted-foreground">The last 12 weeks: Strava, Lift and your plan.</p>
        </div>
        <Link href="/plan" className="text-sm underline underline-offset-4">This week&apos;s plan →</Link>
      </div>
      <PerformanceView perf={perf} today={today} />
    </div>
  );
}
