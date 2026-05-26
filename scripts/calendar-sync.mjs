#!/usr/bin/env node
/**
 * Calendar sync — pull events from all active Google Calendar connections
 * into the calendar_events table.
 *
 * Usage:
 *   node --env-file=.env.local scripts/calendar-sync.mjs [--days-back 7] [--days-forward 30]
 *
 * Refreshes OAuth tokens as needed. Upserts events by google_event_id.
 * Marks events deleted in Google as status='cancelled'.
 */

import { neon } from '@neondatabase/serverless';
import { createId } from '@paralleldrive/cuid2';

const sql = neon(process.env.DATABASE_URL);

const args = process.argv.slice(2);
function getFlag(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
}
const DAYS_BACK = parseInt(getFlag('--days-back', '7'), 10);
const DAYS_FORWARD = parseInt(getFlag('--days-forward', '30'), 10);

const timeMin = new Date(Date.now() - DAYS_BACK * 86_400_000).toISOString();
const timeMax = new Date(Date.now() + DAYS_FORWARD * 86_400_000).toISOString();

const connections = await sql`
  SELECT id, user_id, google_email, access_token, refresh_token, token_expires_at, scope
  FROM calendar_connections
  WHERE is_active = true`;

if (connections.length === 0) {
  console.log('No active calendar connections.');
  process.exit(0);
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
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: conn.refresh_token,
        grant_type: 'refresh_token',
      }),
    });
    if (!r.ok) {
      // Don't echo body — may contain token fragments.
      console.warn(`[${conn.google_email}] token refresh failed: ${r.status} ${r.statusText}`);
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
    console.warn(`[${conn.google_email}] events fetch failed: ${res.status} ${await res.text()}`);
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
  console.log(`[${conn.google_email}] upserted ${upserted} events, marked ${cancelled} cancelled.`);

  await sql`UPDATE calendar_connections SET last_synced_at = NOW() WHERE id = ${conn.id}`;
}

console.log(`\nTotal: ${totalUpserted} upserted, ${totalCancelled} cancelled across ${connections.length} connections.`);
