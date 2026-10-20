// The one place that reads times from the database. Postgres values reach the app in two shapes: Date objects
// (node-postgres, drizzle) or text (Neon's HTTP driver for raw `sql`). The text shapes are
//   date         '2026-10-20'
//   timestamp    '2026-10-20 03:00:41.123'      (no zone: this app stores UTC)
//   timestamptz  '2026-10-20 03:00:41.123+00'   (or +09, +09:30, +0930, Z)
// These helpers accept all of them and return null for anything else. They never throw: one odd row must not
// break a page. ESLint blocks local copies of these helpers (eslint.config.mjs), so every reader uses this file.
// node --test runs db-time.test.mjs against every shape.

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const STAMP = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(Z|[+-]\d{2}(?::?\d{2})?)?$/;

/** A Date, or null when it is not a valid time. @param {unknown} v @returns {Date | null} */
export function toDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') return Number.isFinite(v) ? new Date(v) : null;
  const text = String(v).trim();
  if (DAY.test(text)) {
    const d = new Date(`${text}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = STAMP.exec(text);
  if (!m) return null;
  const [, day, time, zone] = m;
  let offset = 'Z';
  if (zone && zone !== 'Z') {
    const digits = zone.replace(':', '');
    offset = `${digits.slice(0, 3)}:${digits.slice(3) || '00'}`;
  }
  const d = new Date(`${day}T${time}${offset}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** ISO 8601 in UTC ('2026-10-20T03:00:41.123Z'), or null. @param {unknown} v @returns {string | null} */
export function toIso(v) {
  return toDate(v)?.toISOString() ?? null;
}

/**
 * The calendar day as 'YYYY-MM-DD', or null. A text value keeps the day it was written with, so a local time
 * such as strava start_date_local stays on its own day. A Date gives its UTC day.
 * @param {unknown} v
 * @returns {string | null}
 */
export function toDay(v) {
  if (typeof v === 'string') {
    return toDate(v) ? v.trim().slice(0, 10) : null;
  }
  return toDate(v)?.toISOString().slice(0, 10) ?? null;
}
