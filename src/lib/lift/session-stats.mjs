// @ts-check
// Pure facts of one Lift session (a sessionDetail from lift-dashboard/stats.mjs): planned volume, sets per muscle,
// state. Shared by the session page, the plan preview and the Lift app's API (lift/APP-API.md). node --test.

/**
 * @typedef {{ kind: string, status: string, target: { reps: number | null, repMin: number | null, weight: number | null } }} StatSet
 * @typedef {{ primary: string[], secondary: string[], sets: StatSet[] }} StatExercise
 */

/** Planned volume: target reps × target load of the working sets (bodyweight sets count their added load). @param {{ exercises: StatExercise[] }} s */
export function plannedVolume(s) {
  let v = 0;
  for (const e of s.exercises) {
    for (const set of e.sets) {
      if (set.kind === 'warmUp') continue;
      const reps = set.target.reps ?? set.target.repMin;
      if (reps != null && set.target.weight != null) v += reps * set.target.weight;
    }
  }
  return v;
}

/**
 * Sets per muscle for the session: 1 per working set for a primary muscle, 0.5 for a secondary; most first. A finished
 * session counts only the sets that were done, like /lift's hard sets; an open one counts every set not skipped.
 * @param {{ exercises: StatExercise[], finishedAt?: string | null }} s
 */
export function sessionMuscles(s) {
  /** @type {Map<string, number>} */
  const totals = new Map();
  const finished = Boolean(s.finishedAt);
  for (const e of s.exercises) {
    const sets = e.sets.filter((x) => x.kind !== 'warmUp' && (finished ? x.status === 'done' : x.status !== 'skipped')).length;
    for (const m of e.primary) totals.set(m, (totals.get(m) ?? 0) + sets);
    for (const m of e.secondary) totals.set(m, (totals.get(m) ?? 0) + sets / 2);
  }
  return [...totals.entries()].filter(([, sets]) => sets > 0).map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets || a.muscle.localeCompare(b.muscle));
}

/**
 * planned, in progress or done.
 * @param {{ finishedAt: string | null, startedAt: string | null, setsLogged: number }} s
 * @returns {'planned' | 'inProgress' | 'done'}
 */
export function sessionState(s) {
  if (s.finishedAt) return 'done';
  return s.setsLogged > 0 || s.startedAt ? 'inProgress' : 'planned';
}
