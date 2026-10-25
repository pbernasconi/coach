// The numbers behind the coaching rules' "Full weeks, floor weeks and the month": lifts in the last 4 weeks
// (the target is 2 a week), days since the last lift (never miss twice), and where a week sits in the 4-week block
// (week 4 is the lighter week that opens with the monthly review). The planner's profile prints them. Pure.

import { addDays } from './week.mjs';

/** The first Monday of the current run of 4-week blocks (the Lean & Strong block, 2026-10-19). */
export const BLOCK_ANCHOR = '2026-10-19';
export const LIFTS_PER_WEEK = 2;

/** @param {string} a @param {string} b YYYY-MM-DD → whole days from a to b */
function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

/**
 * Lift consistency as of `today` (excluded: today may not be done yet).
 * @param {string[]} liftDays YYYY-MM-DD, one per lift (duplicates on a day count once)
 * @param {string} today YYYY-MM-DD
 */
export function liftConsistency(liftDays, today) {
  const from = addDays(today, -28);
  const days = [...new Set(liftDays.filter((d) => d < today))].sort();
  const last28 = days.filter((d) => d >= from).length;
  const lastDay = days.at(-1) ?? null;
  const daysSince = lastDay ? daysBetween(lastDay, today) : null;
  return {
    last28,
    target28: LIFTS_PER_WEEK * 4,
    lastDay,
    daysSince,
    // The week's first lift goes in its first 2 days when the last one was 6+ days ago.
    liftFirst: daysSince == null || daysSince >= 6,
  };
}

/**
 * Week 1 to 4 of the 4-week block for the week starting `weekStart` (a Monday). Week 4 is the lighter week.
 * @param {string} weekStart
 */
export function blockWeek(weekStart, anchor = BLOCK_ANCHOR) {
  const weeks = Math.floor(daysBetween(anchor, weekStart) / 7);
  return ((weeks % 4) + 4) % 4 + 1;
}
