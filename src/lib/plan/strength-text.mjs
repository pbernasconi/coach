// @ts-check
/**
 * The exercises in a coach's strength text, so the phone can start a Lift session with them (lift/APP-API.md,
 * "Workout", `plan.exercises`). One exercise is one line, or one numbered part of a line, with sets × reps:
 *
 *   "1) Standing calf raise 3x15: 3 s up, 3 s down."  → { name: "Standing calf raise", sets: 3, reps: 15, repsMax: null,
 *                                                        note: "3 s up, 3 s down." }
 *   "Split squat 3×8–10 each leg"                     → { name: "Split squat", sets: 3, reps: 8, repsMax: 10,
 *                                                        note: "each leg" }
 *
 * A line with no sets × reps is not an exercise ("90 s rest."). Pure.
 */

/** "3x15", "3 × 15", "3x8-10", "3×8–10". */
const SETS_REPS = /(\d{1,2})\s*[x×]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?(?!\d)/i;
/** A part's number at its start: "1)", "2.", "3 -". */
const NUMBER = /^\s*(?:\d{1,2}[).]|[-•*])\s*/;
/** A numbered part inside one line: " 2) ". */
const PART_BREAK = /\s+(?=\d{1,2}\)\s)/;

const MAX_EXERCISES = 20;

/**
 * @typedef {{ name: string, sets: number, reps: number, repsMax: number | null, note: string | null }} PlanExercise
 * @param {string | null | undefined} text
 * @returns {PlanExercise[]}
 */
export function strengthExercises(text) {
  if (!text) return [];
  /** @type {PlanExercise[]} */
  const out = [];
  for (const line of String(text).split(/\r?\n/)) {
    for (const part of line.split(PART_BREAK)) {
      const exercise = exerciseOf(part);
      if (exercise) out.push(exercise);
      if (out.length === MAX_EXERCISES) return out;
    }
  }
  return out;
}

/** @param {string} part @returns {PlanExercise | null} */
function exerciseOf(part) {
  const body = part.replace(NUMBER, '').trim();
  const m = SETS_REPS.exec(body);
  if (!m || m.index === 0) return null;
  const name = body
    .slice(0, m.index)
    .replace(/[\s:,–-]+$/, '')
    .trim();
  const sets = Number(m[1]);
  const reps = Number(m[2]);
  const max = m[3] != null ? Number(m[3]) : null;
  if (!name || name.length > 80 || sets < 1 || sets > 20 || reps < 1 || reps > 200) return null;
  const note = cleanNote(body.slice(m.index + m[0].length));
  return { name, sets, reps, repsMax: max != null && max > reps ? max : null, note };
}

/** "(soleus): back on a wall." → "Soleus. Back on a wall."; ": 3 s up" → "3 s up". @param {string} rest */
function cleanNote(rest) {
  let text = rest.trim();
  const paren = /^\(([^)]{1,60})\)\s*/.exec(text);
  let lead = '';
  if (paren) {
    lead = paren[1].trim();
    text = text.slice(paren[0].length);
  }
  text = text.replace(/^[\s:,;.–-]+/, '').trim();
  const joined = [lead && capital(lead), text && capital(text)].filter(Boolean).join('. ');
  return joined ? joined.slice(0, 200) : null;
}

/** @param {string} s */
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The coach's text without the exercise lines `strengthExercises` reads, so the page does not say them twice: the
 * rest of the text ("Achilles, at home…", "90 s rest."), or null when nothing is left.
 * @param {string | null | undefined} text
 * @returns {string | null}
 */
export function strengthNotes(text) {
  if (!text) return null;
  const kept = String(text)
    .split(/\r?\n/)
    .map((line) => line.split(PART_BREAK).filter((part) => !exerciseOf(part)).join(' ').trim())
    .filter(Boolean);
  return kept.length ? kept.join('\n') : null;
}
