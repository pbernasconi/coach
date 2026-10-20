'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { bookAction, cancelAction } from './actions';

export type GymDay = {
  date: string;
  days: string[];
  credits: number | null;
  reservations: { id: string; station: string; date: string; time: string; calendarLink: string }[];
  slots: { station: string; time: string; status: string }[];
};

function label(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
    day: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
  };
}

export default function GymBoard({ day }: { day: GymDay }) {
  const [pending, startTransition] = useTransition();
  const [pick, setPick] = useState<{ station: string; time: string } | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const stations = [...new Set(day.slots.map((s) => s.station))];

  function book() {
    if (!pick) return;
    startTransition(async () => {
      const r = await bookAction(day.date, pick.time, pick.station);
      if (r.ok) {
        toast.success(r.message, {
          description: `Credits left: ${r.credits ?? '?'}`,
          action: r.calendarLink ? { label: 'Add to calendar', onClick: () => window.open(r.calendarLink, '_blank') } : undefined,
          duration: 10000,
        });
        setPick(null);
      } else toast.error(r.message);
    });
  }

  function cancel(id: string) {
    if (cancelling !== id) return setCancelling(id);
    startTransition(async () => {
      const r = await cancelAction(id);
      setCancelling(null);
      if (r.ok) toast.success(r.message, { description: `Credits: ${r.credits ?? '?'}` });
      else toast.error(r.message);
    });
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">Gym · MX3 Castro</h1>
        <span className="text-sm text-muted-foreground">{day.credits ?? '?'} credits</span>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Your bookings</h2>
        {day.reservations.length === 0 && <p className="text-sm text-muted-foreground">None coming up.</p>}
        {day.reservations.map((r) => {
          const l = label(r.date);
          return (
            <div key={r.id} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="flex-1">
                <div className="font-medium">{l.weekday} {l.day} · {r.time}</div>
                <div className="text-sm text-muted-foreground">{r.station}</div>
              </div>
              <a href={r.calendarLink} target="_blank" rel="noreferrer" aria-label="Add to calendar" className="p-2 text-muted-foreground hover:text-foreground">
                <CalendarPlus className="h-5 w-5" />
              </a>
              <Button variant={cancelling === r.id ? 'destructive' : 'outline'} size="sm" disabled={pending} onClick={() => cancel(r.id)} onBlur={() => setCancelling(null)}>
                {cancelling === r.id ? 'Tap to confirm' : 'Cancel'}
              </Button>
            </div>
          );
        })}
      </section>

      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {day.days.map((d) => {
          const l = label(d);
          return (
            <Link
              key={d}
              href={`/gym?date=${d}`}
              className={cn('shrink-0 rounded-lg border px-3 py-2 text-center text-sm', d === day.date ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent')}
            >
              <div className="font-medium">{l.weekday}</div>
              <div className="text-xs opacity-80">{l.day}</div>
            </Link>
          );
        })}
      </nav>

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">Free private stations · tap one to book</h2>
        {stations.length === 0 && <p className="text-sm text-muted-foreground">Nothing free this day.</p>}
        {stations.map((st) => (
          <div key={st} className="space-y-2">
            <div className="text-sm font-medium">{st}</div>
            <div className="flex flex-wrap gap-2">
              {day.slots
                .filter((s) => s.station === st)
                .map((s) =>
                  s.status === 'mine' ? (
                    <span key={s.time} className="rounded-md bg-lime-400 px-3 py-2 text-sm font-medium text-black">{s.time} · yours</span>
                  ) : (
                    <button
                      key={s.time}
                      type="button"
                      onClick={() => setPick(pick?.station === st && pick.time === s.time ? null : { station: st, time: s.time })}
                      className={cn(
                        'rounded-md px-3 py-2 text-sm font-medium tabular-nums',
                        pick?.station === st && pick.time === s.time ? 'bg-primary text-primary-foreground' : 'bg-sky-500/15 text-sky-700 hover:bg-sky-500/25 dark:text-sky-300'
                      )}
                    >
                      {s.time}
                    </button>
                  )
                )}
            </div>
          </div>
        ))}
      </section>

      {pick && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-4 backdrop-blur">
          <div className="container mx-auto flex max-w-7xl items-center gap-3">
            <div className="flex-1 text-sm">
              <div className="font-medium">{pick.station} · {label(day.date).weekday} {label(day.date).day} · {pick.time}</div>
              <div className="text-muted-foreground">Uses 1 credit. Cancel at least 1 hour before.</div>
            </div>
            <Button variant="ghost" onClick={() => setPick(null)} disabled={pending}>Close</Button>
            <Button onClick={book} disabled={pending}>{pending ? 'Booking…' : 'Book'}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
