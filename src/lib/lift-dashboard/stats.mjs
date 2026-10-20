// @ts-check
// Pure summaries of synced Lift rows for the read-only dashboard. Input is the `payload` of every
// non-deleted lift_rows row (LiftStore column names as keys). No framework imports, so it is testable with
// `node --test`.
//
// Definitions (shown on the pages too):
// - A logged set has status "done". Warm-ups (kind "warmUp") are excluded from volume and 1RM.
// - Volume = reps x logged weight, summed over logged non-warm-up sets. The logged weight is the number as
//   written (per hand for dumbbell pairs, per side for plate-loaded bars; added load for bodyweight).
// - Estimated 1RM uses Epley, w x (1 + reps / 30), for 1-12 reps; a single is its own max (as LiftCore).

import { toDate, toDay } from '../db-time.mjs';

export const LB_PER_KG = 1 / 0.45359237;
export const MAX_RELIABLE_REPS = 12;

/** @typedef {'kg' | 'lb'} Unit */
/** @typedef {Record<string, unknown>} Payload */

/**
 * @typedef {object} LiftData
 * @property {Payload[]} exercises
 * @property {Payload[]} sessions
 * @property {Payload[]} sessionExercises
 * @property {Payload[]} sets
 */

/** @param {unknown} v */
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
/** @param {unknown} v */
const str = (v) => (typeof v === 'string' ? v : null);
/** @param {unknown} v */
const lowerId = (v) => (typeof v === 'string' ? v.toLowerCase() : null);
/** @param {Payload} p */
const isDeleted = (p) => p.deletedAt !== null && p.deletedAt !== undefined;

/**
 * @param {number} value
 * @param {Unit} from
 * @param {Unit} to
 */
export function convert(value, from, to) {
  if (from === to) return value;
  return from === 'kg' ? value * LB_PER_KG : value / LB_PER_KG;
}

/**
 * Epley estimate, or null when reps are outside 1..12 or the weight is not positive.
 * @param {number} reps
 * @param {number} weight
 */
export function epley(reps, weight) {
  if (!Number.isInteger(reps) || reps < 1 || reps > MAX_RELIABLE_REPS || !(weight > 0)) return null;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

/**
 * Monday of the ISO week containing `day` ("YYYY-MM-DD"), as "YYYY-MM-DD".
 * @param {string} day
 */
export function weekStart(day) {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const weekday = (date.getUTCDay() + 6) % 7; // Monday = 0
  date.setUTCDate(date.getUTCDate() - weekday);
  return date.toISOString().slice(0, 10);
}

/**
 * The key that identifies an exercise across sessions: the library id when linked, else the name.
 * @param {Payload} sessionExercise
 */
export function exerciseKey(sessionExercise) {
  const id = lowerId(sessionExercise.exerciseID);
  if (id) return `id-${id}`;
  const name = (str(sessionExercise.displayName) ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  return `name-${name}`;
}

/**
 * @typedef {object} FlatSet
 * @property {string} id
 * @property {string} sessionId
 * @property {string} sessionExerciseId
 * @property {number} position order inside its exercise
 * @property {string | null} note
 * @property {string} day
 * @property {string} exerciseKey
 * @property {string} exerciseName
 * @property {string} kind
 * @property {string} status
 * @property {number | null} reps
 * @property {number | null} weight logged weight in `unit` (bodyweight: added load)
 * @property {Unit} unit
 * @property {number | null} targetReps planned reps (a single target)
 * @property {number | null} targetRepMin planned rep range, low end
 * @property {number | null} targetRepMax planned rep range, high end
 * @property {number | null} targetWeight planned weight in `unit` (bodyweight: added load)
 */

/**
 * Joins sessions -> session exercises -> sets, dropping anything deleted or orphaned.
 * @param {LiftData} data
 */
export function buildModel(data) {
  const sessions = new Map();
  for (const s of data.sessions) {
    const id = lowerId(s.id);
    const day = toDay(s.day); // 'YYYY-MM-DD'; a malformed day drops the session instead of breaking every page
    if (!id || !day || isDeleted(s)) continue;
    sessions.set(id, {
      id,
      day,
      title: str(s.title) ?? '',
      startedAt: str(s.startedAt),
      finishedAt: str(s.finishedAt),
      note: str(s.note),
      unit: /** @type {Unit} */ (s.unitsAtLog === 'lb' ? 'lb' : 'kg'),
    });
  }
  const libraryNames = new Map();
  /** Library facts per exercise key: the bundled catalog id (images, instructions) and the equipment. */
  const library = new Map();
  for (const e of data.exercises) {
    const id = lowerId(e.id);
    if (id && !isDeleted(e) && str(e.name)) libraryNames.set(`id-${id}`, str(e.name));
    if (id && !isDeleted(e)) library.set(`id-${id}`, { catalogId: str(e.catalogID), equipment: str(e.equipment) });
  }
  const sessionExercises = new Map();
  for (const se of data.sessionExercises) {
    const id = lowerId(se.id);
    const sessionId = lowerId(se.sessionID);
    if (!id || !sessionId || isDeleted(se) || !sessions.has(sessionId)) continue;
    const key = exerciseKey(se);
    sessionExercises.set(id, {
      id,
      sessionId,
      position: num(se.position) ?? 0,
      note: str(se.note),
      restSeconds: num(se.restSeconds),
      key,
      name: libraryNames.get(key) ?? str(se.displayName) ?? 'Exercise',
      loadMode: str(se.loadMode),
      loadAddedValue: num(se.loadAddedValue),
      loadAddedUnit: se.loadAddedUnit === 'lb' ? 'lb' : 'kg',
    });
  }
  /** @type {FlatSet[]} */
  const sets = [];
  for (const set of data.sets) {
    const seId = lowerId(set.sessionExerciseID);
    if (!seId || isDeleted(set)) continue;
    const se = sessionExercises.get(seId);
    if (!se) continue;
    const session = sessions.get(se.sessionId);
    const unit = /** @type {Unit} */ (set.unit === 'lb' ? 'lb' : 'kg');
    let weight = num(set.actualWeight);
    if (weight === null && se.loadMode === 'bodyweight' && se.loadAddedValue !== null) {
      weight = convert(se.loadAddedValue, /** @type {Unit} */ (se.loadAddedUnit), unit);
    }
    sets.push({
      id: lowerId(set.id) ?? '',
      sessionId: se.sessionId,
      sessionExerciseId: seId,
      position: num(set.position) ?? 0,
      note: str(set.note),
      day: session.day,
      exerciseKey: se.key,
      exerciseName: se.name,
      kind: str(set.kind) ?? 'working',
      status: str(set.status) ?? 'planned',
      reps: num(set.actualReps),
      weight,
      unit,
      targetReps: num(set.targetReps),
      targetRepMin: num(set.targetRepMin),
      targetRepMax: num(set.targetRepMax),
      targetWeight: num(set.targetWeight),
    });
  }
  // Muscles per library exercise (primaryMuscles / secondaryMuscles: a JSON array, or its text).
  /** @type {Map<string, { primary: string[], secondary: string[] }>} */
  const muscles = new Map();
  for (const e of data.exercises) {
    const id = lowerId(e.id);
    if (!id || isDeleted(e)) continue;
    muscles.set(`id-${id}`, { primary: muscleList(e.primaryMuscles), secondary: muscleList(e.secondaryMuscles) });
  }
  return { sessions, sessionExercises, sets, muscles, library };
}

/** @param {unknown} v */
function muscleList(v) {
  let list = v;
  if (typeof v === 'string') {
    try {
      list = JSON.parse(v);
    } catch {
      return [];
    }
  }
  return Array.isArray(list) ? list.filter((m) => typeof m === 'string') : [];
}

/** The target band of weekly hard sets per muscle, as in LiftCore's WeeklyVolume. */
export const MUSCLE_TARGET = { min: 10, max: 20 };

/**
 * Hard sets per muscle between two days (inclusive), as LiftCore's WeeklyVolume counts them: a done
 * non-warm-up set gives 1 to each primary muscle and 0.5 to each secondary muscle. Exercises not in the
 * library have no muscles and do not count. Most sets first.
 * @param {ReturnType<typeof buildModel>} model
 * @param {string} from 'YYYY-MM-DD'
 * @param {string} to 'YYYY-MM-DD'
 */
export function muscleSets(model, from, to) {
  const totals = new Map();
  for (const set of model.sets) {
    if (!isCountedSet(set) || set.day < from || set.day > to) continue;
    const m = model.muscles.get(set.exerciseKey);
    if (!m) continue;
    for (const muscle of m.primary) totals.set(muscle, (totals.get(muscle) ?? 0) + 1);
    for (const muscle of m.secondary) totals.set(muscle, (totals.get(muscle) ?? 0) + 0.5);
  }
  return [...totals.entries()]
    .map(([muscle, sets]) => ({
      muscle,
      sets,
      status: sets < MUSCLE_TARGET.min ? 'below' : sets > MUSCLE_TARGET.max ? 'above' : 'inRange',
    }))
    .sort((a, b) => b.sets - a.sets || a.muscle.localeCompare(b.muscle));
}

/**
 * The exercises done in the most sessions since `since`, each with its best estimated 1RM per session
 * since then, and the change from the first to the last of those.
 * @param {ReturnType<typeof buildModel>} model
 * @param {Unit} unit
 * @param {string} since 'YYYY-MM-DD'
 * @param {number} [count]
 */
export function topLifts(model, unit, since, count = 4) {
  return exerciseList(model, unit)
    .map((e) => {
      const detail = exerciseDetail(model, e.key, unit);
      const points = (detail?.e1rmOverTime ?? []).filter((p) => p.day >= since);
      const first = points[0]?.e1rm ?? null;
      const last = points.at(-1)?.e1rm ?? null;
      return {
        key: e.key,
        name: e.name,
        sessions: points.length,
        points,
        latest: last,
        change: first && last && points.length > 1 ? (last - first) / first : null,
      };
    })
    .filter((e) => e.sessions > 0)
    .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name))
    .slice(0, count);
}

/** @param {FlatSet} set */
export function isCountedSet(set) {
  return set.status === 'done' && set.kind !== 'warmUp';
}

/**
 * Volume of one set in `unit`, 0 when reps or weight are missing.
 * @param {FlatSet} set
 * @param {Unit} unit
 */
export function setVolume(set, unit) {
  if (!isCountedSet(set) || set.reps === null || set.weight === null) return 0;
  return set.reps * convert(set.weight, set.unit, unit);
}

/**
 * The unit most logged sets use (kg on a tie or with no data), used to display mixed-unit history.
 * @param {FlatSet[]} sets
 * @returns {Unit}
 */
export function displayUnit(sets) {
  let kg = 0;
  let lb = 0;
  for (const s of sets) {
    if (!isCountedSet(s)) continue;
    if (s.unit === 'lb') lb += 1;
    else kg += 1;
  }
  return lb > kg ? 'lb' : 'kg';
}

/**
 * Sessions with at least one logged set, newest first. A session planned ahead (in Lift, or by Coach's
 * scripts/lift-plan.mjs) has only planned sets until it is done, so it is left out unless `planned` is true.
 * @param {ReturnType<typeof buildModel>} model
 * @param {Unit} unit
 * @param {{ planned?: boolean }} [options]
 */
export function sessionSummaries(model, unit, { planned = false } = {}) {
  const byId = new Map();
  for (const s of model.sessions.values()) {
    byId.set(s.id, { id: s.id, day: s.day, title: s.title, startedAt: s.startedAt, setsLogged: 0, setsTotal: 0, volume: 0 });
  }
  for (const set of model.sets) {
    const summary = byId.get(set.sessionId);
    summary.setsTotal += 1;
    if (set.status === 'done') summary.setsLogged += 1;
    summary.volume += setVolume(set, unit);
  }
  return [...byId.values()]
    .filter((s) => planned || s.setsLogged > 0)
    .sort((a, b) => b.day.localeCompare(a.day) || String(b.startedAt ?? '').localeCompare(String(a.startedAt ?? '')));
}

/**
 * Volume and counted sets per ISO week (Monday start), newest first, including empty weeks between the
 * first and last logged week.
 * @param {ReturnType<typeof buildModel>} model
 * @param {Unit} unit
 */
export function weeklyVolume(model, unit) {
  const weeks = new Map();
  for (const s of model.sessions.values()) {
    const w = weekStart(s.day);
    if (!weeks.has(w)) weeks.set(w, { week: w, sessions: 0, sets: 0, volume: 0 });
    weeks.get(w).sessions += 1;
  }
  for (const set of model.sets) {
    const w = weeks.get(weekStart(set.day));
    if (isCountedSet(set)) w.sets += 1;
    w.volume += setVolume(set, unit);
  }
  if (weeks.size === 0) return [];
  const keys = [...weeks.keys()].sort();
  const result = [];
  const cursor = new Date(`${keys[0]}T00:00:00Z`);
  const end = keys[keys.length - 1];
  while (cursor.toISOString().slice(0, 10) <= end) {
    const key = cursor.toISOString().slice(0, 10);
    result.push(weeks.get(key) ?? { week: key, sessions: 0, sets: 0, volume: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return result.reverse();
}

/**
 * Every exercise with logged sets: name, sessions, last day, best estimated 1RM, newest first.
 * @param {ReturnType<typeof buildModel>} model
 * @param {Unit} unit
 */
export function exerciseList(model, unit) {
  const map = new Map();
  for (const set of model.sets) {
    if (!isCountedSet(set)) continue;
    let e = map.get(set.exerciseKey);
    if (!e) {
      e = { key: set.exerciseKey, name: set.exerciseName, sessionIds: new Set(), lastDay: set.day, bestE1rm: null };
      map.set(set.exerciseKey, e);
    }
    e.sessionIds.add(set.sessionId);
    if (set.day > e.lastDay) e.lastDay = set.day;
    const est = set.reps !== null && set.weight !== null ? epley(set.reps, convert(set.weight, set.unit, unit)) : null;
    if (est !== null && (e.bestE1rm === null || est > e.bestE1rm)) e.bestE1rm = est;
  }
  return [...map.values()]
    .map(({ sessionIds, ...rest }) => ({ ...rest, sessions: sessionIds.size }))
    .sort((a, b) => b.lastDay.localeCompare(a.lastDay) || a.name.localeCompare(b.name));
}

/**
 * Detail for one exercise: best sets by estimated 1RM, and the best estimate per session over time.
 * @param {ReturnType<typeof buildModel>} model
 * @param {string} key
 * @param {Unit} unit
 * @param {number} [bestCount]
 */
export function exerciseDetail(model, key, unit, bestCount = 10) {
  const sets = model.sets.filter((s) => s.exerciseKey === key && isCountedSet(s));
  if (sets.length === 0) return null;
  const rows = sets.map((s) => {
    const weight = s.weight === null ? null : convert(s.weight, s.unit, unit);
    return {
      day: s.day,
      sessionId: s.sessionId,
      reps: s.reps,
      weight,
      e1rm: s.reps !== null && weight !== null ? epley(s.reps, weight) : null,
    };
  });
  const bestSets = rows
    .filter((r) => r.e1rm !== null)
    .sort((a, b) => /** @type {number} */ (b.e1rm) - /** @type {number} */ (a.e1rm) || b.day.localeCompare(a.day))
    .slice(0, bestCount);
  const perSession = new Map();
  for (const r of rows) {
    if (r.e1rm === null) continue;
    const prev = perSession.get(r.sessionId);
    if (!prev || r.e1rm > prev.e1rm) perSession.set(r.sessionId, { day: r.day, e1rm: r.e1rm, reps: r.reps, weight: r.weight });
  }
  const e1rmOverTime = [...perSession.values()].sort((a, b) => a.day.localeCompare(b.day));
  const heaviest = rows.reduce((max, r) => (r.weight !== null && (max === null || r.weight > max) ? r.weight : max), /** @type {number | null} */ (null));
  return {
    key,
    name: sets[sets.length - 1].exerciseName,
    loggedSets: sets.length,
    sessions: new Set(sets.map((s) => s.sessionId)).size,
    heaviest,
    bestSets,
    e1rmOverTime,
  };
}

/**
 * What came before a session for one exercise: the last session that logged it (its working sets), the best
 * estimated 1RM, and the best estimate of each of the last `points` sessions (oldest first), all before `day`
 * and leaving out `sessionId`. Weights in `unit`.
 * @param {ReturnType<typeof buildModel>} model
 * @param {string} key
 * @param {Unit} unit
 * @param {string} day
 * @param {string} sessionId
 * @param {number} [points]
 */
export function exerciseHistory(model, key, unit, day, sessionId, points = 10) {
  /** @type {Map<string, { sessionId: string, day: string, sets: { reps: number | null, weight: number | null, position: number }[], e1rm: number | null }>} */
  const bySession = new Map();
  for (const s of model.sets) {
    if (s.exerciseKey !== key || s.sessionId === sessionId || s.day > day || !isCountedSet(s)) continue;
    let e = bySession.get(s.sessionId);
    if (!e) {
      e = { sessionId: s.sessionId, day: s.day, sets: [], e1rm: null };
      bySession.set(s.sessionId, e);
    }
    const weight = s.weight === null ? null : convert(s.weight, s.unit, unit);
    e.sets.push({ reps: s.reps, weight, position: s.position });
    const est = s.reps !== null && weight !== null ? epley(s.reps, weight) : null;
    if (est !== null && (e.e1rm === null || est > e.e1rm)) e.e1rm = est;
  }
  const sessions = [...bySession.values()].sort((a, b) => a.day.localeCompare(b.day) || a.sessionId.localeCompare(b.sessionId));
  for (const e of sessions) e.sets.sort((a, b) => a.position - b.position);
  const last = sessions.at(-1) ?? null;
  const best = sessions.reduce((m, e) => (e.e1rm !== null && (m === null || e.e1rm > m.e1rm) ? { day: e.day, e1rm: e.e1rm } : m), /** @type {{ day: string, e1rm: number } | null} */ (null));
  return {
    last: last ? { day: last.day, sessionId: last.sessionId, sets: last.sets.map(({ reps, weight }) => ({ reps, weight })) } : null,
    best,
    trend: sessions.filter((e) => e.e1rm !== null).slice(-points).map((e) => ({ day: e.day, e1rm: /** @type {number} */ (e.e1rm) })),
    sessions: sessions.length,
  };
}

/**
 * One session in full, for the session page and the Plan preview: its summary, then each exercise in the
 * session's order with its sets in order. Weights are in `unit`. `id` is a session id (any case) or 'latest'
 * for the newest session. Null when there is no such session.
 * @param {ReturnType<typeof buildModel>} model
 * @param {string} id
 * @param {Unit} unit
 */
export function sessionDetail(model, id, unit) {
  // Newest first, with planned sessions too, so a session planned ahead also opens. "latest" is the newest
  // session with a logged set (else the newest of all).
  const order = sessionSummaries(model, unit, { planned: true });
  const latest = Math.max(0, order.findIndex((s) => s.setsLogged > 0));
  const index = id === 'latest' ? (order.length ? latest : -1) : order.findIndex((s) => s.id === id.toLowerCase());
  if (index < 0) return null;
  const summary = order[index];
  const session = model.sessions.get(summary.id);
  const started = toDate(session.startedAt);
  const finished = toDate(session.finishedAt);
  const minutes = started && finished && finished > started ? Math.round((finished.getTime() - started.getTime()) / 60000) : null;

  /** @type {Map<string, { id: string, key: string, name: string, note: string | null, loadMode: string | null, restSeconds: number | null, catalogId: string | null, equipment: string | null, primary: string[], secondary: string[], position: number, volume: number, setsLogged: number, sets: FlatSet[], history: ReturnType<typeof exerciseHistory> }>} */
  const groups = new Map();
  for (const se of model.sessionExercises.values()) {
    if (se.sessionId !== summary.id) continue;
    const lib = model.library.get(se.key);
    const m = model.muscles.get(se.key);
    groups.set(se.id, {
      id: se.id, key: se.key, name: se.name, note: se.note, loadMode: se.loadMode, restSeconds: se.restSeconds,
      catalogId: lib?.catalogId ?? null, equipment: lib?.equipment ?? null,
      primary: m?.primary ?? [], secondary: m?.secondary ?? [],
      position: se.position, volume: 0, setsLogged: 0, sets: [],
      history: exerciseHistory(model, se.key, unit, summary.day, summary.id),
    });
  }
  for (const set of model.sets) {
    if (set.sessionId !== summary.id) continue;
    const g = groups.get(set.sessionExerciseId);
    // A set whose exercise row has not synced (or was deleted) has no group: leave it out, do not fail the page.
    if (!g) continue;
    g.sets.push(set);
    g.volume += setVolume(set, unit);
    if (set.status === 'done') g.setsLogged += 1;
  }
  const exercises = [...groups.values()]
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
    .map(({ sets, ...e }) => {
      let working = 0;
      return {
        ...e,
        sets: [...sets]
          .sort((a, b) => a.position - b.position)
          .map((s) => ({
            id: s.id,
            label: s.kind === 'warmUp' ? 'W' : String((working += 1)),
            kind: s.kind,
            status: s.status,
            reps: s.reps,
            weight: s.weight === null ? null : convert(s.weight, s.unit, unit),
            note: s.note,
            // What Lift planned for the set (scripts/lift-plan.mjs or the app), in `unit`.
            target: {
              reps: s.targetReps,
              repMin: s.targetRepMin,
              repMax: s.targetRepMax,
              weight: s.targetWeight === null ? null : convert(s.targetWeight, s.unit, unit),
            },
          })),
      };
    });

  return {
    id: summary.id,
    day: summary.day,
    title: summary.title,
    note: session.note,
    startedAt: started?.toISOString() ?? null,
    finishedAt: finished?.toISOString() ?? null,
    minutes,
    unit,
    volume: summary.volume,
    setsLogged: summary.setsLogged,
    setsTotal: summary.setsTotal,
    exercises,
    newerId: order[index - 1]?.id ?? null,
    olderId: order[index + 1]?.id ?? null,
  };
}
