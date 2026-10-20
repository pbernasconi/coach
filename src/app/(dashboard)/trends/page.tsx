import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { ownerForSignedInUser } from '@/lib/owner';
import { loadPerformance } from '@/lib/performance/queries';
import { loadLiftModel } from '@/lib/lift-dashboard/queries';
import { muscleSets, topLifts } from '@/lib/lift-dashboard/stats.mjs';
import { addDays, mondayOf, todayIn } from '@/lib/plan/week.mjs';
import SectionError from '@/components/SectionError';
import { load, safe } from '@/lib/safe';
import { DEFAULT_TARGETS, loadTargets } from '@/lib/status';
import { loadPmc } from '@/lib/performance/projection';
import { loadPeakPerformances } from '@/lib/performance/peaks';
import PeakPerformances from '@/components/performance/PeakPerformances';
import RampRates from '@/components/performance/RampRates';
import PerformanceView from '../PerformanceView';
import LiftSection from '../LiftSection';

export const metadata: Metadata = { title: 'Trends' };

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

/**
 * Trends: the deep dives that left the home page. The 12-week tiles, hours chart and table, ramp rates, peak
 * performances, and the Lift sets per muscle and main lifts.
 */
export default async function TrendsPage() {
  const userId = await ownerForSignedInUser();
  if (!userId) return <p data-smoke="trends" className="text-sm text-muted-foreground">This account has no Coach data.</p>;
  const today = todayIn(zone((await cookies()).get('tz')?.value));
  const monday = mondayOf(today);
  const [perf, targets, pmc, peaks, lift] = await Promise.all([
    load('Performance', () => loadPerformance(userId, today)),
    safe('targets', () => loadTargets(userId), DEFAULT_TARGETS),
    load('Ramp rates', () => loadPmc(userId, today)),
    load('Peak performances', () => loadPeakPerformances(userId, today)),
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
    <div className="space-y-6" data-smoke="trends">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Trends</h1>
          <p className="text-muted-foreground">The last 12 weeks: Strava, Lift and your plan.</p>
        </div>
        <Link href="/" className="text-sm underline underline-offset-4">← Today</Link>
      </div>
      {perf.ok ? <PerformanceView perf={perf.value} today={today} strengthTarget={targets.strength} /> : <SectionError label="Performance" />}
      {pmc.ok ? <RampRates ramp={pmc.value.ramp} /> : <SectionError label="Ramp rates" />}
      <div id="peaks" className="scroll-mt-20">
        {peaks.ok ? <PeakPerformances peaks={peaks.value} /> : <SectionError label="Peak performances" />}
      </div>
      <div id="lift" className="scroll-mt-20">
        {lift.ok ? <LiftSection {...lift.value} /> : <SectionError label="Lift" />}
      </div>
    </div>
  );
}
