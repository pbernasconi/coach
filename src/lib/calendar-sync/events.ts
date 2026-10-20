import { sql } from '@/db';

/** A calendar event in the shape the Dia start page reads (dia-home: data/feed.json `events`). */
export type HomeEvent = {
  id: string;
  calendarId: string;
  calendar: string; // me | family | training (users.settings.calendars label)
  title: string;
  start: string; // ISO time, or YYYY-MM-DD for an all-day event
  end: string;
  allDay: boolean;
  location: string;
  meetUrl: string;
  link: string;
  description: string;
  attendees: { name: string; email: string; status: string; organizer: boolean }[];
};

type Row = Record<string, unknown>;
type Attendee = { displayName?: string; email?: string; responseStatus?: string; organizer?: boolean; self?: boolean; resource?: boolean };

/**
 * The owner's events from `from` for `days` days, from every synced calendar. Cancelled events, and events the owner
 * declined, are left out; so are room resources in the attendee list.
 */
export async function homeEvents(userId: string, from: Date, days: number): Promise<HomeEvent[]> {
  const to = new Date(from.getTime() + days * 86_400_000);
  const [settings] = (await sql`SELECT settings -> 'calendars' AS calendars FROM users WHERE id = ${userId}`) as Row[];
  const labels = new Map<string, string>(
    ((settings?.calendars as { id: string; label: string }[] | null) ?? []).map((c) => [c.id, c.label])
  );
  const rows = (await sql`
    SELECT e.google_event_id, e.google_calendar_id, e.summary, e.description, e.location, e.start_time, e.end_time,
           e.is_all_day, e.attendees, e.html_link, e.hangout_link, e.conference_data
    FROM calendar_events e JOIN calendar_connections c ON c.id = e.connection_id
    WHERE c.user_id = ${userId} AND c.is_active = true AND e.status <> 'cancelled'
      AND e.end_time > ${from} AND e.start_time < ${to}
    ORDER BY e.start_time`) as Row[];

  const out: HomeEvent[] = [];
  for (const r of rows) {
    const attendees = (r.attendees as Attendee[] | null) ?? [];
    if (attendees.some((a) => a.self && a.responseStatus === 'declined')) continue;
    const conference = r.conference_data as { entryPoints?: { entryPointType?: string; uri?: string }[] } | null;
    const video = conference?.entryPoints?.find((p) => p.entryPointType === 'video')?.uri;
    const allDay = Boolean(r.is_all_day);
    const time = (v: unknown) => {
      const d = v instanceof Date ? v : new Date(String(v));
      return allDay ? d.toISOString().slice(0, 10) : d.toISOString();
    };
    const calendarId = String(r.google_calendar_id ?? 'primary');
    out.push({
      id: String(r.google_event_id),
      calendarId,
      calendar: labels.get(calendarId) ?? 'me',
      title: String(r.summary ?? '(no title)'),
      start: time(r.start_time),
      end: time(r.end_time),
      allDay,
      location: String(r.location ?? ''),
      meetUrl: String(r.hangout_link ?? video ?? ''),
      link: String(r.html_link ?? ''),
      description: String(r.description ?? '').slice(0, 800),
      attendees: attendees
        .filter((a) => !a.resource)
        .map((a) => ({ name: a.displayName ?? '', email: a.email ?? '', status: a.responseStatus ?? '', organizer: Boolean(a.organizer) })),
    });
  }
  return out;
}
