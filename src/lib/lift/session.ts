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

// Planned volume, sets per muscle and state are pure (./session-stats.mjs), shared with the Lift app's API.
export { plannedVolume, sessionMuscles, sessionState } from './session-stats.mjs';
