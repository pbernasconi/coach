// Edits to a Lift session from the web (the Plan modal), as Lift sync changes (lift/SYNC.md). The web writes the same
// rows the iPhone writes, through the same push code, so the phone pulls the edit on its next sync. Pure: it turns
// the session's current rows and a list of edits into the changes to push; node --test (edit.test.mjs).

/**
 * @typedef {Record<string, any>} Row a lift_rows payload (column names as keys, UUIDs as pushed)
 * @typedef {{ session: Row, exercises: Row[], sets: Row[], library: Row[] }} SessionRows
 * @typedef {(
 *   | { type: 'setTarget', setId: string, weight?: number | null, reps?: number | null, unit?: 'kg' | 'lb' }
 *   | { type: 'addSet', sessionExerciseId: string }
 *   | { type: 'removeSet', setId: string }
 *   | { type: 'removeExercise', sessionExerciseId: string }
 *   | { type: 'moveExercise', sessionExerciseId: string, dir: -1 | 1 }
 *   | { type: 'exerciseNote', sessionExerciseId: string, note: string | null }
 *   | { type: 'addExercise', exerciseId: string, sets: number, reps: number | null, weight: number | null, unit?: 'kg' | 'lb' }
 *   | { type: 'resetSession' }
 *   | { type: 'unlogSet', setId: string }
 * )} LiftEdit
 * @typedef {{ entity: 'session' | 'sessionExercise' | 'set', op: 'insert' | 'update' | 'delete', payload: Row }} LiftChange
 */

const LB_PER_KG = 1 / 0.45359237;

/** A weight typed in `from` as the row's unit `to`, to 0.1 (the web may show kg for a session logged in lb). */
export function toUnit(weight, from, to) {
  if (weight == null || !from || !to || from === to) return weight;
  return Math.round((from === 'kg' ? weight * LB_PER_KG : weight / LB_PER_KG) * 10) / 10;
}

const same = (a, b) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
const alive = (r) => !r.deletedAt;

/** An edit's updatedAt: now, or 1 ms past the row's own when a device clock ran ahead (lift/SYNC.md). */
export function stamp(row, now) {
  const prev = Date.parse(row?.updatedAt ?? '');
  return new Date(Number.isFinite(prev) && prev >= now.getTime() ? prev + 1 : now.getTime()).toISOString();
}

/** A new row id in Swift's upper-case form. */
const newId = (uuid) => uuid().toUpperCase();

/**
 * The changes for `edits` on one session, or { error }. A finished session, a logged set and a set or exercise of
 * another session are refused. The one exception is `resetSession`, alone: it takes a session logged by mistake back
 * to planned (every set planned with no actuals, no start or finish), finished or not. Weights and reps must be 0–2000 and 1–200.
 * @param {SessionRows} rows
 * @param {LiftEdit[]} edits
 * @param {{ now?: Date, uuid?: () => string }} [opts]
 * @returns {{ changes: LiftChange[] } | { error: string }}
 */
export function planLiftEdit(rows, edits, opts = {}) {
  const now = opts.now ?? new Date();
  const uuid = opts.uuid ?? (() => crypto.randomUUID());
  const { session } = rows;
  if (!session || !alive(session)) return { error: 'The Lift session is not there.' };
  if (edits.length === 1 && edits[0]?.type === 'resetSession') return resetSession(rows, now);
  if (edits.some((e) => e?.type === 'resetSession')) return { error: 'Reset the session on its own.' };
  if (edits.length === 1 && edits[0]?.type === 'unlogSet') return unlogSet(rows, edits[0].setId, now);
  if (edits.some((e) => e?.type === 'unlogSet')) return { error: 'Un-log a set on its own.' };
  if (session.finishedAt) return { error: 'The session is finished; edit it in Lift.' };

  // Working copies, so later edits see earlier ones; `touched` keeps the change for each row once.
  const exercises = new Map(rows.exercises.filter(alive).map((e) => [String(e.id).toLowerCase(), { ...e }]));
  const sets = new Map(rows.sets.filter(alive).map((s) => [String(s.id).toLowerCase(), { ...s }]));
  /** @type {Map<string, LiftChange>} */
  const touched = new Map();
  const touch = (entity, row, op) => {
    const key = `${entity}:${String(row.id).toLowerCase()}`;
    const prev = touched.get(key);
    touched.set(key, { entity, op: prev?.op === 'insert' ? (op === 'delete' ? 'delete' : 'insert') : op, payload: row });
  };
  const exOf = (id) => exercises.get(String(id).toLowerCase());
  const setsOf = (exId) => [...sets.values()].filter((s) => same(s.sessionExerciseID, exId)).sort((a, b) => a.position - b.position);
  const ordered = () => [...exercises.values()].sort((a, b) => a.position - b.position);
  const num = (v, lo, hi) => (v === null ? null : typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : undefined);

  for (const e of edits) {
    if (e.type === 'setTarget') {
      const s = sets.get(String(e.setId).toLowerCase());
      if (!s) return { error: 'That set is not in this session.' };
      if (s.status === 'done') return { error: 'A logged set cannot change.' };
      const next = { ...s };
      if (e.weight !== undefined) {
        const w = num(e.weight, 0, 2000);
        if (w === undefined) return { error: 'The weight must be 0 to 2000.' };
        next.targetWeight = toUnit(w, e.unit, s.unit);
      }
      if (e.reps !== undefined) {
        const r = num(e.reps, 1, 200);
        if (r === undefined) return { error: 'The reps must be 1 to 200.' };
        Object.assign(next, { targetReps: r, targetRepMin: null, targetRepMax: null });
      }
      next.updatedAt = stamp(s, now);
      sets.set(String(s.id).toLowerCase(), next);
      touch('set', next, 'update');
    } else if (e.type === 'addSet') {
      const ex = exOf(e.sessionExerciseId);
      if (!ex) return { error: 'That exercise is not in this session.' };
      const list = setsOf(ex.id);
      const model = [...list].reverse().find((s) => s.kind !== 'warmUp') ?? list.at(-1);
      const at = now.toISOString();
      const row = {
        ...(model ?? { kind: 'working', unit: session.unitsAtLog ?? 'lb', loadMode: ex.loadMode ?? 'total', targetReps: 8, targetWeight: null, targetRepMin: null, targetRepMax: null, loadAddedUnit: null, loadAddedValue: null }),
        id: newId(uuid),
        sessionExerciseID: ex.id,
        kind: model?.kind === 'warmUp' ? 'working' : (model?.kind ?? 'working'),
        position: list.length ? Math.max(...list.map((s) => s.position)) + 1 : 0,
        status: 'planned',
        actualReps: null,
        actualWeight: null,
        completedAt: null,
        note: null,
        rpe: null,
        createdAt: at,
        updatedAt: at,
        deletedAt: null,
      };
      sets.set(String(row.id).toLowerCase(), row);
      touch('set', row, 'insert');
    } else if (e.type === 'removeSet') {
      const s = sets.get(String(e.setId).toLowerCase());
      if (!s) return { error: 'That set is not in this session.' };
      if (s.status === 'done') return { error: 'A logged set cannot be removed here.' };
      const at = stamp(s, now);
      sets.delete(String(s.id).toLowerCase());
      touch('set', { ...s, updatedAt: at, deletedAt: at }, 'delete');
    } else if (e.type === 'removeExercise') {
      const ex = exOf(e.sessionExerciseId);
      if (!ex) return { error: 'That exercise is not in this session.' };
      const list = setsOf(ex.id);
      if (list.some((s) => s.status === 'done')) return { error: 'An exercise with logged sets cannot be removed here.' };
      for (const s of list) {
        const at = stamp(s, now);
        sets.delete(String(s.id).toLowerCase());
        touch('set', { ...s, updatedAt: at, deletedAt: at }, 'delete');
      }
      const at = stamp(ex, now);
      exercises.delete(String(ex.id).toLowerCase());
      touch('sessionExercise', { ...ex, updatedAt: at, deletedAt: at }, 'delete');
    } else if (e.type === 'moveExercise') {
      const list = ordered();
      const i = list.findIndex((x) => same(x.id, e.sessionExerciseId));
      const j = i + e.dir;
      if (i < 0) return { error: 'That exercise is not in this session.' };
      if (j < 0 || j >= list.length) continue;
      const [a, b] = [list[i], list[j]];
      const pa = a.position;
      const na = { ...a, position: b.position, updatedAt: stamp(a, now) };
      const nb = { ...b, position: pa, updatedAt: stamp(b, now) };
      exercises.set(String(a.id).toLowerCase(), na);
      exercises.set(String(b.id).toLowerCase(), nb);
      touch('sessionExercise', na, 'update');
      touch('sessionExercise', nb, 'update');
    } else if (e.type === 'exerciseNote') {
      const ex = exOf(e.sessionExerciseId);
      if (!ex) return { error: 'That exercise is not in this session.' };
      const note = typeof e.note === 'string' && e.note.trim() ? e.note.trim().slice(0, 500) : null;
      const next = { ...ex, note, updatedAt: stamp(ex, now) };
      exercises.set(String(ex.id).toLowerCase(), next);
      touch('sessionExercise', next, 'update');
    } else if (e.type === 'addExercise') {
      const lib = rows.library.find((x) => same(x.id, e.exerciseId) && alive(x));
      if (!lib) return { error: 'That exercise is not in your Lift library.' };
      const count = Math.round(e.sets);
      if (!(count >= 1 && count <= 10)) return { error: 'Add 1 to 10 sets.' };
      const reps = num(e.reps, 1, 200);
      const weight = num(e.weight, 0, 2000);
      if (reps === undefined || weight === undefined) return { error: 'The reps must be 1 to 200 and the weight 0 to 2000.' };
      const at = now.toISOString();
      const list = ordered();
      const ex = {
        id: newId(uuid),
        sessionID: session.id,
        exerciseID: lib.id,
        displayName: lib.name,
        position: list.length ? Math.max(...list.map((x) => x.position)) + 1 : 0,
        note: null,
        loadMode: lib.loadMode ?? 'total',
        equipment: lib.equipment ?? null,
        restSeconds: null,
        supersetGroup: null,
        loadAddedUnit: lib.loadAddedUnit ?? null,
        loadAddedValue: lib.loadAddedValue ?? null,
        nextTimeHintUnit: null,
        nextTimeHintValue: null,
        createdAt: at,
        updatedAt: at,
        deletedAt: null,
      };
      exercises.set(String(ex.id).toLowerCase(), ex);
      touch('sessionExercise', ex, 'insert');
      for (let k = 0; k < count; k++) {
        const s = {
          id: newId(uuid),
          sessionExerciseID: ex.id,
          kind: 'working',
          position: k,
          status: 'planned',
          unit: session.unitsAtLog ?? 'lb',
          loadMode: ex.loadMode,
          targetReps: reps,
          targetRepMin: null,
          targetRepMax: null,
          targetWeight: toUnit(weight, e.unit, session.unitsAtLog ?? 'lb'),
          actualReps: null,
          actualWeight: null,
          completedAt: null,
          note: null,
          loadAddedUnit: null,
          loadAddedValue: null,
          createdAt: at,
          updatedAt: at,
          deletedAt: null,
        };
        sets.set(String(s.id).toLowerCase(), s);
        touch('set', s, 'insert');
      }
    } else {
      return { error: 'Unknown edit.' };
    }
  }
  return { changes: parentsFirst([...touched.values()]), after: { exercises: ordered(), sets: [...sets.values()] } };
}

const DEPTH = { session: 0, sessionExercise: 1, set: 2 };

/** Parents before children, so the phone never sees a set without its exercise. */
const parentsFirst = (changes) => changes.sort((a, b) => DEPTH[a.entity] - DEPTH[b.entity]);

/**
 * The changes that un-log one set (a tap logged by mistake): the set back to planned with no completedAt, like Lift's
 * own un-log (its values stay as the next log's prefill). Works on a finished session too. When nothing is left
 * logged, the session loses its start and finish, so it reads as planned again everywhere.
 * @param {SessionRows} rows
 * @param {string} setId
 * @param {Date} now
 */
function unlogSet(rows, setId, now) {
  const { session } = rows;
  const exercises = rows.exercises.filter(alive);
  const ids = new Set(exercises.map((e) => String(e.id).toLowerCase()));
  const mine = rows.sets.filter((s) => alive(s) && ids.has(String(s.sessionExerciseID).toLowerCase()));
  const set = mine.find((s) => same(s.id, setId));
  if (!set) return { error: 'That set is not in this session.' };
  /** @type {LiftChange[]} */
  const changes = [];
  let next = set;
  if (set.status !== 'planned') {
    next = { ...set, status: 'planned', completedAt: null, updatedAt: stamp(set, now) };
    changes.push({ entity: 'set', op: 'update', payload: next });
  }
  const sets = rows.sets.filter(alive).map((s) => (s === set ? next : s));
  const anyLogged = mine.some((s) => s !== set && s.status !== 'planned');
  if (!anyLogged && (session.startedAt || session.finishedAt)) {
    changes.push({ entity: 'session', op: 'update', payload: { ...session, startedAt: null, finishedAt: null, updatedAt: stamp(session, now) } });
  }
  return { changes: parentsFirst(changes), after: { exercises, sets } };
}

/**
 * The changes that take a session back to planned: each logged or skipped set to planned with no actuals and no
 * completedAt, and the session with no startedAt or finishedAt. Targets, exercises and notes stay.
 * @param {SessionRows} rows
 * @param {Date} now
 */
function resetSession(rows, now) {
  const { session } = rows;
  const exercises = rows.exercises.filter(alive);
  const ids = new Set(exercises.map((e) => String(e.id).toLowerCase()));
  /** @type {LiftChange[]} */
  const changes = [];
  const sets = rows.sets.filter(alive).map((s) => {
    if (!ids.has(String(s.sessionExerciseID).toLowerCase())) return s;
    if (s.status === 'planned' && s.completedAt == null && s.actualReps == null && s.actualWeight == null) return s;
    const next = { ...s, status: 'planned', completedAt: null, actualReps: null, actualWeight: null, rpe: null, updatedAt: stamp(s, now) };
    changes.push({ entity: 'set', op: 'update', payload: next });
    return next;
  });
  if (session.startedAt || session.finishedAt) {
    changes.push({ entity: 'session', op: 'update', payload: { ...session, startedAt: null, finishedAt: null, updatedAt: stamp(session, now) } });
  }
  return { changes: parentsFirst(changes), after: { exercises, sets } };
}

/**
 * The session after the edit in the shape src/lib/plan/lift-plan.mjs `mergeDescription` reads, for the plan's text
 * copy of the sets.
 * @param {Row} session
 * @param {Row[]} exercises
 * @param {Row[]} sets
 */
export function planShape(session, exercises, sets) {
  return {
    title: session.title ?? 'Lift session',
    exercises: [...exercises].sort((a, b) => a.position - b.position).map((e) => ({
      name: e.displayName,
      loadMode: e.loadMode,
      sets: sets
        .filter((s) => same(s.sessionExerciseID, e.id))
        .sort((a, b) => a.position - b.position)
        .map((s) => ({
          kind: s.kind,
          status: s.status,
          actualReps: s.actualReps,
          actualWeight: s.actualWeight,
          reps: s.targetReps,
          repMin: s.targetRepMin,
          repMax: s.targetRepMax,
          weight: s.targetWeight,
          unit: s.unit,
        })),
    })),
  };
}
