// Lift notes for the athlete profile: what Paolo wrote in Lift about a workout, an exercise or a set ("felt heavy",
// "Achilles sore", "go up 5 lb"). The planner reads them to adapt the next sessions (COACH.md, .claude/commands).
// Pure, so it is testable: coach-profile.mjs runs database queries at import time.
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
