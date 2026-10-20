import journal from '../../drizzle/meta/_journal.json';
import { GET as homeSummary } from '@/app/api/home/route';
import { sql } from '@/db';
import { loadLiftModel } from '@/lib/lift-dashboard/queries';
import { exerciseDetail, exerciseList, muscleSets, sessionDetail, sessionSummaries, topLifts, weeklyVolume } from '@/lib/lift-dashboard/stats.mjs';
import { liftOverview } from '@/lib/lift-dashboard/overview.mjs';
import { loadPerformance } from '@/lib/performance/queries';
import { loadWeek, ownerId } from '@/lib/plan/queries';
import { addDays, mondayOf, todayIn } from '@/lib/plan/week.mjs';
import { loadCoachingNotes, loadStatus, loadTargets } from '@/lib/status';
import { loadLibrary, loadMonth, loadRange } from '@/lib/plan/month';
import { loadPmc } from '@/lib/performance/projection';
import { loadPeakPerformances } from '@/lib/performance/peaks';
import { loadEventsWithCountdown } from '@/lib/performance/events';
import { loadClinicianNotes, loadGarminStatus, loadHealth } from '@/lib/vitals/queries';
import { loadBody, loadDay, loadGarminSections, loadRecoveryToday, loadTraining } from '@/lib/vitals/garmin-pages';
import { loadBiomarker, loadLabsIndex } from '@/lib/vitals/labs-pages';
import { loadActivity, loadActivityContext } from '@/lib/activity/queries';

export type Check = { name: string; ok: boolean; ms: number; error?: string };

async function check(name: string, run: () => Promise<unknown>): Promise<Check> {
  const start = Date.now();
  try {
    await run();
    return { name, ok: true, ms: Date.now() - start };
  } catch (error) {
    console.error(`[health] ${name} failed:`, error);
    const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return { name, ok: false, ms: Date.now() - start, error: text.slice(0, 300) };
  }
}

/**
 * Runs every loader and every calculation the pages and /api/home use, on the real data, without `safe()`. A row
 * that would break a page fails a check here. The deploy check and the scheduled check call this through
 * /api/health, and the CI integration test calls it on a seeded database.
 */
export async function runChecks(now = new Date(), { migrations = true }: { migrations?: boolean } = {}): Promise<Check[]> {
  const userId = await ownerId();
  if (!userId) return [{ name: 'owner', ok: false, ms: 0, error: 'no user row' }];
  const today = todayIn('America/Los_Angeles', now);
  const monday = mondayOf(today);
  const checks = await Promise.all([
    check('status', () => loadStatus(userId, now.getTime())),
    check('targets', () => loadTargets(userId)),
    check('coaching notes', () => loadCoachingNotes(userId)),
    check('performance', () => loadPerformance(userId, today)),
    check('week (this)', () => loadWeek(userId, monday, today)),
    check('week (next)', () => loadWeek(userId, addDays(monday, 7), today)),
    check('month', () => loadMonth(userId, today.slice(0, 7), today)),
    check('workout library', () => loadLibrary(userId)),
    check('fitness projection', () => loadPmc(userId, today)),
    check('peak performances', () => loadPeakPerformances(userId, today)),
    check('events', () => loadEventsWithCountdown(userId, today)),
    check('health', () => loadHealth(userId, today)),
    check('clinician notes', () => loadClinicianNotes(userId)),
    check('garmin', () => loadGarminStatus(userId, now.getTime())),
    check('health day', () => loadDay(userId, today)),
    check('health day (yesterday)', () => loadDay(userId, addDays(today, -1))),
    check('health training', () => loadTraining(userId, today)),
    check('lab results', () => loadLabsIndex(userId)),
    // Every biomarker page, so one odd catalog row fails here and not only on its page.
    check('lab biomarkers', async () => {
      const index = await loadLabsIndex(userId);
      const slugs = [...new Set(index.sections.flatMap((s) => s.items.map((i) => i.slug)))];
      for (const slug of slugs) if (!(await loadBiomarker(userId, slug))) throw new Error(`no page for ${slug}`);
    }),
    check('health garmin sections', () => loadGarminSections(userId, today)),
    check('recovery today', () => loadRecoveryToday(userId, today)),
    check('body', () => loadBody(userId, today)),
    check('home week', () => loadRange(userId, monday, monday, today)),
    check('activity (latest)', async () => {
      const v = await loadActivity(userId, 'latest');
      if (v) await loadActivityContext(userId, v, today);
    }),
    check('lift', async () => {
      const { model, unit } = await loadLiftModel();
      muscleSets(model, monday, addDays(monday, 6));
      topLifts(model, unit, addDays(monday, -77));
      // Every session page, so one odd row fails here and not only on its page.
      for (const s of sessionSummaries(model, unit)) sessionDetail(model, s.id, unit);
      weeklyVolume(model, unit);
      liftOverview(model, unit, today);
      for (const e of exerciseList(model, unit)) exerciseDetail(model, e.key, unit);
    }),
  ]);
  // Every migration in this deploy is applied (the Deploy workflow runs them before it promotes). Previews and the
  // check of a staged build before its merge (?skip=migrations) skip this check.
  if (migrations && process.env.VERCEL_ENV !== 'preview') {
    checks.push(
      await check('migrations', async () => {
        const rows = (await sql`SELECT hash FROM drizzle.__drizzle_migrations`) as { hash: string }[];
        if (rows.length < journal.entries.length) {
          throw new Error(`${journal.entries.length - rows.length} migration(s) not applied; run npm run db:migrate`);
        }
      })
    );
  }
  if (process.env.HOME_TOKEN) {
    checks.push(
      await check('/api/home', async () => {
        const res = await homeSummary(
          new Request('http://health.local/api/home?tz=America/Los_Angeles', { headers: { authorization: `Bearer ${process.env.HOME_TOKEN}` } })
        );
        if (res.status !== 200) throw new Error(`status ${res.status}: ${(await res.text()).slice(0, 200)}`);
      })
    );
  }
  return checks;
}
