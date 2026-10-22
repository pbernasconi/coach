// Why a planned workout was skipped. No framework or database imports, so node --test can run it (skip.test.mjs).
//
// A skip keeps the workout on the plan (status 'skipped', skip_reason). Coach never "makes up" a skipped workout:
// the plan goes on. A skip for fatigue (tired, sick, sore) also says something about the next days, so a skip of
// today's workout for one of those records how you feel and eases the next quality session (adaptForFeel).

export const SKIP_REASONS = ['tired', 'sick', 'sore', 'busy', 'travel', 'other'];

export const SKIP_LABEL = {
  tired: 'Tired',
  sick: 'Sick',
  sore: 'Sore or hurt',
  busy: 'No time',
  travel: 'Travel',
  other: 'Other',
};

/** A known reason, or null. */
export function cleanReason(reason) {
  const r = String(reason ?? '').trim().toLowerCase();
  return SKIP_REASONS.includes(r) ? r : null;
}

/** True when the reason says the body needs rest, not that the day had no room. */
export function isFatigue(reason) {
  return reason === 'tired' || reason === 'sick' || reason === 'sore';
}

/**
 * How a skip changes the rest of the week: the "how I feel" to record for the day, or null for none. Only a skip of
 * today's workout counts: a skip of a past day is bookkeeping, and a future day may feel different.
 *
 * @param {string | null} reason
 * @param {string} date  the workout's day, 'YYYY-MM-DD'
 * @param {string} today 'YYYY-MM-DD'
 * @returns {'tired' | 'wrecked' | null}
 */
export function feelForSkip(reason, date, today) {
  if (date !== today || !isFatigue(reason)) return null;
  return reason === 'sick' ? 'wrecked' : 'tired';
}

/** 'Not done · Tired', or 'Not done · Skipped' with no reason. */
export function skipText(reason) {
  const r = cleanReason(reason);
  return `Not done · ${r ? SKIP_LABEL[r] : 'Skipped'}`;
}
