'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { addDays, mondayOf, todayIn } from '@/lib/plan/week.mjs';

/** Paolo's home zone (the planner's; calendar-sync/push.mjs is server-only). */
const HOME_TZ = 'America/Los_Angeles';

const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { ...o, timeZone: 'UTC' });

/** "Nov 9–15" or "Nov 30 – Dec 6". */
function label(monday: string) {
  const end = addDays(monday, 6);
  return monday.slice(5, 7) === end.slice(5, 7)
    ? `${fmt(monday, { month: 'short', day: 'numeric' })}–${Number(end.slice(8))}`
    : `${fmt(monday, { month: 'short', day: 'numeric' })} – ${fmt(end, { month: 'short', day: 'numeric' })}`;
}

/** Sunday from 6 pm to Monday noon in Paolo's time zone: when next week is due to be planned. */
function due(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: HOME_TZ, weekday: 'short', hour: 'numeric', hourCycle: 'h23' })
      .formatToParts(now).map((p) => [p.type, p.value]),
  );
  const h = Number(parts.hour);
  return (parts.weekday === 'Sun' && h >= 18) || (parts.weekday === 'Mon' && h < 12);
}

/**
 * The one way into weekly planning: a small "Plan <next week>" pill in the navbar. It opens the planning screen
 * (/plan/week). An orange dot shows from Sunday 6 pm, when the weekend has synced and the week is due.
 */
export default function PlanWeekButton() {
  const pathname = usePathname();
  // Computed after mount: the server's clock and zone may differ from the browser's.
  const [state, setState] = useState<{ week: string; due: boolean } | null>(null);
  useEffect(() => {
    const now = new Date();
    const today = todayIn(HOME_TZ, now);
    // On Monday morning "next week" is the week that just started.
    const week = due(now) && fmt(today, { weekday: 'short' }) === 'Mon' ? mondayOf(today) : addDays(mondayOf(today), 7);
    setState({ week, due: due(now) });
  }, [pathname]);
  if (!state) return <span className="hidden h-8 w-28 md:block" />;
  const on = pathname.startsWith('/plan/week');
  return (
    <Link
      href={`/plan/week?week=${state.week}`}
      title="Plan the week"
      className={cn(
        'hidden h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors outline-none md:inline-flex',
        'focus-visible:ring-2 focus-visible:ring-ring',
        on ? 'border-brand/40 bg-brand-soft text-foreground' : 'border-brand-wash-line bg-background/70 text-muted-foreground hover:text-foreground',
      )}
    >
      {state.due && <span aria-label="Due now" className="size-2 rounded-full bg-brand" />}
      Plan {label(state.week)}
    </Link>
  );
}
