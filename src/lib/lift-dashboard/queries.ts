import { cache } from 'react';
import { sql } from '@/db';
import { cached } from '@/lib/data-cache';
import { buildModel, displayUnit, type LiftData } from './stats.mjs';

// The rows are split into SHARDS cache entries by a hash of the id, so each entry stays far below the 2 MB limit
// of one cache entry as the history grows (about 1 MB for 60 sessions in 2026-10).
const SHARDS = 8;

type Row = { entity: string; payload: Record<string, unknown> };

const shard = cached(
  async (n: number) =>
    (await sql`
      SELECT entity, payload FROM lift_rows
      WHERE deleted_at IS NULL AND mod(abs(hashtext(id::text)), ${SHARDS}) = ${n}`) as Row[],
  'lift-rows',
  'lift'
);

/**
 * Loads every live (not soft-deleted) Lift row and joins it into the dashboard model. The data set is small
 * (about two sessions a week), so it is read whole and summarised in memory by ./stats.mjs. The rows come from
 * the data cache (cleared by each Lift sync push), and one request builds the model once.
 */
export const loadLiftModel = cache(async () => {
  const shards = await Promise.all(Array.from({ length: SHARDS }, (_, n) => shard(n)));
  const data: LiftData = { exercises: [], sessions: [], sessionExercises: [], sets: [] };
  for (const row of shards.flat()) {
    if (row.entity === 'exercise') data.exercises.push(row.payload);
    else if (row.entity === 'session') data.sessions.push(row.payload);
    else if (row.entity === 'sessionExercise') data.sessionExercises.push(row.payload);
    else if (row.entity === 'set') data.sets.push(row.payload);
  }
  const model = buildModel(data);
  return { model, unit: displayUnit(model.sets) };
});
