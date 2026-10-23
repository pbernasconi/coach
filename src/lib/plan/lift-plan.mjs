// Keeps the strength workouts of the plan and the sessions in Lift in step (scripts/lift-plan.mjs).
//
// A plan workout with a `lift_template` gets a Lift session planned from that template: one row per set, each with its
// target, so every rep and weight is logged in Lift. The session id goes back into `lift_session_id`. Lift's own
// planner (LiftKit, through lift/tools/LiftSeed) sets the targets, from the template and the logged history.
//
// Pure functions only; the script does the database and the Swift tool.

/** The marker line before the generated part of a description. Text above it is the coach's note and is kept. */
export const LIFT_MARKER = '— Lift session (log each set in Lift) —';

/**
 * The entries for the Swift tool (`--plan`), and the Lift sessions that no plan workout uses any more.
 * @param {{ id: string, day: string, status: string, liftTemplate: string | null, liftSessionId: string | null }[]} rows
 *   plan workouts from today on that have a template or a session
 * @param {string[]} ledger Lift sessions this script made before (users.settings.liftPlanned)
 * @param {Set<string>} linkedElsewhere session ids linked by plan workouts outside `rows` (past days), never removed
 */
export function planEntries(rows, ledger, linkedElsewhere = new Set()) {
  const entries = [];
  const keep = new Set();
  const mine = new Set(ledger);
  for (const r of rows) {
    const wanted = r.status !== 'skipped' && Boolean(r.liftTemplate);
    if (wanted) {
      entries.push({ key: r.id, day: r.day, template: r.liftTemplate, sessionId: r.liftSessionId ?? null });
      if (r.liftSessionId) keep.add(r.liftSessionId);
    } else if (r.liftSessionId && r.status !== 'skipped' && !mine.has(r.liftSessionId)) {
      // A session started from the workout's text (the phone's Start workout, the web's Log sets): not this script's.
      keep.add(r.liftSessionId);
    } else if (r.liftSessionId) {
      entries.push({ key: r.id, day: r.day, sessionId: r.liftSessionId, remove: true });
    }
  }
  const linked = new Set(rows.map((r) => r.liftSessionId).filter(Boolean));
  for (const id of ledger) {
    if (!linked.has(id) && !keep.has(id) && !linkedElsewhere.has(id)) {
      entries.push({ key: `ledger:${id}`, day: '1970-01-01', sessionId: id, remove: true });
    }
  }
  return entries;
}

const fmt = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));

/** "8", "8–10", or "" for a set target's reps. */
function reps(s) {
  if (s.reps != null) return String(s.reps);
  if (s.repMin != null && s.repMax != null) return s.repMin === s.repMax ? String(s.repMin) : `${s.repMin}–${s.repMax}`;
  return '';
}

/** "@ 230 lb", "@ 45 lb each hand", "+25 lb" (bodyweight), or "" with no load. */
function load(s, loadMode) {
  if (s.weight == null) return '';
  if (loadMode === 'bodyweight') return `+${fmt(s.weight)} ${s.unit}`;
  return `@ ${fmt(s.weight)} ${s.unit}${loadMode === 'perHand' ? ' each hand' : ''}`;
}

/**
 * One line per exercise: "Back squat 3 × 8 @ 230 lb". Sets with different targets are listed one by one. Logged sets
 * show what was done: "Back squat 8×230, 8×230, 7×230 (3/3 logged)".
 * @param {{ name: string, loadMode: string, sets: { kind: string, reps: number|null, repMin: number|null, repMax: number|null, weight: number|null, unit: string, status: string, actualReps: number|null, actualWeight: number|null }[] }} e
 */
export function exerciseLine(e) {
  const sets = e.sets.filter((s) => s.kind !== 'warmUp');
  const done = sets.filter((s) => s.status === 'done');
  if (done.length > 0) {
    const text = done.map((s) => `${s.actualReps ?? '?'}×${s.actualWeight != null ? fmt(s.actualWeight) : 'bw'}`).join(', ');
    return `${e.name} ${text} (${done.length}/${sets.length} logged)`;
  }
  const targets = sets.map((s) => [reps(s), load(s, e.loadMode)].filter(Boolean).join(' '));
  if (targets.length > 0 && targets.every((t) => t === targets[0])) return `${e.name} ${sets.length} × ${targets[0]}`.trim();
  return `${e.name} ${targets.join(', ')}`.trim();
}

/** The generated part: template, exercises with their targets, the Lift session id. */
export function sessionBlock(planned) {
  const lines = [LIFT_MARKER, `Template: ${planned.title}`];
  for (const e of planned.exercises) lines.push(`- ${exerciseLine(e)}`);
  return lines.join('\n');
}

/** The coach's note (text above the marker) followed by a fresh generated block. */
export function mergeDescription(current, planned) {
  const note = String(current ?? '').split(LIFT_MARKER)[0].trim();
  return [note, sessionBlock(planned)].filter(Boolean).join('\n\n');
}

/** Short text for the plan's intensity column: "Heavy barbell · 7 exercises · 21 sets · squat 3 × 8 @ 230 lb". */
export function intensityText(planned) {
  const sets = planned.exercises.reduce((n, e) => n + e.sets.filter((s) => s.kind !== 'warmUp').length, 0);
  const first = planned.exercises[0];
  return [planned.title, `${planned.exercises.length} exercises`, `${sets} sets`, first ? exerciseLine(first) : null]
    .filter(Boolean)
    .join(' · ');
}
