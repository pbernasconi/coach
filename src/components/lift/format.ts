/** Small text helpers shared by the Lift session page and the plan preview. */

export const num = (v: number, digits = 1) => v.toLocaleString('en-US', { maximumFractionDigits: digits });

/** "quads" → "Quads", "lower back" → "Lower back". */
export const muscleLabel = (m: string) => (m ? m.charAt(0).toUpperCase() + m.slice(1) : m);

export type SetTarget = { reps: number | null; repMin: number | null; repMax: number | null; weight: number | null };

/** "8", "8–10", or "" for the planned reps. */
export function repsText(t: SetTarget) {
  if (t.reps != null) return String(t.reps);
  if (t.repMin != null && t.repMax != null) return t.repMin === t.repMax ? String(t.repMin) : `${t.repMin}–${t.repMax}`;
  return '';
}

/** A load as a set shows it: "230 lb", "+25 lb" (added to bodyweight), "BW", or "" with no load. */
export function loadText(weight: number | null, loadMode: string | null, unit: string) {
  if (loadMode === 'bodyweight') return weight ? `+${num(weight)} ${unit}` : 'BW';
  return weight == null ? '' : `${num(weight)} ${unit}`;
}

/** "each hand", "each side" or "". */
export const loadModeNote = (loadMode: string | null) =>
  loadMode === 'perHand' ? 'each hand' : loadMode === 'perSide' ? 'each side' : '';

/** "1:30" or "45 s" for a rest. */
export function restText(seconds: number | null) {
  if (seconds == null) return null;
  if (seconds === 0) return 'No rest';
  return seconds >= 60 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} rest` : `${seconds} s rest`;
}
