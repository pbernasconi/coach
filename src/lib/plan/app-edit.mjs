// @ts-check
// The Lift app's edit of a planned workout (lift/APP-API.md, "Edit a workout"): the form the phone fills in (`editForm`,
// sent as `edit` in GET /api/app/plan/{id}), and its PUT body back to the web's workout input (`editInput`). The same
// fields and rules as the web's Edit (src/app/(dashboard)/plan/CreateWorkout.tsx, Form). Pure; node --test.

import { totals } from '../workouts/steps.mjs';
import { BANK, bankWorkout } from '../workouts/bank.mjs';
import { EFFORTS, SPORT_IDS, estimateTss } from './create.mjs';

/** @typedef {{ version?: number, sport?: string, name?: string, bank?: string, level?: number, steps?: unknown[] }} Steps */
/**
 * @typedef {{ sport: string, date: string, startTime?: string | null, title?: string | null, duration?: number | null,
 *   distance?: number | null, tss?: number | null, intensity?: string | null, description?: string | null,
 *   steps?: Steps | null }} PlannedRow
 */

const EFFORT_KEYS = /** @type {(keyof typeof EFFORTS)[]} */ (Object.keys(EFFORTS));
const BANK_KEYS = /** @type {(keyof typeof BANK)[]} */ (Object.keys(BANK));
const num = (/** @type {unknown} */ v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** The sport the form edits: the web's, or `other` for one it does not list. */
export const editSport = (/** @type {string} */ sport) => (SPORT_IDS.includes(sport) ? sport : 'other');

const structured = (/** @type {string} */ sport) => sport === 'run' || sport === 'ride';

/** The effort key whose label is the stored intensity ("Easy"), or easy. */
export const effortOf = (/** @type {string | null | undefined} */ intensity) =>
  EFFORT_KEYS.find((k) => EFFORTS[k].label === intensity) ?? 'easy';

/** The steps' own totals, or null without steps. */
function stepTotals(/** @type {Steps | null | undefined} */ steps) {
  return steps && Array.isArray(steps.steps) ? /** @type {{ minutes: number, tss: number, if: number }} */ (totals(/** @type {any} */ (steps))) : null;
}

/**
 * The bank's workouts for a run or a ride, each with the name of every step of its progression: "Threshold A" with
 * "6×5 min top of Z4", "7×5 min top of Z4"…; one step for a workout without a progression.
 */
export function bankOptions() {
  return BANK_KEYS.map((id) => {
    const b = /** @type {{ name: string, levels: number, describe?: (l: number) => string }} */ (BANK[id]);
    const levels = Array.from({ length: b.levels }, (_, l) => (b.describe ? b.describe(l) : b.name));
    return { id, name: b.name, levels };
  });
}

/**
 * The form for a planned workout, filled in as the web's Edit fills it. `tss` is null when the stored TSS is the
 * one the steps give (it stays automatic); `bank` and `level` name a bank workout; `otherSteps` says the steps are not
 * from the bank (kept until a bank workout is picked).
 * @param {PlannedRow} w
 */
export function editForm(w) {
  const sport = editSport(w.sport);
  const steps = w.steps && Array.isArray(w.steps.steps) ? w.steps : null;
  const bank = steps?.bank && steps.bank in BANK ? steps.bank : null;
  const fromSteps = stepTotals(steps);
  const tss = num(w.tss);
  const autoTss = fromSteps ? Math.round(fromSteps.tss) : null;
  return {
    sport,
    date: w.date,
    startTime: w.startTime ? String(w.startTime).slice(0, 5) : null,
    title: w.title ?? '',
    duration: num(w.duration) != null ? Math.round(/** @type {number} */ (w.duration)) : null,
    distanceKm: num(w.distance) != null ? Math.round(/** @type {number} */ (w.distance) / 10) / 100 : null,
    tss: tss == null || (autoTss != null && Math.round(tss) === autoTss) ? null : Math.round(tss),
    effort: effortOf(w.intensity),
    description: w.description ?? '',
    bank,
    level: bank ? Math.max(0, Math.round(num(steps?.level) ?? 0)) : 0,
    otherSteps: Boolean(steps && !bank),
    stepsMinutes: fromSteps ? Math.round(fromSteps.minutes) : null,
    stepsTss: autoTss,
    efforts: EFFORT_KEYS.map((id) => ({ id, label: EFFORTS[id].label, if: EFFORTS[id].if })),
    bankOptions: structured(sport) ? bankOptions() : [],
  };
}

/**
 * The PUT body as the web's workout input (cleanNewWorkout checks it next), or `{ error }`. The sport stays. A bank
 * workout's steps are built again only when its workout, step or time changed, so an untouched workout keeps its
 * steps as the coach wrote them; steps not from the bank stay until a bank workout is picked. An empty TSS is
 * automatic: the steps', else the time at the effort's IF. An empty distance keeps the stored one.
 * @param {unknown} body
 * @param {PlannedRow} w the stored workout
 */
export function editInput(body, w) {
  const b = body && typeof body === 'object' ? /** @type {Record<string, unknown>} */ (body) : {};
  const sport = editSport(w.sport);
  const rest = sport === 'rest';
  const old = w.steps && Array.isArray(w.steps.steps) ? w.steps : null;
  const oldBank = old?.bank && old.bank in BANK ? old.bank : null;

  const minutes = b.duration == null || b.duration === '' ? null : num(b.duration);
  if (b.duration != null && b.duration !== '' && (minutes == null || minutes < 1 || minutes > 1440)) {
    return { error: 'The duration must be 1 to 1440 minutes.' };
  }
  const bank = typeof b.bank === 'string' && b.bank ? b.bank : null;
  if (bank && (!structured(sport) || !(bank in BANK))) return { error: 'Pick a workout from the list.' };
  const level = Math.max(0, Math.round(num(b.level) ?? 0));
  const effort = typeof b.effort === 'string' && b.effort in EFFORTS ? /** @type {keyof typeof EFFORTS} */ (b.effort) : effortOf(w.intensity);

  /** @type {Steps | null} */
  let steps = null;
  if (bank) {
    const unchanged = bank === oldBank && level === Math.round(num(old?.level) ?? 0) && minutes === num(w.duration);
    steps = unchanged ? old : bankWorkout(bank, /** @type {'ride' | 'run'} */ (sport), level, minutes ?? (sport === 'ride' ? 90 : 60));
  } else if (old && !oldBank && b.keepSteps !== false) {
    steps = old;
  }
  const fromSteps = stepTotals(steps);
  const planned = minutes ?? fromSteps?.minutes ?? null;
  const tssIn = b.tss == null || b.tss === '' ? null : num(b.tss);
  if (b.tss != null && b.tss !== '' && (tssIn == null || tssIn < 0 || tssIn > 1000)) return { error: 'The TSS must be 0 to 1000.' };
  const autoTss = fromSteps?.tss ?? (planned ? estimateTss(planned, EFFORTS[effort].if) : null);
  const km = b.distanceKm == null || b.distanceKm === '' ? null : num(b.distanceKm);
  if (b.distanceKm != null && b.distanceKm !== '' && (km == null || km <= 0 || km > 1000)) return { error: 'The distance must be in km, above 0.' };

  return {
    value: {
      sport,
      date: typeof b.date === 'string' ? b.date : w.date,
      startTime: typeof b.startTime === 'string' && b.startTime ? b.startTime : null,
      title: typeof b.title === 'string' ? b.title : '',
      duration: planned,
      distance: km != null ? km * 1000 : null,
      tss: tssIn ?? autoTss,
      intensity: !rest && !steps ? EFFORTS[effort].label : null,
      description: typeof b.description === 'string' ? b.description : '',
      steps,
    },
  };
}
