import type { Metadata } from 'next';
import { ownerForSignedInUser } from '@/lib/owner';
import { load } from '@/lib/safe';
import SectionError from '@/components/SectionError';
import { HOME_TZ } from '@/lib/calendar-sync/push.mjs';
import { loadPlannerWeek } from '@/lib/plan/planner-week';
import { addDays, mondayOf, todayIn } from '@/lib/plan/week.mjs';
import WeekPlanner from './WeekPlanner';

export const metadata: Metadata = { title: 'Plan the week' };
export const dynamic = 'force-dynamic';
// Drafting runs on the server in the background of its request (src/lib/planner/run.ts): up to 5 minutes.
export const maxDuration = 300;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The planning screen: one full-screen place to plan a week. Coach's draft on Paolo's calendar, with Last week,
 * Shape and Coach beside it, and one Accept. The Plan button in the navbar opens it (next week by default).
 */
export default async function PlanWeekPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const userId = await ownerForSignedInUser();
  if (!userId) return <p data-smoke="plan-week" className="text-sm text-muted-foreground">This account has no Coach data.</p>;
  const { week } = await searchParams;
  const today = todayIn(HOME_TZ);
  const weekStart = week && DAY.test(week) ? mondayOf(week) : addDays(mondayOf(today), 7);
  const data = await load('planning screen', () => loadPlannerWeek(userId, weekStart));
  if (!data.ok) {
    return (
      <div data-smoke="plan-week" className="py-6">
        <SectionError label="The planning screen" />
      </div>
    );
  }
  return (
    <div data-smoke="plan-week">
      <WeekPlanner key={data.value.weekStart} initial={data.value} />
    </div>
  );
}
