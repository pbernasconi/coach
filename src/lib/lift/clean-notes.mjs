// @ts-check
/**
 * Notes without the Apple Notes import's bookkeeping, so the workout screen shows only what helps. The import
 * (scripts/lift-import-notes.mjs) wrote each exercise's original line as `Note: “Bench dumbbell bench press”` and each
 * session's source, date evidence and what it left out; scripts/lift-clean-notes.mjs removes them from the stored
 * rows, and the import no longer writes them. What the athlete or the coach wrote stays. Pure.
 */

/** `Note: “…”` at the start of an exercise note, with the `; ` after it. */
const ORIGINAL_LINE = /^Note:\s*“[^”]*”\s*(?:;\s*)?/;

/** Whole lines about the import: its source and the date evidence. */
const IMPORT_LINE = [/^Imported from Apple Notes\b/, /^Date confidence\b/];

/** Sentences about what the import read or left out, not about the workout. */
const IMPORT_SENTENCE = [
  /\(excluded\)|: plan, excluded\b|\bare plans\b|\bis a plan\b/,
  /\bwithout numbers\b|\bha(?:s|ve) no numbers\b|\(not logged\)|\bno logged lines\b|\bbut no reps\b/,
  /^(?:Screenshot shows|Note ends with|Only the|No round was|No Strava|Same plan as|Logged: |Tagged #|Shares the|Numbers differ|Lines like|Modified \d|Instagram)/,
  /^(?:Sets (?:below )?are the|The) 'Today' block\b/,
  /\bwere logged as\b/,
];

/** A line's sentences: "Warmup 5 mins. Only the 'First set' was written down." → two. */
const SENTENCE = /(?<=\.)\s+(?=[A-Z'])/;

/**
 * An exercise note without the original line; null when nothing is left.
 * @param {unknown} note
 * @returns {string | null}
 */
export function cleanExerciseNote(note) {
  if (typeof note !== 'string') return null;
  const text = note.replace(ORIGINAL_LINE, '').trim();
  return text || null;
}

/**
 * A session note without the import's lines; null when nothing is left.
 * @param {unknown} note
 * @returns {string | null}
 */
export function cleanSessionNote(note) {
  if (typeof note !== 'string') return null;
  const kept = note
    .split('\n')
    .filter((line) => !IMPORT_LINE.some((rule) => rule.test(line.trim())))
    .map((line) =>
      line
        .split(SENTENCE)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence && !IMPORT_SENTENCE.some((rule) => rule.test(sentence)))
        .join(' ')
    )
    .filter(Boolean);
  return kept.join('\n') || null;
}
