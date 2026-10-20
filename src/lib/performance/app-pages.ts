import { sql } from '@/db';
import { loadGoals, measureGoals } from '@/lib/goals/goals.mjs';
import { loadLiftModel } from '@/lib/lift-dashboard/queries';
import { liftOverview } from '@/lib/lift-dashboard/overview.mjs';
import { muscleSets, topLifts } from '@/lib/lift-dashboard/stats.mjs';
import { loadRange } from '@/lib/plan/month';
import { addDays, mondayOf } from '@/lib/plan/week.mjs';
import { load, safe } from '@/lib/safe';
import { SPORTS, sport } from '@/lib/sports';
import { DEFAULT_TARGETS, loadTargets } from '@/lib/status';
import { loadBody, loadRecoveryToday } from '@/lib/vitals/garmin-pages';
import { loadPeakPerformances } from './peaks';
import { loadPmc } from './projection';
import { loadPerformance } from './queries';
import { todayResponse } from './today-api.mjs';
import { trendsResponse } from './trends-api.mjs';

const sports = { known: new Set<string>(SPORTS.map((s) => s.id)), label: (id: string) => sport(id).label };

/**
 * GET /api/app/today (lift/APP-API.md): the loaders of the web's Today page (src/app/(dashboard)/page.tsx), each
 * section on its own, shaped by today-api.mjs. Weather and the week grid are left out (the week is /api/lift/week).
 */
export async function loadAppToday(userId: string, today: string, timeZone: string, now = new Date()) {
  const monday = mondayOf(today);
  const [perf, week, targets, lift, pmc, recovery, body, goals] = await Promise.all([
    load('Performance', () => loadPerformance(userId, today)),
    load('This week', () => loadRange(userId, monday, monday, today)),
    safe('targets', () => loadTargets(userId), DEFAULT_TARGETS),
    load('Lift', async () => {
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
        prs: o.prs.filter((r: { day: string }) => r.day >= addDays(today, -14)).length,
      };
    }),
    load('Fitness and form', () => loadPmc(userId, today)),
    safe('recovery today', () => loadRecoveryToday(userId, today), null),
    load('Body', () => loadBody(userId, today)),
    load('Goals', async () => measureGoals(sql, userId, await loadGoals(sql, userId), today)),
  ]);
  return todayResponse({ now, timeZone, today, perf, week, pmc, lift, body, goals, recovery, strengthTarget: targets.strength, sports });
}

/** GET /api/app/trends (lift/APP-API.md): the loaders of the web's Trends page, shaped by trends-api.mjs. */
export async function loadAppTrends(userId: string, today: string, timeZone: string, now = new Date()) {
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
  return trendsResponse({ now, timeZone, today, perf, pmc, peaks, lift, strengthTarget: targets.strength, sports: SPORTS });
}
