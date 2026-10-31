// @ts-check
// Words of the web Coach chat. Pure, so node --test can check them.

/** The quiet status line while Coach answers (lift/APP-API.md, "Coach answer stream"). */
export const STEP_TEXT = {
  reading: 'Reading your week',
  thinking: 'Thinking',
  writing: 'Writing',
  proposing: 'Checking the changes',
  card: 'Getting the card ready',
  fixing: 'Fixing a clash',
};

/** @param {string} step */
export function stepText(step) {
  return /** @type {Record<string, string>} */ (STEP_TEXT)[step] ?? 'Thinking';
}

/**
 * Where a chat card's workout opens on the web: a done activity Coach had no plan for opens its activity page; a
 * planned workout opens in the Plan calendar's window.
 * @param {{ id?: unknown, date?: unknown, unplanned?: unknown, done?: { activityId?: unknown } | null }} item
 */
export function workoutHref(item) {
  const id = String(item.id ?? '');
  const activity = item.done?.activityId ? String(item.done.activityId) : id.startsWith('activity-') ? id.slice(9) : '';
  if (item.unplanned && activity) return `/activities/${encodeURIComponent(activity)}`;
  const date = typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : null;
  if (!id || !date) return '/plan';
  return `/plan?week=${date}&open=${encodeURIComponent(`w-${id}`)}`;
}

/** The breakdown card's link (`plan`) on the web. @param {unknown} link */
export function breakdownHref(link) {
  return link === 'plan' ? '/plan' : null;
}

/** A breakdown tint (a sport) as one of Kobo's data colours. @param {unknown} tint @returns {1|2|3|4|5|6|7|8} */
export function tintSwatch(tint) {
  switch (tint) {
    case 'run': return 6;
    case 'ride': return 1;
    case 'swim': return 4;
    case 'strength': return 5;
    case 'walk': return 2;
    default: return 3;
  }
}

/** "Mon 26 Oct" from a day. @param {string} date */
export function shortDay(date) {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}
