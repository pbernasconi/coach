// Checks a new workout from the Plan calendar (the "+" on a day) before it is stored. Pure, so node --test can run it
// (create.test.mjs).

import { totals, validate } from '../workouts/steps.mjs';

export const SPORT_IDS = ['run', 'ride', 'swim', 'strength', 'walk', 'hike', 'yoga', 'rest', 'other'];

/** Effort levels for a workout with no steps, with the IF that estimates its TSS. */
export const EFFORTS = {
  recovery: { label: 'Recovery', if: 0.55 },
  easy: { label: 'Easy', if: 0.65 },
  moderate: { label: 'Moderate', if: 0.75 },
  hard: { label: 'Hard', if: 0.85 },
  'very-hard': { label: 'Very hard', if: 0.95 },
};

/** TSS = hours × IF² × 100. */
export const estimateTss = (minutes, ifactor) => Math.round((minutes / 60) * ifactor * ifactor * 100);

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const text = (v, max) => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s.slice(0, max) : null;
};
const number = (v, lo, hi) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
};

/**
 * The workout_type of a workout: `<sport>-<bank>` for a bank workout (the rotation reads it, scripts/rotation.mjs),
 * `ride-z2` for an easy ride, `rest` for a day off, or null for a free-text workout.
 * @param {string} sport
 * @param {{ bank?: string } | null | undefined} steps
 */
export function workoutTypeFor(sport, steps) {
  if (sport === 'rest') return 'rest';
  if ((sport !== 'run' && sport !== 'ride') || !steps?.bank) return null;
  if (sport === 'ride' && steps.bank === 'easy') return 'ride-z2';
  return `${sport}-${steps.bank}`;
}

/**
 * A clean new workout, or { error }. With steps, the planned time and TSS come from the steps when the form left
 * them empty. A rest day has no time, distance or TSS.
 * @param {Record<string, unknown>} input
 */
export function cleanNewWorkout(input) {
  const sport = String(input?.sport ?? '');
  if (!SPORT_IDS.includes(sport)) return { error: 'Pick a sport.' };
  const date = String(input?.date ?? '');
  if (!DATE.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`))) return { error: 'Pick a day.' };
  const startTime = input?.startTime ? String(input.startTime) : null;
  if (startTime && !TIME.test(startTime)) return { error: 'The start time must be HH:MM.' };
  let steps = input?.steps ?? null;
  if (steps) {
    if (sport !== 'run' && sport !== 'ride') return { error: 'Steps are for runs and rides only.' };
    const problems = validate(steps);
    if (problems.length) return { error: `The steps are not valid: ${problems[0]}` };
    steps = { ...steps, sport };
  }
  const rest = sport === 'rest';
  const fromSteps = steps ? totals(steps) : null;
  const duration = rest ? null : number(input?.duration, 1, 1440) ?? fromSteps?.minutes ?? null;
  const tss = rest ? null : number(input?.tss, 0, 1000) ?? fromSteps?.tss ?? null;
  const distance = rest ? null : number(input?.distance, 1, 1_000_000);
  const title = text(input?.title, 120) ?? (rest ? 'Rest day' : steps?.name ?? `${sport[0].toUpperCase()}${sport.slice(1)}`);
  return {
    value: {
      sport,
      date,
      startTime,
      title,
      duration: duration != null ? Math.round(duration) : null,
      distance: distance != null ? Math.round(distance) : null,
      tss: tss != null ? Math.round(tss) : null,
      intensity: text(input?.intensity, 200),
      description: text(input?.description, 4000),
      steps,
      workoutType: workoutTypeFor(sport, /** @type {{ bank?: string } | null} */ (steps)),
    },
  };
}
