import { ownerForSignedInUser } from '@/lib/owner';
import { safe } from '@/lib/safe';
import { loadWeek } from '@/lib/plan/queries';
import { dataBounds, importedIds, loadLibrary, loadRange, userSettings } from '@/lib/plan/month';
import { initialRange, monthOfWeek, startWeek, topWeekFor } from '@/lib/plan/scroll.mjs';
import { cookieTimeZone } from '@/lib/plan/timezone';
import { loadForecast, placeFrom } from '@/lib/plan/weather';
import { mondayOf, todayIn } from '@/lib/plan/week.mjs';
import MonthCalendar from './MonthCalendar';
import PlanBoard from './PlanBoard';
import ViewToggle from './ViewToggle';
import './plan.css';

export const dynamic = 'force-dynamic';

type Search = { week?: string; view?: string; month?: string };

export default async function PlanPage({ searchParams }: { searchParams: Promise<Search> }) {
  const userId = await ownerForSignedInUser();
  if (!userId) return <p data-smoke="plan" className="text-sm text-muted-foreground">This account has no Coach data.</p>;
  const timeZone = await cookieTimeZone();
  const today = todayIn(timeZone);
  const { week: weekParam, view, month: monthParam } = await searchParams;
  const settings = await userSettings(userId);
  const place = placeFrom(settings);

  if (view === 'month') {
    // A continuous calendar: it opens at ?month (its first week) or this week, with ±4 weeks loaded; the client
    // loads more weeks as it scrolls (loadWeeksAction).
    const anchor = startWeek(monthParam, today);
    const bounds = await safe('plan data bounds', () => dataBounds(userId), { earliest: null, planEnd: null });
    const first = initialRange(anchor, bounds.earliest);
    const [range, weather, library] = await Promise.all([
      loadRange(userId, first.from, first.to, today),
      loadForecast(place, timeZone),
      safe('workout library', () => loadLibrary(userId), []),
    ]);
    const month = monthOfWeek(anchor);
    return (
      <div data-smoke="plan">
        <MonthCalendar
          toolbar={<ViewToggle view="month" weekHref={`/plan?week=${anchor}`} monthHref={`/plan?view=month&month=${month}`} />}
          anchor={anchor}
          openAt={monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) ? anchor : topWeekFor(anchor, bounds.earliest)}
          range={range}
          bounds={bounds}
          weather={weather}
          placeName={place.name}
          library={library}
        />
      </div>
    );
  }

  const weekStart = mondayOf(/^\d{4}-\d{2}-\d{2}$/.test(weekParam ?? '') ? weekParam! : today);
  const [week, weather, library, imported] = await Promise.all([
    loadWeek(userId, weekStart, today),
    loadForecast(place, timeZone),
    loadLibrary(userId),
    importedIds(userId, weekStart),
  ]);
  return (
    <div data-smoke="plan" className="space-y-4">
      <ViewToggle view="week" weekHref={`/plan?week=${weekStart}`} monthHref={`/plan?view=month&month=${weekStart.slice(0, 7)}`} />
      <PlanBoard week={week} timeZone={timeZone} weather={weather} library={library} importedIds={imported} />
    </div>
  );
}
