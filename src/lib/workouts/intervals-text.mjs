// A structured workout as intervals.icu workout text, the "description" of a planned event. intervals.icu parses it
// into steps and sends the workout to Zwift (rides, % of FTP) and to Garmin Connect (runs, % of LTHR).
// Syntax: forum.intervals.icu/t/workout-builder-syntax-quick-guide/123701 (docs/research/structured-workouts.md §6).
// intervals.icu has no nested repeats, so an inner repeat stays a repeat and the outer one is written out.

import { flatten } from './steps.mjs';

const r = (n) => Math.round(n);

/** "30m", "5m30s", "45s", "10km", "400mtr". */
export function durationText(d) {
  if (d.type === 'distance') return d.m % 1000 === 0 ? `${d.m / 1000}km` : `${r(d.m)}mtr`;
  if (d.type === 'lap') return '10m'; // intervals.icu has "Press lap" only as an option; 10 min is the cap
  const m = Math.floor(d.s / 60);
  const s = d.s % 60;
  return m && s ? `${m}m${s}s` : m ? `${m}m` : `${s}s`;
}

/** "96-104%", "104-108% LTHR", "4:00-4:10/km Pace", or "" for an open target. */
export function targetText(t, step) {
  const ramp = step?.ramp ? 'ramp ' : '';
  if (t.type === 'power') return `${ramp}${r(t.low)}-${r(t.high)}%`;
  if (t.type === 'hr') return `${r(t.low)}-${r(t.high)}% LTHR`;
  if (t.type === 'pace') {
    const p = (v) => `${Math.floor(v / 60)}:${String(r(v % 60)).padStart(2, '0')}`;
    return `${p(t.low)}-${p(t.high)}/km Pace`;
  }
  return '';
}

/** One step line: "- Top of Z4 5m 96-104% 85-95rpm". The note goes first; intervals.icu shows it as the cue. */
export function stepLine(s) {
  // A word with a digit could be read as a duration or a target ("Z4", "5m"), so the cue keeps only plain words.
  const note = (s.notes ?? '')
    .replace(/[\n]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !/[\d%]/.test(word) && word !== '-')
    .join(' ')
    .replace(/[:;,.]+$/, '')
    .slice(0, 60);
  const parts = [note, durationText(s.duration), targetText(s.target, s)];
  if (s.cadence) parts.push(`${s.cadence[0]}-${s.cadence[1]}rpm`);
  return `- ${parts.filter(Boolean).join(' ')}`;
}

/**
 * The whole workout as text. Each top-level step is a line; a repeat is "Nx" with its lines; warm-up and
 * cool-down get their headings. Blocks are separated by a blank line.
 * @param {import('./steps.mjs').Workout} w
 */
export function workoutText(w) {
  const blocks = [];
  const emit = (list) => {
    for (const s of list) {
      if (s.kind === 'repeat') {
        if (s.steps.some((x) => x.kind === 'repeat')) {
          // Nested: write the outer repeat out, keep the inner ones.
          for (let i = 0; i < s.count; i++) emit(s.steps);
        } else {
          blocks.push([`${s.count}x`, ...s.steps.map(stepLine)]);
        }
      } else if (s.kind === 'warmup' || s.kind === 'cooldown') {
        blocks.push([s.kind === 'warmup' ? 'Warmup' : 'Cooldown', stepLine(s)]);
      } else {
        const last = blocks.at(-1);
        if (last && last.single) last.push(stepLine(s));
        else blocks.push(Object.assign([stepLine(s)], { single: true }));
      }
    }
  };
  emit(w.steps);
  const head = w.notes ? [w.notes.replace(/\n/g, ' ')] : [];
  return [...head, ...blocks.map((b) => [...b].join('\n'))].join('\n\n');
}

/** How many steps intervals.icu should find (repeats expanded), to check its parse of the text. */
export const expectedStepCount = (w) => flatten(w.steps).length;
