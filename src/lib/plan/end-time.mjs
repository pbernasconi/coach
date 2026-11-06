// @ts-check
// When a planned workout ends. The length (duration) is the truth: every write keeps it (the planner's end - start,
// an edit, a calendar move). The stored end_time is only a fallback for a row with no length, because a move that
// changed the start without clearing it left an old end behind: Nov 2026's 45 min ride showed 11:45–2:45 on the
// calendar, with the lift after it nested inside. Pure; tested.

/** @param {unknown} t 'HH:MM[:SS]' → minutes since midnight, or null */
const clock = (t) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t ?? ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/**
 * Minutes from start to end: start + duration, else the stored end when it is after the start, else null.
 * @param {{ start_time?: string | null, end_time?: string | null, duration?: number | string | null }} w
 * @returns {number | null}
 */
export function minutesOf(w) {
  const length = Number(w.duration);
  if (Number.isFinite(length) && length > 0) return Math.round(length);
  const start = clock(w.start_time);
  const end = clock(w.end_time);
  return start != null && end != null && end > start ? end - start : null;
}

/**
 * The 'HH:MM' end of a timed workout on its own day (start + length), or null with no start, no length, or an end
 * past midnight.
 * @param {{ start_time?: string | null, end_time?: string | null, duration?: number | string | null }} w
 * @returns {string | null}
 */
export function endTimeOf(w) {
  const start = clock(w.start_time);
  const length = minutesOf(w);
  if (start == null || length == null || start + length >= 24 * 60) return null;
  const end = start + length;
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}
