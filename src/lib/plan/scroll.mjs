// Continuous-scroll calendar (/plan?view=month): which weeks to load, where the data starts, and which month a
// week belongs to. No framework or database imports, so node --test can run it (scroll.test.mjs).

import { addDays, mondayOf } from './week.mjs';

/** Weeks in one load when the calendar scrolls past the loaded weeks. */
export const CHUNK_WEEKS = 8;
/** Weeks loaded before and after the start week on the first render. */
export const INITIAL_AROUND = 4;
/** The largest span (weeks) one load may ask for. The server action checks it too. */
export const MAX_SPAN_WEEKS = 26;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The month ('YYYY-MM') a Mon–Sun week belongs to: the month of its Thursday (the ISO week rule). */
export function monthOfWeek(monday) {
  return addDays(monday, 3).slice(0, 7);
}

/** The Monday of the first week that belongs to `month` (by monthOfWeek). */
export function firstWeekOfMonth(month) {
  const m = mondayOf(`${month}-01`);
  return monthOfWeek(m) === month ? m : addDays(m, 7);
}

/** The week the calendar opens at: the first week of ?month=YYYY-MM when it is given, else the current week. */
export function startWeek(month, today) {
  return typeof month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? firstWeekOfMonth(month) : mondayOf(today);
}

/**
 * The first load: `around` weeks before and after `anchor`, not before the earliest data.
 * @param {string} anchor
 * @param {string | null} [earliest]
 * @param {number} [around]
 */
export function initialRange(anchor, earliest = null, around = INITIAL_AROUND) {
  const floor = earliestBound(earliest);
  let from = addDays(anchor, -7 * around);
  if (floor && from < floor) from = floor <= anchor ? floor : anchor;
  return { from, to: addDays(anchor, 7 * around) };
}

/**
 * The Monday of the earliest data day (first Strava activity, plan workout or Lift session), or null.
 * @param {string | null | undefined} earliest
 * @returns {string | null}
 */
export function earliestBound(earliest) {
  return typeof earliest === 'string' && DAY.test(earliest) ? mondayOf(earliest) : null;
}

/**
 * The next load above the loaded weeks: up to `size` weeks ending the week before `firstLoaded`, not before the
 * earliest data. Null when the loaded weeks already reach the earliest data (or there is no data at all).
 * @param {string} firstLoaded
 * @param {string | null} earliest
 * @param {number} [size]
 * @returns {{ from: string, to: string } | null}
 */
export function chunkBefore(firstLoaded, earliest, size = CHUNK_WEEKS) {
  const floor = earliestBound(earliest);
  if (!floor || firstLoaded <= floor) return null;
  const to = addDays(firstLoaded, -7);
  const from = addDays(to, -7 * (size - 1));
  return { from: from < floor ? floor : from, to };
}

/** The next load below the loaded weeks: `size` weeks from the week after `lastLoaded`. There is no limit forward. */
export function chunkAfter(lastLoaded, size = CHUNK_WEEKS) {
  const from = addDays(lastLoaded, 7);
  return { from, to: addDays(from, 7 * (size - 1)) };
}

/**
 * The load that brings `target` (a Monday) into the loaded weeks, with `pad` weeks past it, or null when it is
 * loaded. Clamped to the earliest data and to MAX_SPAN_WEEKS.
 * @param {string} target
 * @param {string} firstLoaded
 * @param {string} lastLoaded
 * @param {string | null} earliest
 * @param {number} [pad]
 * @returns {{ from: string, to: string } | null}
 */
export function chunkToReach(target, firstLoaded, lastLoaded, earliest, pad = 2) {
  if (target >= firstLoaded && target <= lastLoaded) return null;
  if (target < firstLoaded) {
    const floor = earliestBound(earliest);
    if (!floor || firstLoaded <= floor) return null;
    let from = addDays(target, -7 * pad);
    if (from < floor) from = floor;
    const to = addDays(firstLoaded, -7);
    const minFrom = addDays(to, -7 * (MAX_SPAN_WEEKS - 1));
    return { from: from < minFrom ? minFrom : from, to };
  }
  const from = addDays(lastLoaded, 7);
  let to = addDays(target, 7 * pad);
  const maxTo = addDays(from, 7 * (MAX_SPAN_WEEKS - 1));
  if (to > maxTo) to = maxTo;
  return { from, to };
}

/** The number of Mon–Sun weeks from `from` to `to` (both Mondays, inclusive). */
export function spanWeeks(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / (7 * 86_400_000)) + 1;
}

/**
 * Merges a freshly loaded range into the loaded data. Rows in the fresh weeks replace the old rows of those weeks
 * (so a reload after a move, add or remove is exact); other weeks stay.
 *
 * @template {{ weeks: string[], workouts: {date: string}[], activities: {date: string}[], lifts: {date: string}[], summaries: {monday: string}[] }} R
 * @param {R} base
 * @param {R} fresh
 * @returns {R}
 */
export function mergeRange(base, fresh) {
  const fresher = new Set(fresh.weeks);
  const keep = (row) => !fresher.has(mondayOf(row.date));
  const byDate = (a, b) => a.date.localeCompare(b.date);
  return {
    ...base,
    ...fresh,
    weeks: [...new Set([...base.weeks, ...fresh.weeks])].sort(),
    workouts: [...base.workouts.filter(keep), ...fresh.workouts].sort(byDate),
    activities: [...base.activities.filter(keep), ...fresh.activities].sort(byDate),
    lifts: [...base.lifts.filter(keep), ...fresh.lifts].sort(byDate),
    summaries: [...base.summaries.filter((s) => !fresher.has(s.monday)), ...fresh.summaries].sort((a, b) => a.monday.localeCompare(b.monday)),
  };
}

/**
 * The month edges of a day cell in the continuous grid: `top` when the day a week earlier is in another month
 * (the line steps along the first week of the month), `left` on the 1st when it is not a Monday. `odd` alternates
 * the month background.
 */
export function monthEdges(day) {
  const month = day.slice(0, 7);
  const isFirst = day.slice(8) === '01';
  const monday = mondayOf(day) === day;
  return {
    top: addDays(day, -7).slice(0, 7) !== month,
    left: isFirst && !monday,
    odd: Number(day.slice(5, 7)) % 2 === 1,
  };
}

/** Weeks to show above the open week: the current week opens as the second row (one past week above it). */
export const WEEKS_ABOVE = 1;

/**
 * The week to put at the top of the view so that `focus` shows with WEEKS_ABOVE past weeks above it.
 * @param {string} focus
 * @param {string | null} [earliest]
 * @returns {string}
 */
export function topWeekFor(focus, earliest = null) {
  const top = addDays(focus, -7 * WEEKS_ABOVE);
  const floor = earliestBound(earliest);
  return floor && top < floor ? (floor <= focus ? floor : focus) : top;
}

/**
 * Rejects when `promise` takes longer than `ms`, so a load that never answers cannot look like loading forever.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} [label]
 * @returns {Promise<T>}
 */
export function withTimeout(promise, ms, label = 'load') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
