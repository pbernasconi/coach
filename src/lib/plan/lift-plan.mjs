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

/**
 * The exercises in the generated block, for a page that lists them (the App API's `exercises`): one per line that
 * `exerciseLine` wrote with targets, "Back squat 3 × 5 @ 255 lb" → { name: "Back squat", sets: 3, reps: 5,
 * repsMax: null, note: "255 lb" }. Sets with different targets ("Deadlift 5 @ 275 lb, 3 @ 295 lb") count each set and
 * take the first set's reps, with every set's target in the note. Logged lines and a description without the block give nothing.
 * @param {string | null | undefined} description
 * @returns {{ name: string, sets: number, reps: number, repsMax: number | null, note: string | null }[]}
 */
export function blockExercises(description) {
  const text = String(description ?? '');
  if (!text.includes(LIFT_MARKER)) return [];
  const out = [];
  for (const raw of text.split(LIFT_MARKER)[1].split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith('- ') || /\(\d+\/\d+ logged\)$/.test(line)) continue;
    const body = line.slice(2);
    const same = /^(.+?) (\d{1,2}) × (\d{1,3})(?:–(\d{1,3}))?(?: (.+))?$/.exec(body);
    if (same) {
      out.push({ name: same[1], sets: Number(same[2]), reps: Number(same[3]), repsMax: same[4] ? Number(same[4]) : null, note: loadNote(same[5]) });
      continue;
    }
    // "Deadlift 5 @ 275 lb, 3 @ 295 lb": a target per set.
    const each = /^(.+?) (\d{1,3})(?:–(\d{1,3}))?((?: [@+][^,]*)?(?:, \d.*)?)$/.exec(body);
    if (!each) continue;
    const targets = body.slice(each[1].length + 1);
    const sets = targets.split(', ').length;
    out.push({ name: each[1], sets, reps: Number(each[2]), repsMax: each[3] ? Number(each[3]) : null, note: sets > 1 ? targets : loadNote(each[4]) });
  }
  return out;
}

/** "@ 255 lb" → "255 lb"; "+25 lb" stays; nothing → null. @param {string | undefined} text */
function loadNote(text) {
  const t = String(text ?? '').trim().replace(/^@\s*/, '');
  return t || null;
}

/**
 * The Lift template a gym lift is for, among `names`: its `lift_template`, else the template its summary starts
 * with ("Heavy barbell · 9 exercises …"), else the longest template name in its title, else by its workout type
 * (strength-heavy → the "heavy" template, strength-dumbbell → the dumbbell one that is not the hotel's). null for
 * anything else (a home session, physio), so those keep the exercises in their own text.
 * @param {{ sport?: string, workoutType?: string | null, liftTemplate?: string | null, intensity?: string | null, title?: string }} w
 * @param {string[]} names
 * @returns {string | null}
 */
export function pickTemplate(w, names) {
  if (w.sport !== 'strength' || w.workoutType === 'strength-home' || names.length === 0) return null;
  const key = (s) => String(s ?? '').trim().toLowerCase();
  const byKey = new Map(names.map((n) => [key(n), n]));
  if (w.liftTemplate && byKey.has(key(w.liftTemplate))) return byKey.get(key(w.liftTemplate));
  const lead = key(String(w.intensity ?? '').split(' · ')[0]);
  if (byKey.has(lead)) return byKey.get(lead);
  const title = key(w.title);
  const inTitle = names.filter((n) => key(n) && title.includes(key(n))).sort((a, b) => b.length - a.length)[0];
  if (inTitle) return inTitle;
  if (w.workoutType === 'strength-heavy') return names.find((n) => /heavy/i.test(n)) ?? null;
  if (w.workoutType === 'strength-dumbbell') return names.find((n) => /dumbbell/i.test(n) && !/hotel/i.test(n)) ?? null;
  return null;
}

/**
 * The gym lifts Lift still has to plan: each planned strength workout whose Lift template can be found
 * (`pickTemplate`) but whose stored template differs, or that has no live Lift session (none, or one that was
 * deleted). The hourly backstop counts them (/api/cron/lift-pending) and scripts/lift-plan.mjs repairs them.
 * @param {{ id: string, status: string, sport: string, workoutType: string | null, liftTemplate: string | null, intensity: string | null, title: string, liftSessionId: string | null }[]} rows
 * @param {string[]} names Lift's templates
 * @param {Set<string>} deleted lower-case ids of deleted Lift sessions
 * @returns {{ id: string, template: string, sessionId: string | null }[]}
 */
export function liftRepairs(rows, names, deleted) {
  const out = [];
  for (const r of rows) {
    if (r.status !== 'planned') continue;
    const template = pickTemplate(r, names);
    if (!template) continue;
    const live = r.liftSessionId && !deleted.has(String(r.liftSessionId).toLowerCase()) ? r.liftSessionId : null;
    if (template !== r.liftTemplate || !live) out.push({ id: r.id, template, sessionId: live });
  }
  return out;
}
