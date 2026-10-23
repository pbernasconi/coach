import Link from 'next/link';
import SectionError from '@/components/SectionError';
import { ownerForSignedInUser } from '@/lib/owner';
import { loadLiftModel } from '@/lib/lift-dashboard/queries';
import { liftOverview } from '@/lib/lift-dashboard/overview.mjs';
import { exerciseList } from '@/lib/lift-dashboard/stats.mjs';
import { cookieTimeZone } from '@/lib/plan/timezone';
import { todayIn } from '@/lib/plan/week.mjs';
import { load, safe } from '@/lib/safe';
import { DEFAULT_TARGETS, loadLiftFocus, loadTargets } from '@/lib/status';
import { loadBody } from '@/lib/vitals/garmin-pages';
import WeekHero from './WeekHero';
import MainLifts from './MainLifts';
import MuscleBars from './MuscleBars';
import SessionList from './SessionList';
import CoachTips from './CoachTips';
import Consistency from './Consistency';
import Records from './Records';
import ExerciseIndex from './ExerciseIndex';
import RecentLifts from './RecentLifts';
import { exerciseMedia } from '@/lib/lift/catalog';
import { richSession, type RichSession } from '@/lib/lift/session';
import type { Overview } from './types';

export const dynamic = 'force-dynamic';

const RECENT = 3;

/**
 * Lift overview: this week against the strength target and what is next, then the progress that matters for the
 * "Lean and strong" goals (main lifts, arms and the other muscles against 10-20 hard sets a week), the sessions,
 * and plain tips from the numbers. The Today page's "Lean and strong" rail links here.
 */
export default async function LiftOverviewPage() {
  const userId = await ownerForSignedInUser();
  const today = todayIn(await cookieTimeZone());
  const [targets, body, focus] = await Promise.all([
    userId ? safe('targets', () => loadTargets(userId), DEFAULT_TARGETS) : DEFAULT_TARGETS,
    userId ? safe('body', () => loadBody(userId, today), null) : null,
    userId ? safe('lift focus', () => loadLiftFocus(userId), null) : null,
  ]);
  const loaded = await load('Lift', async () => {
    const { model, unit } = await loadLiftModel();
    const overview = liftOverview(model, unit, today, { strengthTarget: targets.strength, weightKg: body?.weight?.value ?? null, focus }) as Overview;
    // Catalog pictures (the iPhone app's own), for the lift cards and the records.
    for (const l of overview.lifts) {
      const m = exerciseMedia(l.catalogId);
      l.image = m?.image ?? null;
      l.gif = m?.gif ?? null;
    }
    for (const r of overview.prs) r.image = exerciseMedia(r.catalogId)?.image ?? null;
    const recent = overview.sessions
      .slice(0, RECENT)
      .map((s) => richSession(model, s.id, unit))
      .filter((d): d is RichSession => d !== null);
    return { overview, recent, exercises: exerciseList(model, unit) };
  });

  if (!loaded.ok) {
    return (
      <div data-smoke="lift">
        <SectionError label="Lift" />
      </div>
    );
  }
  const { overview: o, recent, exercises } = loaded.value;
  const tz = await cookieTimeZone();
  const prsBySession = new Map(o.sessions.map((s) => [s.id, s.prs]));

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
          <RecentLifts sessions={recent} prs={prsBySession} tz={tz} />
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
