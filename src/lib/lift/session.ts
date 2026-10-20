import { sessionDetail } from '@/lib/lift-dashboard/stats.mjs';
import { withMedia, type WithMedia } from './catalog';

type Detail = NonNullable<ReturnType<typeof sessionDetail>>;

/** A Lift session in full with catalog media: what the session page and the plan preview show. */
export type RichSession = WithMedia<Detail>;
export type RichExercise = RichSession['exercises'][number];
export type RichSet = RichExercise['sets'][number];

/** One session from the Lift model (any case id, or 'latest'), with media on each exercise; null if none. */
export function richSession(model: Parameters<typeof sessionDetail>[0], id: string, unit: Parameters<typeof sessionDetail>[2]): RichSession | null {
  const d = sessionDetail(model, id, unit) as Detail | null;
  return d ? withMedia(d) : null;
}

/** Planned volume: target reps × target load of the working sets (bodyweight sets count their added load). */
export function plannedVolume(s: RichSession) {
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

/** Sets per muscle for the session: 1 per working set for a primary muscle, 0.5 for a secondary; most first. */
export function sessionMuscles(s: RichSession) {
  const totals = new Map<string, number>();
  for (const e of s.exercises) {
    const sets = e.sets.filter((x) => x.kind !== 'warmUp' && x.status !== 'skipped').length;
    for (const m of e.primary) totals.set(m, (totals.get(m) ?? 0) + sets);
    for (const m of e.secondary) totals.set(m, (totals.get(m) ?? 0) + sets / 2);
  }
  return [...totals.entries()].map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets || a.muscle.localeCompare(b.muscle));
}

/** planned, in progress or done. */
export function sessionState(s: RichSession): 'planned' | 'inProgress' | 'done' {
  if (s.finishedAt) return 'done';
  return s.setsLogged > 0 || s.startedAt ? 'inProgress' : 'planned';
}
