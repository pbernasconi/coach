// One way to read Postgres dates on every machine.
//
// `timestamp without time zone` columns (start_date_local, scheduled_date, calendar start_time…) hold wall-clock
// values. The default parser reads them in the process time zone: UTC on Vercel, Pacific (or wherever Paolo travels)
// on the laptop. So the same row gave a different day in a script than on the web; an 18:00 ride landed on the next
// day. These parsers read wall-clock values as UTC everywhere, so `.toISOString().slice(0, 10)` is the stored day.
// Calendar times are instants stored as their UTC wall clock; Strava's start_date_local is the local wall clock.

import { defaults, neon, types } from '@neondatabase/serverless';
import { toDate } from '../lib/db-time.mjs';

// Writes too: a JS Date goes to Postgres as its UTC wall clock, as on Vercel and GitHub Actions. Without this, a
// script on the laptop wrote calendar times in Pacific time and the server wrote them in UTC.
defaults.parseInputDatesAsUTC = true;

const TIMESTAMP = 1114;
const DATE = 1082;

/** '2026-10-19 18:03:23(.123)' → that wall clock as a UTC instant (db-time's reading); other text stays text. */
export function parseTimestamp(v) {
  return toDate(v) ?? v;
}

/** '2026-10-19' → midnight UTC of that day. */
export function parseDate(v) {
  return toDate(v) ?? v;
}

// Global, like parseInputDatesAsUTC: Neon 1.0.2 ignores a `types` option given to neon(), but reads these.
types.setTypeParser(TIMESTAMP, parseTimestamp);
types.setTypeParser(DATE, parseDate);

/** The Neon HTTP client with the UTC date parsers. */
export function connect(url = process.env.DATABASE_URL) {
  return neon(url);
}
