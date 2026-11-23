// The warm-up checklist Lift keeps in a session's warm-up note (LiftCore WarmUpChecklist): one item per line, "[ ] Bird
// dog · 5 / side" to do and "[x] Bird dog · 5 / side" ticked. A line without a box (an imported "5 min rower") counts
// as done; a note with no box on any line is a plain note, not a checklist. Pure; node --test (warm-up.test.mjs).

/** @typedef {{ text: string, done: boolean }} WarmUpItem */

/** The light day's checklist, as Lift's WarmUpRecipe.lightChecklist has it (a home or dumbbell session). */
export const LIGHT_WARM_UP = ['Easy cardio · 2–3 min', 'Band pull-aparts · 15', 'Arm circles · 10'];

/** @param {string} line */
function box(line) {
  const head = line.slice(0, 3).toLowerCase();
  if (head === '[ ]') return false;
  if (head === '[x]') return true;
  return null;
}

/**
 * The checklist in a warm-up note, or null when the note has none.
 * @param {unknown} note
 * @returns {WarmUpItem[] | null}
 */
export function warmUpChecklist(note) {
  if (typeof note !== 'string') return null;
  const lines = note.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.some((l) => box(l) !== null)) return null;
  return lines.map((line) => {
    const b = box(line);
    return b === null ? { text: line, done: true } : { text: line.slice(3).trim(), done: b };
  });
}

/**
 * The note that keeps `items`, every one still to do.
 * @param {string[]} items
 */
export function warmUpNote(items) {
  return items.map((t) => `[ ] ${t}`).join('\n');
}
