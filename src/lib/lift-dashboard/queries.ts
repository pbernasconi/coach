import { isNull } from 'drizzle-orm';
import { db } from '@/db';
import { liftRows } from '@/db/lift-schema';
import { buildModel, displayUnit, type LiftData } from './stats.mjs';

/**
 * Loads every live (not soft-deleted) Lift row and joins it into the dashboard model. The data set is small
 * (about two sessions a week), so it is read whole and summarised in memory by ./stats.mjs.
 */
export async function loadLiftModel() {
  const rows = await db
    .select({ entity: liftRows.entity, payload: liftRows.payload })
    .from(liftRows)
    .where(isNull(liftRows.deletedAt));

  const data: LiftData = { exercises: [], sessions: [], sessionExercises: [], sets: [] };
  for (const row of rows) {
    if (row.entity === 'exercise') data.exercises.push(row.payload);
    else if (row.entity === 'session') data.sessions.push(row.payload);
    else if (row.entity === 'sessionExercise') data.sessionExercises.push(row.payload);
    else if (row.entity === 'set') data.sets.push(row.payload);
  }
  const model = buildModel(data);
  return { model, unit: displayUnit(model.sets) };
}
