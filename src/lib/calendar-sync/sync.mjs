/**
 * Google Calendar sync, shared by scripts/calendar-sync.mjs (CLI) and the server (/api/cron/calendar).
 * Pulls events from every active calendar connection into calendar_events, refreshing OAuth tokens,
 * and marks events deleted on Google as cancelled.
 */

import { createId } from '@paralleldrive/cuid2';

/**
 * @param {import('@neondatabase/serverless').NeonQueryFunction<false, false>} sql
 * @param {{ daysBack?: number, daysForward?: number, env?: Record<string, string | undefined>,
 *          log?: (...a: unknown[]) => void, warn?: (...a: unknown[]) => void }} [opts]
 */
export async function syncCalendars(sql, opts = {}) {
  const daysBack = opts.daysBack ?? 7;
  const daysForward = opts.daysForward ?? 30;
  const env = opts.env ?? process.env;
  const log = opts.log ?? console.log;
  const warn = opts.warn ?? console.warn;

  const timeMin = new Date(Date.now() - daysBack * 86_400_000).toISOString();
  const timeMax = new Date(Date.now() + daysForward * 86_400_000).toISOString();

  const connections = await sql`
    SELECT id, user_id, google_email, access_token, refresh_token, token_expires_at, scope
    FROM calendar_connections
    WHERE is_active = true`;

  if (connections.length === 0) {
    log('No active calendar connections.');
    return { connections: 0, upserted: 0, cancelled: 0 };
  }

  let totalUpserted = 0;
  let totalCancelled = 0;

  for (const conn of connections) {
    // Always refresh — DB token_expires_at is unreliable across connections.
    // Refresh tokens are long-lived; cost is one extra request per sync.
    let accessToken;
    {
      const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          refresh_token: conn.refresh_token,
          grant_type: 'refresh_token',
        }),
      });
      if (!r.ok) {
        // Don't echo body — may contain token fragments.
        warn(`[${conn.google_email}] token refresh failed: ${r.status} ${r.statusText}`);
        continue;
      }
      const tok = await r.json();
      accessToken = tok.access_token;
      await sql`
        UPDATE calendar_connections
           SET access_token = ${tok.access_token},
               token_expires_at = ${new Date(Date.now() + tok.expires_in * 1000)},
               updated_at = NOW()
         WHERE id = ${conn.id}`;
    }

    // List events on the primary calendar
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.set('timeMin', timeMin);
    url.searchParams.set('timeMax', timeMax);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '250');

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      warn(`[${conn.google_email}] events fetch failed: ${res.status} ${await res.text()}`);
      continue;
    }
    const body = await res.json();
    const events = body.items ?? [];

    let upserted = 0;
    const seenEventIds = new Set();

    for (const e of events) {
      if (!e.id) continue;
      seenEventIds.add(e.id);
      const startTime = new Date(e.start.dateTime ?? e.start.date);
      const endTime = new Date(e.end?.dateTime ?? e.end?.date ?? startTime);
      const isAllDay = !e.start.dateTime;
      const status = e.status === 'cancelled' ? 'cancelled' : 'confirmed';

      const [existing] = await sql`
        SELECT id FROM calendar_events
        WHERE connection_id = ${conn.id} AND google_event_id = ${e.id}
        LIMIT 1`;

      if (existing) {
        await sql`
          UPDATE calendar_events SET
            google_calendar_id = ${e.organizer?.email ?? 'primary'},
            summary = ${e.summary ?? null},
            description = ${e.description ?? null},
            location = ${e.location ?? null},
            start_time = ${startTime},
            end_time = ${endTime},
            timezone = ${e.start.timeZone ?? null},
            is_all_day = ${isAllDay},
            recurring_event_id = ${e.recurringEventId ?? null},
            status = ${status},
            attendees = ${e.attendees ? JSON.stringify(e.attendees) : null},
            organizer = ${e.organizer ? JSON.stringify(e.organizer) : null},
            html_link = ${e.htmlLink ?? null},
            hangout_link = ${e.hangoutLink ?? null},
            last_modified = ${e.updated ? new Date(e.updated) : null},
            updated_at = NOW()
          WHERE id = ${existing.id}`;
      } else {
        await sql`
          INSERT INTO calendar_events (
            id, connection_id, google_event_id, google_calendar_id,
            summary, description, location,
            start_time, end_time, timezone, is_all_day, recurring_event_id,
            status, attendees, organizer, html_link, hangout_link, last_modified
          ) VALUES (
            ${createId()}, ${conn.id}, ${e.id}, ${e.organizer?.email ?? 'primary'},
            ${e.summary ?? null}, ${e.description ?? null}, ${e.location ?? null},
            ${startTime}, ${endTime}, ${e.start.timeZone ?? null}, ${isAllDay}, ${e.recurringEventId ?? null},
            ${status}, ${e.attendees ? JSON.stringify(e.attendees) : null}, ${e.organizer ? JSON.stringify(e.organizer) : null},
            ${e.htmlLink ?? null}, ${e.hangoutLink ?? null}, ${e.updated ? new Date(e.updated) : null}
          )`;
      }
      upserted++;
    }

    // Mark events in DB that were not returned (within window) as cancelled
    const stale = await sql`
      SELECT id, google_event_id FROM calendar_events
      WHERE connection_id = ${conn.id}
        AND start_time >= ${timeMin}
        AND start_time <= ${timeMax}
        AND status <> 'cancelled'`;
    let cancelled = 0;
    for (const row of stale) {
      if (!seenEventIds.has(row.google_event_id)) {
        await sql`UPDATE calendar_events SET status = 'cancelled', updated_at = NOW() WHERE id = ${row.id}`;
        cancelled++;
      }
    }

    totalUpserted += upserted;
    totalCancelled += cancelled;
    log(`[${conn.google_email}] upserted ${upserted} events, marked ${cancelled} cancelled.`);

    await sql`UPDATE calendar_connections SET last_synced_at = NOW() WHERE id = ${conn.id}`;
  }

  log(`\nTotal: ${totalUpserted} upserted, ${totalCancelled} cancelled across ${connections.length} connections.`);
  return { connections: connections.length, upserted: totalUpserted, cancelled: totalCancelled };
}
