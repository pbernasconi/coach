import type { Metadata } from 'next';
import LinkHotkeys from '@/components/hotkeys/LinkHotkeys';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SectionError from '@/components/SectionError';
import { ownerForSignedInUser } from '@/lib/owner';
import { load } from '@/lib/safe';
import { todayIn } from '@/lib/plan/week.mjs';
import { addDays } from '@/lib/vitals/readiness.mjs';
import { isCalendarDate } from '@/lib/vitals/sync.mjs';
import { loadDay, type DayView } from '@/lib/vitals/garmin-pages';
import DayDetail from './DayDetail';

export const metadata: Metadata = { title: 'Health day' };

export const dynamic = 'force-dynamic';

function zone(tz: string | undefined) {
  try {
    if (tz) {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return tz;
    }
  } catch {}
  return 'America/Los_Angeles';
}

const longDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** One day in detail, like Garmin's daily views: the night that ends on the day, then the day itself. */
export default async function HealthDayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date: raw } = await params;
  const today = todayIn(zone((await cookies()).get('tz')?.value));
  const date = raw === 'today' ? today : raw; // /health/day/today is today in the viewer's zone
  if (!isCalendarDate(date)) {
    return (
      <div data-smoke="health-day" className="space-y-2">
        <p className="text-sm text-muted-foreground">“{date.slice(0, 20)}” is not a date. Use /health/day/YYYY-MM-DD.</p>
        <Link href="/health" className="text-sm underline underline-offset-4">Back to Health</Link>
      </div>
    );
  }
  const userId = await ownerForSignedInUser();
  if (!userId) return <p data-smoke="health-day" className="text-sm text-muted-foreground">This account has no Coach data.</p>;
  const day = await load('Day details', () => loadDay(userId, date));
  const prev = addDays(date, -1);
  const next = addDays(date, 1);

  return (
    <div className="space-y-6" data-smoke="health-day">
      <LinkHotkeys
        links={[
          { key: '[', label: 'Previous day', href: `/health/day/${prev}` },
          { key: ']', label: 'Next day', href: next <= today ? `/health/day/${next}` : null },
          { key: 't', label: 'Today', href: date !== today ? `/health/day/${today}` : null },
          { key: 'b', label: 'Back to Health', href: '/health' },
        ]}
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <Link href="/health" className="text-sm text-muted-foreground underline-offset-4 hover:underline">← Health</Link>
          <h1 className="text-2xl font-semibold tracking-tight">{date === today ? `Today · ${longDate(date)}` : longDate(date)}</h1>
        </div>
        <nav className="flex items-center gap-1" aria-label="Other days">
          <Link href={`/health/day/${prev}`} className="inline-flex items-center rounded-md border px-3 py-2 text-sm sm:px-2 sm:py-1 hover:bg-accent" aria-label={`Previous day, ${longDate(prev)}`}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Link>
          {date !== today && (
            <Link href={`/health/day/${today}`} className="rounded-md border px-3 py-2 text-sm sm:px-2 sm:py-1 hover:bg-accent">Today</Link>
          )}
          {next <= today ? (
            <Link href={`/health/day/${next}`} className="inline-flex items-center rounded-md border px-3 py-2 text-sm sm:px-2 sm:py-1 hover:bg-accent" aria-label={`Next day, ${longDate(next)}`}>
              Next <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="inline-flex items-center rounded-md border px-3 py-2 text-sm sm:px-2 sm:py-1 text-muted-foreground opacity-50" aria-disabled>
              Next <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </nav>
      </div>
      {!day.ok ? (
        <SectionError label="Day details" />
      ) : date > today ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">This day is in the future.</p>
      ) : !day.value.hasData ? (
        <EmptyDay date={date} />
      ) : (
        <DayDetail d={day.value as DayView} />
      )}
    </div>
  );
}

function EmptyDay({ date }: { date: string }) {
  // The Garmin job (garmin.yml) copies each day after it runs; days before its first run are never loaded.
  return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No Garmin data for {longDate(date)}.</p>;
}
