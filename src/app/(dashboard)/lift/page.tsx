import Link from 'next/link';
import SectionError from '@/components/SectionError';
import { ownerForSignedInUser } from '@/lib/owner';
import { loadLiftModel } from '@/lib/lift-dashboard/queries';
import { liftOverview } from '@/lib/lift-dashboard/overview.mjs';
import { exerciseList } from '@/lib/lift-dashboard/stats.mjs';
import { cookieTimeZone } from '@/lib/plan/timezone';
import { todayIn } from '@/lib/plan/week.mjs';
import { load, safe } from '@/lib/safe';
import { DEFAULT_TARGETS, loadTargets } from '@/lib/status';
import { loadBody } from '@/lib/vitals/garmin-pages';
import WeekHero from './WeekHero';
import MainLifts from './MainLifts';
import MuscleBars from './MuscleBars';
import SessionList from './SessionList';
import CoachTips from './CoachTips';
import Consistency from './Consistency';
import Records from './Records';
import ExerciseIndex from './ExerciseIndex';
import type { Overview } from './types';

export const dynamic = 'force-dynamic';

/**
 * Lift overview: this week against the strength target and what is next, then the progress that matters for the
 * "Lean and strong" goals (main lifts, arms and the other muscles against 10-20 hard sets a week), the sessions,
 * and plain tips from the numbers. The Today page's "Lean and strong" rail links here.
 */
export default async function LiftOverviewPage() {
  const userId = await ownerForSignedInUser();
  const today = todayIn(await cookieTimeZone());
  const [targets, body] = await Promise.all([
    userId ? safe('targets', () => loadTargets(userId), DEFAULT_TARGETS) : DEFAULT_TARGETS,
    userId ? safe('body', () => loadBody(userId, today), null) : null,
  ]);
  const loaded = await load('Lift', async () => {
    const { model, unit } = await loadLiftModel();
    const overview = liftOverview(model, unit, today, { strengthTarget: targets.strength, weightKg: body?.weight?.value ?? null }) as Overview;
    return { overview, exercises: exerciseList(model, unit) };
  });

  if (!loaded.ok) {
    return (
      <div data-smoke="lift">
        <SectionError label="Lift" />
      </div>
    );
  }
  const { overview: o, exercises } = loaded.value;

  if (o.totals.sessions === 0) {
    return (
      <div data-smoke="lift" className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">No sessions yet</p>
        Sessions appear here after the Lift app syncs. Connect Lift from <Link href="/settings" className="underline">Settings → Lift</Link>.
      </div>
    );
  }

  return (
    <div className="space-y-5" data-smoke="lift">
      <WeekHero o={o} />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          {/* On a phone the notes come first; from lg they sit at the top of the right column. */}
          <div className="lg:hidden"><CoachTips tips={o.tips} /></div>
          <MainLifts lifts={o.lifts} unit={o.unit} today={o.today} />
          <MuscleBars rows={o.muscles} />
          <SessionList sessions={o.sessions} upcoming={o.upcoming} unit={o.unit} today={o.today} />
          <ExerciseIndex exercises={exercises} unit={o.unit} />
        </div>
        <div className="min-w-0 space-y-5">
          <div className="hidden lg:block"><CoachTips tips={o.tips} /></div>
          <Consistency o={o} />
          <Records prs={o.prs} unit={o.unit} />
        </div>
      </div>
    </div>
  );
}
