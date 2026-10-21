import { epley } from '@/lib/lift-dashboard/stats.mjs';

/** Estimated 1RM of a set, or null when reps or weight are missing or reps are outside 1..12. */
export function epleyOf(reps: number | null, weight: number | null): number | null {
  return reps === null || weight === null ? null : epley(reps, weight);
}
