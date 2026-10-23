import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { ownerForSignedInUser } from '@/lib/owner';
import { loadPerformance } from '@/lib/performance/queries';
import { last4Tiles, lastWeeks, longDate, staleText } from '@/lib/performance/display.mjs';
import { loadLiftModel } from '@/lib/lift-dashboard/queries';
import { muscleSets, topLifts } from '@/lib/lift-dashboard/stats.mjs';
import { liftOverview } from '@/lib/lift-dashboard/overview.mjs';
import { loadRange, userSettings } from '@/lib/plan/month';
import { loadForecast, placeFrom } from '@/lib/plan/weather';
import { addDays, mondayOf, todayIn } from '@/lib/plan/week.mjs';
import SectionError from '@/components/SectionError';
import { load, safe } from '@/lib/safe';
import { DEFAULT_TARGETS, loadTargets } from '@/lib/status';
import { loadPmc } from '@/lib/performance/projection';
import { loadRecentPeaks } from '@/lib/performance/peaks';
import { loadBody, loadRecoveryToday } from '@/lib/vitals/garmin-pages';
import PmcSection from '@/components/performance/PmcSection';
import { sql } from '@/db';
import { loadGoals, measureGoals } from '@/lib/goals/goals.mjs';
import FitnessPanel, { RecoveryCard } from './FitnessPanel';
import GoalsCard from './GoalsCard';
import HomeWeek from './HomeWeek';
import LeanStrong from './LeanStrong';

export const metadata: Metadata = { title: 'Today' };

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
 * Home ("Today"): this week as in Plan, the fitness chart and the last 4 weeks; a right rail with recovery today,
 * the fitness panel (fatigue, fitness, form, ramp rates, recent peaks) and "Lean and strong" (weight, arms, main
 * lifts); then the goals. The deep dives are on /trends.
 */
export default async function HomePage() {
  const userId = await ownerForSignedInUser();
  if (!userId) return <p data-smoke="performance" className="text-sm text-muted-foreground">This account has no Coach data.</p>;
  const timeZone = zone((await cookies()).get('tz')?.value);
  const today = todayIn(timeZone);
  const monday = mondayOf(today);
  // Each section loads on its own: a failure shows SectionError for that section and leaves the others.
  const [perf, week, weather, targets, lift, pmc, recovery, body, goals, peaks] = await Promise.all([
    load('Performance', () => loadPerformance(userId, today)),
    load('This week', () => loadRange(userId, monday, monday, today)),
    safe('weather', async () => loadForecast(placeFrom(await userSettings(userId)), timeZone), {}),
    safe('targets', () => loadTargets(userId), DEFAULT_TARGETS),
    safe(
      'lift',
      async () => {
        const { model, unit } = await loadLiftModel();
        const o = liftOverview(model, unit, today);
        return {
          thisWeek: muscleSets(model, monday, addDays(monday, 6)),
          top: topLifts(model, unit, addDays(monday, -77)),
          unit,
          hasData: model.sessions.size > 0,
          last: o.last ? { id: o.last.id, day: o.last.day, title: o.last.title } : null,
          daysSince: o.daysSince,
          next: o.upcoming[0] ? { id: o.upcoming[0].id, day: o.upcoming[0].day, title: o.upcoming[0].title } : null,
          prs: o.prs.filter((r) => r.day >= addDays(today, -14)).length,
        };
      },
      null
    ),
    load('Fitness and form', () => loadPmc(userId, today)),
    safe('recovery today', () => loadRecoveryToday(userId, today), null),
    safe('body', () => loadBody(userId, today), null),
    load('Goals', async () => measureGoals(sql, userId, await loadGoals(sql, userId), today)),
    safe('recent peaks', () => loadRecentPeaks(userId, today, { maxRank: 1, limit: 4 }), null),
  ]);

  const r = recovery?.hasData ? recovery : null;
  const weeks = perf.ok ? perf.value.weeks : [];
  const { last4 } = lastWeeks(weeks, monday);
  const thisWeek = weeks.find((w) => w.week === monday);
  const stale = perf.ok ? staleText(perf.value.latestActivity, today) : null;
  const dateLabel = longDate(today);

  return (
    <div className="space-y-5" data-smoke="performance">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--viz-muted)]">{dateLabel}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
      </div>

      {stale && <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">{stale}</div>}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          {week.ok ? (
            <HomeWeek range={week.value} weather={weather} />
          ) : (
            <SectionError label="This week" />
          )}
          <div id="fitness" className="scroll-mt-20">
            {pmc.ok ? <PmcSection pmc={pmc.value} ramp={false} /> : <SectionError label="Fitness and form" />}
          </div>
          {perf.ok && last4.length > 0 && (
            <section className="grid grid-cols-2 gap-y-4 rounded-lg border bg-[var(--viz-surface)] py-4 sm:grid-cols-4" aria-label="Last 4 weeks">
              {last4Tiles(last4, targets.strength).map(({ label, valueText: value, noteText: note, sport }, i) => (
                <div key={label} className={`min-w-0 px-4 ${i % 2 ? 'border-l' : ''} ${i === 2 ? 'sm:border-l' : ''}`}>
                  <div className="flex items-center gap-1.5 text-xs text-[var(--viz-muted)]">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: sport === 'strength' ? 'var(--sport-strength)' : sport ? `var(--viz-${sport})` : 'var(--viz-ink)' }} aria-hidden />
                    {label}
                  </div>
                  <div className="text-2xl font-semibold tabular-nums tracking-tight text-[var(--viz-ink)]">{value}</div>
                  <div className="text-xs tabular-nums text-[var(--viz-ink-2)]">{note}</div>
                </div>
              ))}
            </section>
          )}
        </div>
        <div className="min-w-0 space-y-5">
          <RecoveryCard recovery={r} today={today} />
          <FitnessPanel pmc={pmc.ok ? pmc.value : null} peaks={peaks} />
          <LeanStrong body={body} lift={lift} strength={{ done: thisWeek?.strength ?? 0, target: targets.strength }} />
        </div>
      </div>

      {goals.ok ? <GoalsCard goals={goals.value} /> : <SectionError label="Goals" />}

      <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="More">
        <Link href="/trends#peaks" className="text-brand-ink underline-offset-4 hover:underline">Peak performances →</Link>
        <Link href="/trends" className="text-brand-ink underline-offset-4 hover:underline">Every week and ramp rates →</Link>
        <Link href="/trends#lift" className="text-brand-ink underline-offset-4 hover:underline">Sets per muscle →</Link>
      </nav>
    </div>
  );
}
