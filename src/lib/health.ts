import { loadAppWorkout } from '@/lib/plan/app-workout';
import journal from '../../drizzle/meta/_journal.json';
import { openProposal } from '@/lib/plan/proposals';
import { GET as homeSummary } from '@/app/api/home/route';
import { GET as liftWeek } from '@/app/api/lift/week/route';
import { GET as appLiftRoute } from '@/app/api/app/lift/route';
import { GET as appLiftWeeklyRoute } from '@/app/api/app/lift/weekly/route';
import { GET as appLiftSessionRoute } from '@/app/api/app/lift/sessions/[id]/route';
import { GET as appLiftExerciseRoute } from '@/app/api/app/lift/exercises/[key]/route';
import { loadAppLift } from '@/lib/lift-dashboard/app-api';
import { exerciseResponse, failedSections, sessionResponse, weeklyResponse } from '@/lib/lift-dashboard/app-api.mjs';
import { richSession } from '@/lib/lift/session';
import { sql } from '@/db';
import { loadLiftModel } from '@/lib/lift-dashboard/queries';
import { exerciseDetail, exerciseList, muscleSets, sessionDetail, sessionSummaries, topLifts, weeklyVolume } from '@/lib/lift-dashboard/stats.mjs';
import { liftOverview } from '@/lib/lift-dashboard/overview.mjs';
import { loadPerformance } from '@/lib/performance/queries';
import { loadWeek, ownerId } from '@/lib/plan/queries';
import { loadDexa } from '@/lib/vitals/dexa-queries';
import { loadDexaPage } from '@/lib/vitals/dexa-store';
import { loadBodyspecStatus } from '@/lib/vitals/bodyspec-api';
import { addDays, mondayOf, todayIn } from '@/lib/plan/week.mjs';
import { loadCoachingNotes, loadStatus, loadTargets } from '@/lib/status';
import { loadLibrary, loadMonth, loadRange } from '@/lib/plan/month';
import { loadFeedback } from '@/lib/plan/feedback';
import { loadLiftWeeks } from '@/lib/plan/week-api';
import { loadPmc } from '@/lib/performance/projection';
import { loadPeakPerformances, loadRecentPeaks } from '@/lib/performance/peaks';
import { loadEventsWithCountdown } from '@/lib/performance/events';
import { loadClinicianNotes, loadGarminStatus, loadHealth } from '@/lib/vitals/queries';
import { loadBoard, loadBody, loadDay, loadRecoveryToday, loadTraining } from '@/lib/vitals/garmin-pages';
import { loadBiomarker, loadLabsIndex } from '@/lib/vitals/labs-pages';
import { loadActivity, loadActivityContext } from '@/lib/activity/queries';
import { appActivityResponse, loadAppActivities, loadAppActivity } from '@/lib/activity/app-api';
import { GET as appActivities } from '@/app/api/app/activities/route';
import { GET as appToday } from '@/app/api/app/today/route';
import { GET as appTrends } from '@/app/api/app/trends/route';
import { GET as appWeighIn } from '@/app/api/app/weigh-ins/[date]/route';
import { loadAppToday, loadAppTrends } from '@/lib/performance/app-pages';

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
    check('workout feedback', () => loadFeedback(userId, ['plan:health-check'], 'health-check')),
    check('plan proposal', () => openProposal(userId)),
    check('fitness projection', () => loadPmc(userId, today)),
    check('peak performances', () => loadPeakPerformances(userId, today)),
    check('recent peaks', () => loadRecentPeaks(userId, today)),
    check('events', () => loadEventsWithCountdown(userId, today)),
    check('health', () => loadHealth(userId, today)),
    check('clinician notes', () => loadClinicianNotes(userId)),
    check('body composition', () => loadDexa(userId)),
    check('dexa page', () => loadDexaPage(userId)),
    check('bodyspec status', () => loadBodyspecStatus(userId)),
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
    check('health board', () => loadBoard(userId, today, 90, null)),
    check('recovery today', () => loadRecoveryToday(userId, today)),
    check('body', () => loadBody(userId, today)),
    check('home week', () => loadRange(userId, monday, monday, today)),
    // GET /api/app/plan/{id} (the Lift app's workout page): the first planned workout of this week, if any.
    check('app planned workout', async () => {
      const first = (await loadRange(userId, monday, monday, today)).workouts[0];
      if (first && !(await loadAppWorkout(userId, String(first.id), today))) throw new Error('workout not found');
    }),
    // GET /api/lift/week (the Lift app's Week tab): this week and the next three.
    check('lift week', () => loadLiftWeeks(userId, monday, 4, today, 'America/Los_Angeles', now)),
    check('activity (latest)', async () => {
      const v = await loadActivity(userId, 'latest');
      if (v) await loadActivityContext(userId, v, today);
    }),
    // GET /api/app/activities and /api/app/activities/latest (the Lift app's Activities): a section that failed to
    // build is { ok: false } in the response, so it fails here.
    check('app activities', async () => {
      const list = await loadAppActivities(userId, null, 30, today, 'America/Los_Angeles', now);
      if (list && !list.plannedOk) throw new Error('planned titles failed');
    }),
    check('app activity (latest)', async () => {
      const body = (await loadAppActivity(userId, 'latest', today, 'America/Los_Angeles', now))?.body;
      const failed = body ? Object.entries(body).filter(([, x]) => x && typeof x === 'object' && (x as { ok?: boolean }).ok === false).map(([k]) => k) : [];
      if (failed.length) throw new Error(`sections failed: ${failed.join(', ')}`);
    }),
    // GET /api/app/today and /api/app/trends (the Lift app's Today and Trends): each section loads on its own and a
    // failed one is { ok: false } in the response, so it fails here.
    check('app today', async () => {
      const failed = Object.entries(await loadAppToday(userId, today, 'America/Los_Angeles', now)).filter(([, x]) => (x as { ok?: boolean })?.ok === false);
      if (failed.length) throw new Error(`sections failed: ${failed.map(([k]) => k).join(', ')}`);
    }),
    check('app trends', async () => {
      const failed = Object.entries(await loadAppTrends(userId, today, 'America/Los_Angeles', now)).filter(([, x]) => (x as { ok?: boolean })?.ok === false);
      if (failed.length) throw new Error(`sections failed: ${failed.map(([k]) => k).join(', ')}`);
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
    // GET /api/app/lift… (the Lift app's Lift tab): every section of the overview and the weekly table, and every
    // exercise screen, and the newest sessions. A route hides a failed section from the phone; this check fails on it.
    check('app lift', async () => {
      const tz = 'America/Los_Angeles';
      const bad = failedSections(await loadAppLift(userId, today, tz, now)).map((s) => `overview ${s}`);
      const { model, unit } = await loadLiftModel();
      bad.push(...failedSections(weeklyResponse({ weeks: weeklyVolume(model, unit), unit, now })).map((s) => `weekly ${s}`));
      // The newest 20 logged sessions and every planned one: each screen reads all sets, so all sessions would make
      // the check grow with the history; the shape is the same for every session.
      const summaries = sessionSummaries(model, unit, { planned: true });
      const logged = summaries.filter((s) => s.setsLogged > 0).slice(0, 20);
      for (const s of [...logged, ...summaries.filter((x) => x.setsLogged === 0)]) {
        const session = richSession(model, s.id, unit);
        if (session) bad.push(...failedSections(sessionResponse({ session, timeZone: tz, now })).map((x) => `session ${s.id} ${x}`));
      }
      for (const e of exerciseList(model, unit)) {
        const detail = exerciseDetail(model, e.key, unit);
        if (detail) bad.push(...failedSections(exerciseResponse({ detail, unit, now })).map((x) => `exercise ${e.key} ${x}`));
      }
      if (bad.length) throw new Error(`failed sections: ${bad.slice(0, 5).join(', ')}${bad.length > 5 ? ` and ${bad.length - 5} more` : ''}`);
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
  if (process.env.LIFT_SYNC_TOKEN) {
    checks.push(
      await check('/api/lift/week', async () => {
        const res = await liftWeek(
          new Request('http://health.local/api/lift/week?weeks=2&tz=America/Los_Angeles', { headers: { authorization: `Bearer ${process.env.LIFT_SYNC_TOKEN}` } })
        );
        if (res.status !== 200) throw new Error(`status ${res.status}: ${(await res.text()).slice(0, 200)}`);
      })
    );
    const auth = { headers: { authorization: `Bearer ${process.env.LIFT_SYNC_TOKEN}` } };
    checks.push(
      await check('/api/app/activities', async () => {
        const res = await appActivities(new Request('http://health.local/api/app/activities?limit=30&tz=America/Los_Angeles', auth));
        if (res.status !== 200) throw new Error(`status ${res.status}: ${(await res.text()).slice(0, 200)}`);
      }),
      // 404 only when there is no activity at all. The route's handler without its Strava fetch: a check never
      // calls Strava or after().
      await check('/api/app/activities/latest', async () => {
        const res = await appActivityResponse(new Request('http://health.local/api/app/activities/latest?tz=America/Los_Angeles', auth), 'latest', {
          fetchMissing: false,
        });
        if (res.status !== 200 && res.status !== 404) throw new Error(`status ${res.status}: ${(await res.text()).slice(0, 200)}`);
      })
    );
    checks.push(
      await check('/api/app/today', async () => {
        const res = await appToday(new Request('http://health.local/api/app/today?tz=America/Los_Angeles', auth));
        if (res.status !== 200) throw new Error(`status ${res.status}: ${(await res.text()).slice(0, 200)}`);
      }),
      await check('/api/app/trends', async () => {
        const res = await appTrends(new Request('http://health.local/api/app/trends?tz=America/Los_Angeles', auth));
        if (res.status !== 200) throw new Error(`status ${res.status}: ${(await res.text()).slice(0, 200)}`);
      }),
      // The screen a weigh-in push opens. 404 only when no weight was ever stored.
      await check('/api/app/weigh-ins/latest', async () => {
        const res = await appWeighIn(new Request('http://health.local/api/app/weigh-ins/latest', auth), {
          params: Promise.resolve({ date: 'latest' }),
        });
        if (res.status !== 200 && res.status !== 404) throw new Error(`status ${res.status}: ${(await res.text()).slice(0, 200)}`);
      })
    );
    checks.push(
      await check('/api/app/lift', async () => {
        const get = (path: string) => new Request(`http://health.local${path}`, auth);
        const { model, unit } = await loadLiftModel();
        const session = sessionSummaries(model, unit)[0]?.id;
        const exercise = exerciseList(model, unit)[0]?.key;
        const calls: [string, () => Promise<Response>][] = [
          ['/api/app/lift', () => appLiftRoute(get('/api/app/lift?tz=America/Los_Angeles'))],
          ['/api/app/lift/weekly', () => appLiftWeeklyRoute(get('/api/app/lift/weekly'))],
        ];
        if (session) calls.push(['/api/app/lift/sessions/:id', () => appLiftSessionRoute(get(`/api/app/lift/sessions/${session}`), { params: Promise.resolve({ id: session }) })]);
        if (exercise) {
          const key = encodeURIComponent(exercise);
          calls.push(['/api/app/lift/exercises/:key', () => appLiftExerciseRoute(get(`/api/app/lift/exercises/${key}`), { params: Promise.resolve({ key }) })]);
        }
        for (const [name, call] of calls) {
          const res = await call();
          if (res.status !== 200) throw new Error(`${name}: status ${res.status}: ${(await res.text()).slice(0, 200)}`);
        }
      })
    );
  }
  return checks;
}
