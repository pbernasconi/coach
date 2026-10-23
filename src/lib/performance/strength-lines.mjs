// @ts-check
// What a strength workout asks, one line per exercise, for today's row on the home page (TodayWorkout.tsx): from the
// Lift session planned for it, else from the coach's text (strength-text.mjs). Pure; node --test.

import { loadText, num, repsText } from '../lift-dashboard/text.mjs';
import { strengthExercises } from '../plan/strength-text.mjs';

/**
 * @typedef {{ kind: string, status: string, target: { reps: number | null, repMin: number | null, repMax: number | null, weight: number | null } }} LineSet
 * @typedef {{ name: string, loadMode: string | null, media?: { image?: string | null, gif?: string | null } | null, sets: LineSet[] }} LineExercise
 * @typedef {{ name: string, image: string | null, gif: string | null, sets: number, done: number, text: string }} StrengthLine
 */

/**
 * One line per exercise: its name and picture, its working sets (and how many are logged), and "3 × 10 · 25 lb".
 * Warm-up sets are left out. The load is the heaviest target, the reps those of the first working set.
 * @param {{ unit: string, exercises: LineExercise[] } | null | undefined} lift
 * @param {string | null | undefined} description
 * @returns {StrengthLine[]}
 */
export function strengthLines(lift, description) {
  if (lift && lift.exercises.length) {
    return lift.exercises
      .map((e) => {
        const working = e.sets.filter((s) => s.kind !== 'warmUp');
        const first = working[0];
        const loads = working.map((s) => s.target.weight).filter((w) => w != null);
        const top = loads.length ? Math.max(.../** @type {number[]} */ (loads)) : null;
        const reps = first ? repsText(first.target) : '';
        const load = loadText(top, e.loadMode, lift.unit);
        const setsReps = working.length ? `${working.length}${reps ? ` × ${reps}` : ' sets'}` : '';
        return {
          name: e.name,
          image: e.media?.image ?? null,
          gif: e.media?.gif ?? null,
          sets: working.length,
          done: working.filter((s) => s.status === 'done').length,
          text: [setsReps, load].filter(Boolean).join(' · '),
        };
      })
      .filter((l) => l.sets > 0);
  }
  return strengthExercises(description).map((e) => ({
    name: e.name,
    image: null,
    gif: null,
    sets: e.sets,
    done: 0,
    text: `${e.sets} × ${num(e.reps, 0)}${e.repsMax ? `–${num(e.repsMax, 0)}` : ''}`,
  }));
}
