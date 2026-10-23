// @ts-check
// The Lift overview's focus: the few muscles and lifts the program is about right now, how this week's sessions
// target those muscles (sets done and still planned against the 10–20 band), and how each focus lift is
// progressing. Pure and shared: the web /lift page and GET /api/app/lift read the same numbers.
//
// With no focus set in Coach Settings (`settings.liftFocus`), the focus comes from the training itself: the muscles
// with the most hard sets in the last four weeks plus what this week plans, and the lifts done most often.

import { MUSCLE_TARGET, muscleSets } from './stats.mjs';

const DAY_MS = 86_400_000;
/** @param {string} day @param {number} n */
const shift = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** How many focus muscles and lifts the page shows. */
export const FOCUS_SIZE = { muscles: 4, lifts: 4 };

/**
 * Hard sets each muscle gets from the sets still planned between two days, counted as muscleSets counts done ones.
 * @param {ReturnType<typeof import('./stats.mjs').buildModel>} model
 * @param {string} from @param {string} to
 */
export function plannedMuscleSets(model, from, to) {
  /** @type {Map<string, number>} */
  const totals = new Map();
  for (const set of model.sets) {
    if (set.status !== 'planned' || set.kind === 'warmUp' || set.day < from || set.day > to) continue;
    const m = model.muscles.get(set.exerciseKey);
    if (!m) continue;
    for (const muscle of m.primary) totals.set(muscle, (totals.get(muscle) ?? 0) + 1);
    for (const muscle of m.secondary) totals.set(muscle, (totals.get(muscle) ?? 0) + 0.5);
  }
  return totals;
}

/**
 * Where a focus muscle stands this week: in or over the band already, on track with what is still planned, or short.
 * @param {number} done @param {number} planned
 * @returns {'inRange' | 'above' | 'onTrack' | 'below'}
 */
export function targetStatus(done, planned) {
  if (done > MUSCLE_TARGET.max) return 'above';
  if (done >= MUSCLE_TARGET.min) return 'inRange';
  return done + planned >= MUSCLE_TARGET.min ? 'onTrack' : 'below';
}

/**
 * The focus, the week's targeting and the focus lifts' progress.
 * @param {ReturnType<typeof import('./stats.mjs').buildModel>} model
 * @param {{
 *   today: string, monday: string,
 *   sessions: { id: string, day: string, title: string, setsLogged: number }[],
 *   lifts: { key: string, name: string, sessions: number, points: { day: string, e1rm: number }[], latest: { e1rm: number } | null, change: number | null, prDay: string | null }[],
 *   setting?: { muscles?: string[], lifts?: string[] } | null,
 * }} input
 */
export function liftFocus(model, { today, monday, sessions, lifts, setting = null }) {
  const sunday = shift(monday, 6);
  const planned = plannedMuscleSets(model, monday, sunday);
  const recent = muscleSets(model, shift(monday, -28), today);
  const weight = new Map(recent.map((r) => [r.muscle, r.sets]));
  for (const [muscle, sets] of planned) weight.set(muscle, (weight.get(muscle) ?? 0) + sets);

  const chosenMuscles = (setting?.muscles ?? []).filter(Boolean);
  const muscles = chosenMuscles.length
    ? chosenMuscles.slice(0, FOCUS_SIZE.muscles)
    : [...weight.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, FOCUS_SIZE.muscles)
        .map(([muscle]) => muscle);

  const chosenLifts = (setting?.lifts ?? []).filter(Boolean);
  const focusLifts = chosenLifts.length
    ? chosenLifts.map((key) => lifts.find((l) => l.key === key) ?? null).filter((l) => l !== null)
    : lifts.filter((l) => l.latest !== null).slice(0, FOCUS_SIZE.lifts);

  // This week's sessions and the sets each gives each muscle, done and planned.
  const week = sessions.filter((s) => s.day >= monday && s.day <= sunday);
  /** @type {Map<string, Map<string, number>>} */
  const perSession = new Map();
  for (const set of model.sets) {
    if (set.kind === 'warmUp' || set.day < monday || set.day > sunday) continue;
    if (set.status !== 'done' && set.status !== 'planned') continue;
    const m = model.muscles.get(set.exerciseKey);
    if (!m) continue;
    let tally = perSession.get(set.sessionId);
    if (!tally) perSession.set(set.sessionId, (tally = new Map()));
    for (const muscle of m.primary) tally.set(muscle, (tally.get(muscle) ?? 0) + 1);
    for (const muscle of m.secondary) tally.set(muscle, (tally.get(muscle) ?? 0) + 0.5);
  }
  const doneThisWeek = new Map(muscleSets(model, monday, today).map((r) => [r.muscle, r.sets]));

  const targeting = muscles.map((muscle) => {
    const done = doneThisWeek.get(muscle) ?? 0;
    const left = planned.get(muscle) ?? 0;
    return {
      muscle,
      done,
      planned: left,
      status: targetStatus(done, left),
      sessions: week
        .map((s) => ({ id: s.id, day: s.day, title: s.title, sets: perSession.get(s.id)?.get(muscle) ?? 0, done: s.setsLogged > 0 }))
        .filter((s) => s.sets > 0)
        .sort((a, b) => a.day.localeCompare(b.day)),
    };
  });

  // Progress: the last eight weeks of each focus lift's best e1RM per session.
  const since = shift(monday, -49);
  const progress = focusLifts.map((l) => {
    const points = l.points.filter((p) => p.day >= since && p.day <= today);
    const first = points[0]?.e1rm ?? null;
    const last = points.at(-1)?.e1rm ?? null;
    return {
      key: l.key,
      name: l.name,
      e1rm: last,
      change: first !== null && last !== null && points.length > 1 ? (last - first) / first : null,
      since: points[0]?.day ?? null,
      points: points.slice(-12),
      prDay: l.prDay && l.prDay >= since ? l.prDay : null,
    };
  });

  return { source: chosenMuscles.length || chosenLifts.length ? 'settings' : 'training', muscles, lifts: focusLifts.map((l) => ({ key: l.key, name: l.name })), targeting, progress };
}
