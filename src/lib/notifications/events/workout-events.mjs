// The workout domain of NOTIFICATION_EVENTS: a finished workout, from Lift (a strength session finished on the
// iPhone and synced) or Strava (an activity the watch uploaded). A tap opens that workout.

import { z } from 'zod';
import { DAY_SECONDS, defineEvent } from './define.mjs';
import { countText, distanceText, durationText, paceText, volumeText } from './format.mjs';

const ISO = z.iso.datetime({ offset: true });

/** What `workout.completed` takes. `source` decides the destination; the rest is optional detail for the text. */
export const workoutCompletedPayload = z.object({
  source: z.enum(['lift', 'strava']),
  /** Lift: the session UUID. Strava: the Strava activity id. */
  id: z.string().regex(/^[0-9A-Za-z_-]{1,64}$/),
  /** "Upper A", "Morning Run". */
  name: z.string().trim().min(1).max(200),
  /** Strava `sport_type` ("Run", "VirtualRide"); null for Lift. */
  sportType: z.string().max(60).nullable().default(null),
  durationS: z.number().int().nonnegative().nullable().default(null),
  distanceM: z.number().nonnegative().nullable().default(null),
  /** Lift: sets logged, volume in `unit`, and new e1RM records in the session. */
  sets: z.number().int().nonnegative().nullable().default(null),
  volume: z.number().nonnegative().nullable().default(null),
  unit: z.enum(['kg', 'lb']).nullable().default(null),
  prs: z.number().int().nonnegative().nullable().default(null),
  /** Strava: the activity's TSS. */
  tss: z.number().nonnegative().nullable().default(null),
  endedAt: ISO,
});

/** @typedef {z.infer<typeof workoutCompletedPayload>} WorkoutCompleted */

const RUNS = new Set(['Run', 'TrailRun', 'VirtualRun']);
const RIDES = new Set(['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'EBikeRide', 'EMountainBikeRide']);
const STRENGTH = new Set(['WeightTraining', 'Crossfit', 'Workout']);

/** "Run", "Ride", "Workout": the word in the title. */
export function sportWord(sportType) {
  if (!sportType) return 'Workout';
  if (RUNS.has(sportType)) return 'Run';
  if (RIDES.has(sportType)) return 'Ride';
  if (STRENGTH.has(sportType)) return 'Workout';
  if (sportType === 'Swim') return 'Swim';
  if (sportType === 'Walk') return 'Walk';
  if (sportType === 'Hike') return 'Hike';
  return 'Workout';
}

/**
 * The body: the name, then what was done. Lift: "Upper A · 52 min · 18 sets · 6,440 kg · 2 PRs". Strava:
 * "Morning Run · 10.2 km · 52 min · 5:07 /km · TSS 64".
 * @param {WorkoutCompleted} p
 */
export function workoutBody(p) {
  const parts = [p.name];
  if (p.distanceM) parts.push(distanceText(p.distanceM));
  if (p.durationS) parts.push(durationText(p.durationS));
  if (p.distanceM && p.durationS && RUNS.has(p.sportType ?? '')) parts.push(paceText(p.durationS, p.distanceM));
  if (p.sets) parts.push(countText(p.sets, 'set'));
  if (p.volume && p.unit) parts.push(volumeText(p.volume, p.unit));
  if (p.prs) parts.push(countText(p.prs, 'PR'));
  if (p.tss) parts.push(`TSS ${Math.round(p.tss)}`);
  return parts.join(' · ');
}

export const WORKOUT_NOTIFICATION_EVENTS = {
  'workout.completed': defineEvent({
    category: 'workouts',
    payload: workoutCompletedPayload,
    idempotencyKey: (p) => `workout.completed:${p.source}:${p.id.toLowerCase()}`,
    title: (p) => `${sportWord(p.sportType)} completed!`,
    body: workoutBody,
    destination: (p) => (p.source === 'lift' ? { kind: 'liftSession', id: p.id } : { kind: 'activity', id: p.id }),
    collapseKey: (p) => `workout:${p.source}:${p.id.toLowerCase()}`,
    threadKey: () => 'workouts',
    interruptionLevel: 'active',
    // A finished workout is news for a day; after that the app shows it anyway.
    ttlSeconds: DAY_SECONDS,
  }),
};
