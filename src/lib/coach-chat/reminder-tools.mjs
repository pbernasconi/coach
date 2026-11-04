// @ts-check
// Reminders from the Coach chat ("remind me at 18:00 to do physio"; lift/COACH-CHAT.md, "Tools"): { op: "reminder",
// at, text } on the change card. On Apply it goes into users.settings.reminders; the iPhone reads them
// (GET /api/app/coach/reminders) and schedules each as a local notification, so it rings on time with no server job.
// Pure: reminders.ts reads and writes.

/** A reminder is at most this far ahead. */
export const REMINDER_DAYS = 30;
/** The words, one short line. */
export const MAX_REMINDER = 140;
/** Past reminders kept this long, then dropped on the next write. */
const KEEP_MS = 7 * 86_400_000;

/**
 * @typedef {{ op: 'reminder', id: string, at: string, local: string, text: string }} ReminderChange
 *   `at`: the instant, ISO UTC without milliseconds; `local`: what he asked for in his zone, "2026-11-04T18:00"
 * @typedef {{ id: string, at: string, text: string, createdAt?: string }} Reminder
 */

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/;

/** The zone's offset from UTC at `ms`, in ms (positive east). @param {number} ms @param {string} timeZone */
function offsetAt(ms, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/**
 * "2026-11-04T18:00" in `timeZone` as an instant, or null when the text isn't a time.
 * @param {string} local @param {string} timeZone
 */
export function zonedInstant(local, timeZone) {
  const m = LOCAL.exec(local);
  if (!m) return null;
  const wall = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  if (new Date(wall).getUTCDate() !== Number(m[3]) || Number(m[4]) > 23 || Number(m[5]) > 59) return null;
  // Twice: the first guess can sit on the other side of a daylight-saving change.
  let ms = wall - offsetAt(wall, timeZone);
  ms = wall - offsetAt(ms, timeZone);
  return new Date(ms);
}

/** ISO UTC without milliseconds, as the phone's decoder reads it. @param {Date} d */
export const isoSeconds = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

/**
 * { op: "reminder", at: "YYYY-MM-DDTHH:MM" in his time zone, text }.
 * @param {Record<string, unknown>} b @param {{ timeZone: string, nowMs: number }} ctx
 * @returns {{ change: ReminderChange } | { problem: string }}
 */
export function cleanReminder(b, { timeZone, nowMs }) {
  const local = String(b.at ?? '').trim().slice(0, 16);
  const at = zonedInstant(local, timeZone);
  if (!at) return { problem: 'a reminder\'s at is a day and time on his clock, "YYYY-MM-DDTHH:MM"' };
  if (at.getTime() < nowMs + 60_000) return { problem: `${local} has passed on his clock; a reminder is for later` };
  if (at.getTime() > nowMs + REMINDER_DAYS * 86_400_000) return { problem: `a reminder is at most ${REMINDER_DAYS} days ahead` };
  const text = String(b.text ?? '').trim().replace(/\s+/g, ' ');
  if (text.length < 2) return { problem: 'a reminder needs its words: what to do, in a short line' };
  if (text.length > MAX_REMINDER) return { problem: `a reminder is one short line, at most ${MAX_REMINDER} characters` };
  const id = `r${Math.random().toString(36).slice(2, 10)}`;
  return { change: { op: 'reminder', id, at: isoSeconds(at), local, text } };
}

/** "Wed 4 Nov 18:00 · on your iPhone" @param {ReminderChange} c */
export function reminderText(c) {
  const [day, time] = c.local.split('T');
  const d = new Date(`${day}T12:00:00Z`);
  const label = `${d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })} ${d.getUTCDate()} ${d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}`;
  return `${label} ${time} · on your iPhone`;
}

/**
 * The stored list with one more, past ones older than a week dropped.
 * @param {unknown} list @param {Reminder} r @param {number} nowMs
 * @returns {Reminder[]}
 */
export function addReminder(list, r, nowMs) {
  return [...cleanList(list).filter((x) => Date.parse(x.at) > nowMs - KEEP_MS && x.id !== r.id), r].slice(-50);
}

/** The stored list without `id`. @param {unknown} list @param {string} id @returns {Reminder[]} */
export const dropReminder = (list, id) => cleanList(list).filter((x) => x.id !== id);

/** The reminders still to come, soonest first, for the phone. @param {unknown} list @param {number} nowMs */
export const upcoming = (list, nowMs) =>
  cleanList(list).filter((r) => Date.parse(r.at) > nowMs).sort((a, b) => a.at.localeCompare(b.at)).map(({ id, at, text }) => ({ id, at, text }));

/** @param {unknown} list @returns {Reminder[]} */
function cleanList(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((r) => r && typeof r.id === 'string' && typeof r.at === 'string' && !Number.isNaN(Date.parse(r.at)) && typeof r.text === 'string');
}
