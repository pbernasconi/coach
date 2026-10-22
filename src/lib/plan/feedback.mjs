// @ts-check
// How a workout felt: the feel (1 very weak … 5 very strong), the perceived effort (RPE 1–10) and a comment.
// Logged in the item modal for any workout, planned or done (src/lib/plan/feedback.ts stores it).

/** The feel scale, 1 to 5. */
export const FEEL_LABELS = ['Very weak', 'Weak', 'Normal', 'Strong', 'Very strong'];

/** The RPE scale (modified Borg CR-10), 1 to 10: a label and what it feels like. */
export const RPE_SCALE = [
  ['Very easy', 'Barely any effort.'],
  ['Easy', 'Could go all day.'],
  ['Moderate', 'Comfortable, full sentences.'],
  ['Somewhat hard', 'Breathing deeper, still chatty.'],
  ['Hard', 'Short sentences only.'],
  ['Hard', 'Steady focus needed.'],
  ['Very hard', 'A few words at a time.'],
  ['Extremely hard', 'Very challenging, intense focus.'],
  ['Near max', 'Could not keep it up much longer.'],
  ['Max effort', 'Nothing left.'],
];

/** 'Very hard' for 7. */
export const rpeLabel = (/** @type {number} */ rpe) => RPE_SCALE[rpe - 1]?.[0] ?? '';

const ITEM = /^(plan|strava|lift):[\w.-]{1,80}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Checks a save from the modal. Returns the clean row, or { error }.
 * @param {Record<string, unknown>} input
 */
export function cleanFeedback(input) {
  const item = String(input.item ?? '');
  if (!ITEM.test(item)) return { error: 'Bad item' };
  const date = String(input.date ?? '');
  if (!DAY.test(date)) return { error: 'Bad date' };
  const int = (/** @type {unknown} */ v, /** @type {number} */ lo, /** @type {number} */ hi) => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isInteger(n) && n >= lo && n <= hi ? n : undefined;
  };
  const feel = int(input.feel, 1, 5);
  const rpe = int(input.rpe, 1, 10);
  if (feel === undefined) return { error: 'Feel is 1 to 5' };
  if (rpe === undefined) return { error: 'RPE is 1 to 10' };
  const comment = typeof input.comment === 'string' ? input.comment.trim().slice(0, 2000) || null : null;
  const title = typeof input.title === 'string' ? input.title.trim().slice(0, 200) || null : null;
  const plan = typeof input.planActivityId === 'string' && /^[\w.-]{1,80}$/.test(input.planActivityId) ? input.planActivityId : null;
  return { item, date, feel, rpe, comment, title, planActivityId: plan };
}

/**
 * One line for the coach: "Felt strong · RPE 7 (very hard) · "legs heavy"".
 * @param {{ feel: number | null, rpe: number | null, comment: string | null }} f
 */
export function feedbackLine(f) {
  return [
    f.feel ? `felt ${FEEL_LABELS[f.feel - 1].toLowerCase()}` : null,
    f.rpe ? `RPE ${f.rpe} (${rpeLabel(f.rpe).toLowerCase()})` : null,
    f.comment ? `"${f.comment.replace(/\s+/g, ' ')}"` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
