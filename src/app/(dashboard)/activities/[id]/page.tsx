import Link from 'next/link';
import { cookies } from 'next/headers';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import SectionError from '@/components/SectionError';
import LinkHotkeys from '@/components/hotkeys/LinkHotkeys';
import SportIcon from '@/components/SportIcon';
import { loadActivity, loadActivityContext } from '@/lib/activity/queries';
import { toDate } from '@/lib/db-time.mjs';
import { ownerForSignedInUser } from '@/lib/owner';
import { todayIn } from '@/lib/plan/week.mjs';
import { load } from '@/lib/safe';
import { sport, stravaTypeLabel } from '@/lib/sports';
import ActivityFetcher from './ActivityFetcher';
import { ActivityHoverProvider } from './ActivityHover';
import { ActivityBody, sectionsFor } from './Sections';

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

/** 'Tuesday, October 14, 2026 at 6:34 AM' from the activity's own clock time. */
function when(local: string) {
  const d = toDate(local); // a clock time with no zone: read as UTC, and shown in UTC
  if (!d) return local;
  const date = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
  return `${date} at ${time}`;
}

/**
 * One activity as Strava shows it (overview, analysis, laps, best efforts, segments), with Coach's view of it.
 * /activities/<Strava id>, or /activities/latest for the newest activity (the deploy check renders that one).
 */
export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw).slice(0, 40);
  const userId = await ownerForSignedInUser();
  if (!userId) return <p data-smoke="activity" className="text-sm text-muted-foreground">This account has no Coach data.</p>;
  const today = todayIn(zone((await cookies()).get('tz')?.value));
  const activity = await load('Activity', () => loadActivity(userId, id));
  if (!activity.ok) {
    return (
      <div data-smoke="activity" className="space-y-4">
        <Link href="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">← Performance</Link>
        <SectionError label="Activity" />
      </div>
    );
  }
  const v = activity.value;
  if (!v) {
    return (
      <div data-smoke="activity" className="space-y-2">
        <Link href="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">← Performance</Link>
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {id === 'latest' ? 'No Strava activities yet. Connect Strava in Settings.' : `No activity “${id}” in Coach. New Strava activities appear after the next sync.`}
        </p>
      </div>
    );
  }
  const context = await load("Coach's view", () => loadActivityContext(userId, v, today));
  const s = sport(v.sport);
  const sections = sectionsFor(v);

  return (
    <ActivityHoverProvider>
      <div data-smoke="activity" className="lg:grid lg:grid-cols-[176px_minmax(0,1fr)] lg:gap-8">
        <nav aria-label="Activity sections" className="sticky top-16 z-20 -mx-4 mb-4 overflow-x-auto border-b bg-background/95 px-4 backdrop-blur sm:-mx-6 sm:px-6 lg:top-24 lg:mx-0 lg:mb-0 lg:self-start lg:overflow-visible lg:border-0 lg:bg-transparent lg:px-0">
          <ul className="flex gap-1 py-2 text-sm lg:flex-col lg:gap-0.5 lg:py-0">
            {sections.map((sec) => (
              <li key={sec.id} className={sec.sub ? 'lg:pl-3' : ''}>
                <a href={`#${sec.id}`} className={`block whitespace-nowrap rounded-md px-2.5 py-1.5 hover:bg-accent ${sec.sub ? 'text-muted-foreground lg:text-[13px]' : 'font-medium'}`}>
                  {sec.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-8">
          <header className="space-y-3">
            <LinkHotkeys
              links={[
                { key: '[', label: 'Older activity', href: v.prevId && `/activities/${v.prevId}` },
                { key: ']', label: 'Newer activity', href: v.nextId && `/activities/${v.nextId}` },
                { key: 'b', label: 'Back to the plan week', href: `/plan?week=${v.day}` },
              ]}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <Link href={`/plan?week=${v.day}`} className="text-muted-foreground underline-offset-4 hover:underline">← Plan</Link>
              <div className="flex items-center gap-1">
                {v.prevId ? (
                  <Link href={`/activities/${v.prevId}`} className="inline-flex items-center rounded-md border px-2 py-1 hover:bg-accent" aria-label="Previous activity"><ChevronLeft className="h-4 w-4" /> Older</Link>
                ) : null}
                {v.nextId ? (
                  <Link href={`/activities/${v.nextId}`} className="inline-flex items-center rounded-md border px-2 py-1 hover:bg-accent" aria-label="Next activity">Newer <ChevronRight className="h-4 w-4" /></Link>
                ) : null}
                <a href={`https://www.strava.com/activities/${v.stravaId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-accent">
                  Open on Strava <ExternalLink aria-hidden className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted"><SportIcon id={v.sport} className="h-5 w-5" /></span>
              <div className="min-w-0">
                <h1 id="overview" className="scroll-mt-32 text-2xl font-semibold tracking-tight">{v.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {when(v.startLocal)}
                  {v.place ? ` · ${v.place}` : ''} · {stravaTypeLabel(v.sportType)}
                  {v.trainer ? ' · indoor' : ''}
                  {v.commute ? ' · commute' : ''}
                </p>
                {v.description && <p className="mt-2 whitespace-pre-wrap text-sm">{v.description}</p>}
              </div>
            </div>
            {v.fetch.needed && <ActivityFetcher stravaId={v.stravaId} />}
            {!v.fetch.needed && v.fetch.note && <p className="text-xs text-muted-foreground">{v.fetch.note}</p>}
          </header>

          <ActivityBody v={v} context={context.ok ? context.value : null} contextFailed={!context.ok} color={s.color} />
        </div>
      </div>
    </ActivityHoverProvider>
  );
}
