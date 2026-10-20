import { ownerForSignedInUser } from '@/lib/owner';
import { safe } from '@/lib/safe';
import { dataBounds, loadLibrary, loadRange, userSettings } from '@/lib/plan/month';
import { initialRange, startWeek, topWeekFor } from '@/lib/plan/scroll.mjs';
import { cookieTimeZone } from '@/lib/plan/timezone';
import { loadForecast, placeFrom } from '@/lib/plan/weather';
import { mondayOf, todayIn } from '@/lib/plan/week.mjs';
import MonthCalendar from './MonthCalendar';
import './plan.css';

export const dynamic = 'force-dynamic';

type Search = { week?: string; month?: string };

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The Plan page: one continuous month calendar. It opens at ?month (its first week), at the week of ?week (old
 * week-view links), or around this week. ±4 weeks load here; the client loads more as it scrolls.
 */
export default async function PlanPage({ searchParams }: { searchParams: Promise<Search> }) {
  const userId = await ownerForSignedInUser();
  if (!userId) return <p data-smoke="plan" className="text-sm text-muted-foreground">This account has no Coach data.</p>;
  const timeZone = await cookieTimeZone();
  const today = todayIn(timeZone);
  const { week: weekParam, month: monthParam } = await searchParams;
  const settings = await userSettings(userId);
  const place = placeFrom(settings);

  const weekAnchor = weekParam && DAY.test(weekParam) ? mondayOf(weekParam) : null;
  const anchor = weekAnchor ?? startWeek(monthParam, today);
  const bounds = await safe('plan data bounds', () => dataBounds(userId), { earliest: null, planEnd: null });
  const first = initialRange(anchor, bounds.earliest);
  const [range, weather, library] = await Promise.all([
    loadRange(userId, first.from, first.to, today),
    loadForecast(place, timeZone),
    safe('workout library', () => loadLibrary(userId), []),
  ]);
  const openAt = weekAnchor ?? (monthParam && MONTH.test(monthParam) ? anchor : topWeekFor(anchor, bounds.earliest));
  return (
    <div data-smoke="plan">
      <MonthCalendar
        anchor={anchor}
        openAt={openAt}
        range={range}
        bounds={bounds}
        weather={weather}
        placeName={place.name}
        library={library}
        timeZone={timeZone}
      />
    </div>
  );
}
