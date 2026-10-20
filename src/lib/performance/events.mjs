// Events and goals: validation and the countdown. No framework or database imports, so node --test can run
// it (events.test.mjs).

export const PRIORITIES = ['A', 'B', 'C'];
export const EVENT_SPORTS = ['ride', 'run', 'swim', 'triathlon', 'hike', 'strength', 'other'];

const DAY_MS = 86_400_000;
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) &&
  new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

/**
 * Days and weeks from today to an event. `days` is negative for a past event.
 * @returns {{ days: number, weeks: number, restDays: number, label: string }}
 */
export function countdown(today, date) {
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
  const abs = Math.abs(days);
  const weeks = Math.floor(abs / 7);
  const restDays = abs % 7;
  let label;
  if (days === 0) label = 'Today';
  else if (days === 1) label = 'Tomorrow';
  else if (days === -1) label = 'Yesterday';
  else {
    const span = abs < 14 ? `${abs} days` : `${weeks} wk${restDays ? ` ${restDays} d` : ''}`;
    label = days > 0 ? `In ${span}` : `${span} ago`;
  }
  return { days, weeks, restDays, label };
}

/**
 * A clean event from form input, or an error message.
 * @param {Record<string, unknown>} input
 * @returns {{ ok: true, value: { name: string, date: string, priority: 'A' | 'B' | 'C', sport: string | null, notes: string | null, target: string | null } } | { ok: false, error: string }}
 */
export function parseEvent(input) {
  const text = (v, max) => {
    const s = String(v ?? '').trim().slice(0, max);
    return s || null;
  };
  const name = text(input.name, 120);
  if (!name) return { ok: false, error: 'Name is required' };
  const date = String(input.date ?? '').trim();
  if (!isDay(date)) return { ok: false, error: 'Date must be YYYY-MM-DD' };
  const priority = String(input.priority ?? 'B').toUpperCase();
  if (!PRIORITIES.includes(priority)) return { ok: false, error: 'Priority must be A, B or C' };
  const sport = text(input.sport, 20);
  if (sport && !EVENT_SPORTS.includes(sport)) return { ok: false, error: 'Unknown sport' };
  return { ok: true, value: { name, date, priority, sport, notes: text(input.notes, 2000), target: text(input.target, 200) } };
}

/** Upcoming events first (soonest first), then past events (latest first). */
export function sortEvents(events, today) {
  const up = events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.priority.localeCompare(b.priority));
  const past = events.filter((e) => e.date < today).sort((a, b) => b.date.localeCompare(a.date));
  return { upcoming: up, past };
}
