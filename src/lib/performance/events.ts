import { sql } from '@/db';
import { countdown, sortEvents } from './events.mjs';

export type Priority = 'A' | 'B' | 'C';

/** An event or goal day from Settings → Events. */
export type CoachEvent = {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  priority: Priority;
  sport: string | null;
  notes: string | null;
  target: string | null;
};

/** An event with its countdown from today. */
export type EventWithCountdown = CoachEvent & { countdown: { days: number; weeks: number; restDays: number; label: string } };

type Row = Record<string, unknown>;

const toEvent = (r: Row): CoachEvent => ({
  id: String(r.id),
  name: String(r.name),
  date: String(r.date),
  priority: String(r.priority) as Priority,
  sport: (r.sport as string) ?? null,
  notes: (r.notes as string) ?? null,
  target: (r.target as string) ?? null,
});

/** Every event, oldest first. */
export async function loadEvents(userId: string): Promise<CoachEvent[]> {
  const rows = (await sql`
    SELECT id, name, to_char(date, 'YYYY-MM-DD') AS date, priority, sport, notes, target
    FROM events WHERE user_id = ${userId} ORDER BY date, priority`) as Row[];
  return rows.map(toEvent);
}

/** Events split into upcoming (soonest first) and past (latest first), each with its countdown. */
export async function loadEventsWithCountdown(userId: string, today: string) {
  const all = await loadEvents(userId);
  const add = (e: CoachEvent): EventWithCountdown => ({ ...e, countdown: countdown(today, e.date) });
  const { upcoming, past } = sortEvents(all, today) as { upcoming: CoachEvent[]; past: CoachEvent[] };
  return { upcoming: upcoming.map(add), past: past.map(add) };
}

/** Events from today to today + `days`, soonest first, for the home page and the PMC chart. */
export async function loadUpcomingEvents(userId: string, today: string, days = 365): Promise<EventWithCountdown[]> {
  const rows = (await sql`
    SELECT id, name, to_char(date, 'YYYY-MM-DD') AS date, priority, sport, notes, target
    FROM events
    WHERE user_id = ${userId} AND date >= ${today}::date AND date <= ${today}::date + ${days}::int
    ORDER BY date, priority`) as Row[];
  return rows.map(toEvent).map((e) => ({ ...e, countdown: countdown(today, e.date) }));
}
