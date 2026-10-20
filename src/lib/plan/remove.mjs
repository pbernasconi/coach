// Removing a planned workout from the web (week and month views). No framework or database imports, so
// node --test can run it (remove.test.mjs).

import { mondayOf } from './week.mjs';

/**
 * What the confirm step tells the user before a remove.
 *
 * @param {{ title: string, date: string, state?: string, imported?: boolean }} w
 *   imported: the row came from plans/<week>.json (it has a source_key)
 * @returns {{ question: string, notes: string[] }}
 */
export function removeNotice(w) {
  const notes = [];
  if (w.state === 'done') notes.push('It is matched to a completed activity. The activity stays; only the plan entry goes.');
  if (w.imported) notes.push('It came from the plan file. A new import of that week (/plan, /check-in) adds it again.');
  notes.push('Its Google Calendar event is deleted too.');
  return { question: `Remove “${w.title}”?`, notes };
}

/** The plan weeks to push to Google Calendar after a remove: the week of the removed workout. */
export function weeksAfterRemove(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(date ?? '')) ? [mondayOf(date)] : [];
}

/**
 * The optimistic list change for the week and month views: a move changes the date, a remove drops the workout.
 *
 * @template {{ id: string, date: string }} W
 * @param {W[]} list
 * @param {{ id: string, date?: string, remove?: boolean }} change
 * @returns {W[]}
 */
export function applyChange(list, change) {
  if (change.remove) return list.filter((w) => w.id !== change.id);
  return list.map((w) => (w.id === change.id && change.date ? { ...w, date: change.date } : w));
}
