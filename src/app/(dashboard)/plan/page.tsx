import type { Metadata } from 'next';
import { ownerForSignedInUser } from '@/lib/owner';
import { safe } from '@/lib/safe';
import { dataBounds, loadLibrary, loadRange, userSettings } from '@/lib/plan/month';
import { initialRange, startWeek, topWeekFor } from '@/lib/plan/scroll.mjs';
import { cookieTimeZone } from '@/lib/plan/timezone';
import { loadForecast, placeFrom } from '@/lib/plan/weather';
import { addDays, mondayOf, todayIn } from '@/lib/plan/week.mjs';
import MonthCalendar from './MonthCalendar';
import CoachPlanner from './CoachPlanner';
import { openProposal } from '@/lib/plan/proposals';
import { loadOutlook } from '@/lib/plan/planning-context';
import './plan.css';

export const metadata: Metadata = { title: 'Plan' };

export const dynamic = 'force-dynamic';

type Search = { week?: string; month?: string; open?: string };

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ITEM = /^[wal]-\S{1,200}$/;

/**
 * The Plan page: one continuous month calendar. It opens at ?month (its first week), at the week of ?week (old
 * week-view links), or around this week. ±4 weeks load here; the client loads more as it scrolls.
 */
export default async function PlanPage({ searchParams }: { searchParams: Promise<Search> }) {
  const userId = await ownerForSignedInUser();
  if (!userId) return <p data-smoke="plan" className="text-sm text-muted-foreground">This account has no Coach data.</p>;
  const timeZone = await cookieTimeZone();
  const today = todayIn(timeZone);
  const { week: weekParam, month: monthParam, open: openParam } = await searchParams;
  const settings = await userSettings(userId);
  const place = placeFrom(settings);

  const weekAnchor = weekParam && DAY.test(weekParam) ? mondayOf(weekParam) : null;
  const anchor = weekAnchor ?? startWeek(monthParam, today);
  const bounds = await safe('plan data bounds', () => dataBounds(userId), { earliest: null, planEnd: null });
  const first = initialRange(anchor, bounds.earliest);
  const [range, weather, library, proposal] = await Promise.all([
    loadRange(userId, first.from, first.to, today),
    loadForecast(place, timeZone),
    safe('workout library', () => loadLibrary(userId), []),
    // The cloud coach bar is optional: without it the calendar still renders.
    safe('plan proposal', () => openProposal(userId), null),
  ]);
  // A plan waiting for review: its load outlook now, so the review opens complete.
  const outlook = proposal?.status === 'proposed' ? await safe('plan outlook', () => loadOutlook(userId, proposal), null) : null;
  const openAt = weekAnchor ?? (monthParam && MONTH.test(monthParam) ? anchor : topWeekFor(anchor, bounds.earliest));
  return (
    <div data-smoke="plan">
      <CoachPlanner initial={proposal} thisWeek={mondayOf(today)} nextWeek={addDays(mondayOf(today), 7)} today={today} outlook={outlook} weather={weather} />
      <MonthCalendar
        anchor={anchor}
        openAt={openAt}
        range={range}
        bounds={bounds}
        weather={weather}
        placeName={place.name}
        library={library}
        timeZone={timeZone}
        openItem={openParam && ITEM.test(openParam) ? openParam : undefined}
      />
    </div>
  );
}
