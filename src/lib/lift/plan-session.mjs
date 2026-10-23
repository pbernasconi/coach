// A Lift session from a planned strength workout's text (a home session such as "Home calf raises"), made by the web
// so its sets can be logged on the Plan page. The same thing the phone's "Start workout" makes
// (lift/ios/Lift/Features/Training/ActivityDetail/PlannedSessionStarter.swift): one session on the workout's day, one
// exercise per line with sets × reps, each found in the Lift library by name, else added to it. The changes go through
// the Lift sync push code, so the iPhone pulls them. Pure; node --test (plan-session.test.mjs).

/** @typedef {Record<string, any>} Row a lift_rows payload */
/** @typedef {{ name: string, sets: number, reps: number, repsMax: number | null, note: string | null }} PlanExercise */

/** "Standing calf raises" and "standing calf-raise" read as one name. */
export function nameKey(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join(' ');
}

/** A JSON array column, stored as text or as an array. */
function list(v) {
  if (Array.isArray(v)) return v;
  try {
    const parsed = JSON.parse(String(v ?? '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** The library exercise with this name or alias, or null. Archived ones count: Lift keeps their history. */
export function findInLibrary(name, library) {
  const key = nameKey(name);
  const alive = library.filter((e) => !e.deletedAt);
  return (
    alive.find((e) => nameKey(e.name) === key && !Number(e.isArchived)) ??
    alive.find((e) => nameKey(e.name) === key) ??
    alive.find((e) => list(e.aliases).some((a) => nameKey(a) === key)) ??
    null
  );
}

/** Equipment and load mode for a new exercise, from its name ("Dumbbell row" → dumbbell, per hand). */
export function equipmentOf(name) {
  const n = ` ${String(name).toLowerCase()} `;
  if (/\b(dumbbell|db)s?\b/.test(n)) return { equipment: 'dumbbell', loadMode: 'perHand' };
  if (/\b(kettlebell|kb)s?\b/.test(n)) return { equipment: 'kettlebell', loadMode: 'total' };
  if (/\bbarbell|\bbench press\b|\bdeadlift/.test(n)) return { equipment: 'barbell', loadMode: 'total' };
  if (/\bcable\b/.test(n)) return { equipment: 'cable', loadMode: 'total' };
  if (/\bmachine\b|\bleg press\b/.test(n)) return { equipment: 'machine', loadMode: 'total' };
  return { equipment: 'bodyweight', loadMode: 'bodyweight' };
}

/** A new row id in Swift's upper-case form. */
const newId = (uuid) => uuid().toUpperCase();

/**
 * The Lift changes for a session planned from the coach's exercises: new library exercises first, then the session,
 * its exercises and their sets (parents first, as the phone needs them).
 * @param {{ title: string, day: string, unit: 'kg' | 'lb', exercises: PlanExercise[], library: Row[],
 *   catalogId?: (name: string) => string | null, now?: Date, uuid?: () => string }} input
 * @returns {{ sessionId: string, changes: { entity: string, op: 'insert', payload: Row }[] } | { error: string }}
 */
export function planSessionChanges(input) {
  const { title, day, unit, exercises } = input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day))) return { error: 'The workout has no day.' };
  if (!exercises.length) return { error: 'The workout lists no exercises with sets × reps.' };
  const uuid = input.uuid ?? (() => crypto.randomUUID());
  const at = (input.now ?? new Date()).toISOString();
  const stamps = { createdAt: at, updatedAt: at, deletedAt: null };
  /** @type {{ entity: string, op: 'insert', payload: Row }[]} */
  const added = [];
  const made = new Map();
  const libraryRow = (name) => {
    const key = nameKey(name);
    if (made.has(key)) return made.get(key);
    let row = findInLibrary(name, input.library);
    if (!row) {
      row = {
        id: newId(uuid),
        name: name.charAt(0).toUpperCase() + name.slice(1),
        aliases: '[]',
        ...equipmentOf(name),
        loadAddedValue: null,
        loadAddedUnit: null,
        primaryMuscles: '[]',
        secondaryMuscles: '[]',
        videoURL: null,
        isArchived: 0,
        catalogID: input.catalogId?.(name) ?? null,
        ...stamps,
      };
      added.push({ entity: 'exercise', op: 'insert', payload: row });
    }
    made.set(key, row);
    return row;
  };

  const sessionId = newId(uuid);
  const session = {
    id: sessionId,
    day,
    title: String(title || 'Strength').slice(0, 120),
    templateID: null,
    startedAt: null,
    finishedAt: null,
    warmUpNote: null,
    note: null,
    unitsAtLog: unit === 'kg' ? 'kg' : 'lb',
    healthWorkoutID: null,
    dayMovedAt: null,
    pausedAt: null,
    pausedSeconds: 0,
    ...stamps,
  };
  /** @type {{ entity: string, op: 'insert', payload: Row }[]} */
  const children = [];
  const sets = [];
  exercises.forEach((p, position) => {
    const lib = libraryRow(p.name);
    const loadMode = lib.loadMode ?? 'total';
    const se = {
      id: newId(uuid),
      sessionID: sessionId,
      exerciseID: lib.id,
      displayName: p.name,
      position,
      note: p.note ?? null,
      loadMode,
      equipment: lib.equipment ?? null,
      restSeconds: null,
      supersetGroup: null,
      loadAddedUnit: lib.loadAddedUnit ?? null,
      loadAddedValue: lib.loadAddedValue ?? null,
      nextTimeHintUnit: null,
      nextTimeHintValue: null,
      ...stamps,
    };
    children.push({ entity: 'sessionExercise', op: 'insert', payload: se });
    const range = p.repsMax != null && p.repsMax > p.reps;
    for (let k = 0; k < p.sets; k++) {
      sets.push({
        entity: 'set',
        op: 'insert',
        payload: {
          id: newId(uuid),
          sessionExerciseID: se.id,
          kind: 'working',
          position: k,
          status: 'planned',
          unit: session.unitsAtLog,
          loadMode,
          targetReps: range ? null : p.reps,
          targetRepMin: range ? p.reps : null,
          targetRepMax: range ? p.repsMax : null,
          targetWeight: null,
          actualReps: null,
          actualWeight: null,
          completedAt: null,
          note: null,
          rpe: null,
          loadAddedUnit: null,
          loadAddedValue: null,
          ...stamps,
        },
      });
    }
  });
  return { sessionId, changes: [...added, { entity: 'session', op: 'insert', payload: session }, ...children, ...sets] };
}
