// Lift notes for the athlete profile: what Paolo wrote in Lift about a workout, an exercise or a set ("felt heavy",
// "Achilles sore", "go up 5 lb"). The planner reads them to adapt the next sessions (COACH.md, .claude/commands).
// Pure, so it is testable: the profile (src/lib/planner/profile.mjs) needs a database.
import { untrusted } from './untrusted.mjs';

/** A note flattened to one line for markdown, or null when there is none. */
export function noteText(note, max = 200) {
  const text = untrusted(note, max);
  return text === '' ? null : text;
}

/** One set's extras: "RPE 8, paused", or '' when it has neither. */
export function setExtras(rpe, note) {
  const parts = [];
  if (rpe != null && rpe !== '' && Number.isFinite(Number(rpe))) parts.push(`RPE ${Number(rpe)}`);
  const text = noteText(note, 80);
  if (text) parts.push(text);
  return parts.join(', ');
}

/**
 * The notes of the logged sessions, newest first, for the profile's "Notes from Lift" list.
 * @param {{ day: string, title: string, note?: string | null, exercises: { name: string, note?: string | null }[] }[]} sessions
 * @returns {string[]} lines such as `2026-10-20 Heavy barbell · Back squat: felt heavy`
 */
export function noteLines(sessions) {
  const lines = [];
  for (const ses of [...sessions].sort((a, b) => b.day.localeCompare(a.day))) {
    const head = `${ses.day} ${noteText(ses.title, 60) ?? 'Lift'}`;
    const note = noteText(ses.note);
    if (note) lines.push(`${head}: ${note}`);
    for (const ex of ses.exercises) {
      const exNote = noteText(ex.note);
      if (exNote) lines.push(`${head} · ${noteText(ex.name, 60)}: ${exNote}`);
    }
  }
  return lines;
}

/**
 * One exercise of a Lift session as the planner reads it: "Back squat: 5×100, 5×100 kg — note: ...". A past session
 * lists its done sets (with RPE and set notes), a planned one its targets; warm-ups are left out. After a kg/lb switch
 * mid-workout the sets are in two units, and then each set names its own instead of the line taking the first set's.
 * @param {{ name: string, loadMode: string | null, note: string | null, sets: { kind: string, status: string, unit: string | null, ar: number | null, aw: number | null, tr: number | null, tw: number | null, rpe: number | null, stnote: string | null }[] }} e
 * @param {boolean} past
 */
export function exerciseLine(e, past) {
  const wt = (w, lm) => (w == null ? (lm === 'bodyweight' ? 'bw' : '-') : `${lm === 'bodyweight' ? '+' : ''}${Number(w)}`);
  const work = e.sets.filter((x) => x.kind !== 'warmUp');
  const shown = past ? work.filter((x) => x.status === 'done') : work;
  const units = new Set(shown.map((x) => x.unit).filter(Boolean));
  const mixed = units.size > 1;
  const own = (x) => (mixed ? ` ${x.unit ?? 'lb'}` : '');
  const sets = past
    ? shown.map((x) => {
      const extras = setExtras(x.rpe, x.stnote);
      return `${x.ar ?? '?'}×${wt(x.aw, e.loadMode)}${own(x)}${extras ? ` (${extras})` : ''}`;
    })
    : shown.map((x) => `${x.tr ?? '?'}×${wt(x.tw, e.loadMode)}${own(x)}`);
  const unit = mixed ? '' : ` ${[...units][0] ?? e.sets.find((x) => x.unit)?.unit ?? 'lb'}`;
  const note = noteText(e.note);
  return `${e.name}${e.loadMode === 'perHand' ? ' (each hand)' : ''}: ${sets.join(', ') || 'nothing logged'}${unit}${note ? ` — note: ${note}` : ''}`;
}
