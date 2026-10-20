import { GET as homeSummary } from '@/app/api/home/route';
import { loadLiftModel } from '@/lib/lift-dashboard/queries';
import { exerciseDetail, exerciseList, muscleSets, sessionSummaries, topLifts, weeklyVolume } from '@/lib/lift-dashboard/stats.mjs';
import { loadPerformance } from '@/lib/performance/queries';
import { loadWeek, ownerId } from '@/lib/plan/queries';
import { addDays, mondayOf, todayIn } from '@/lib/plan/week.mjs';
import { loadCoachingNotes, loadStatus, loadTargets } from '@/lib/status';

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
export async function runChecks(now = new Date()): Promise<Check[]> {
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
    check('lift', async () => {
      const { model, unit } = await loadLiftModel();
      muscleSets(model, monday, addDays(monday, 6));
      topLifts(model, unit, addDays(monday, -77));
      sessionSummaries(model, unit);
      weeklyVolume(model, unit);
      for (const e of exerciseList(model, unit)) exerciseDetail(model, e.key, unit);
    }),
  ]);
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
