// Keeps a planned Lift session on the day of its plan workout right away, when the workout is moved, skipped,
// removed, un-skipped or restored on the web or with scripts/plan-edit.mjs. Before, the session stayed on its old day
// until scripts/lift-plan.mjs ran again. The change goes through the Lift sync push code (a new seq and a newer
// updatedAt, lift/SYNC.md), so the iPhone pulls it on its next sync.
//
// The rule is lift-plan.mjs's: a session that was started, finished or has a logged set never changes. A skipped or
// removed workout soft-deletes its session (only the session row, as LiftStore's own remove does; its exercises and
// sets stay and go with it). An un-skip or an Undo of a remove brings the session back (LiftStore's undo does the
// same). lift-plan.mjs still runs after /plan and /check-in: it re-plans the targets and clears the link of a
// removed session.
//
// `liftFollowChange` is pure (node --test, follow-plan.test.mjs); `followLiftSession` and `followWorkout` read the
// database with any `sql` tagged template (Neon or node-postgres) and push through the function they are given.

import { toDate, toDay } from '../db-time.mjs';
import { isUuid } from '../lift-sync/contract.mjs';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * An edit's updatedAt: now, or 1 ms past the stored row's when that is not older than now (the server keeps only a
 * strictly newer row; lift/SYNC.md).
 * @param {Date | null} stored
 * @param {Date} now
 */
export function stampAfter(stored, now) {
  const prev = stored ? stored.getTime() : -Infinity;
  return new Date(prev >= now.getTime() ? prev + 1 : now.getTime()).toISOString();
}

/**
 * The change to push for a session, or why there is none.
 * @param {{ payload: Record<string, any>, updatedAt: Date | null, deletedAt: Date | null } | null} row  the session's
 *   lift_rows row (deleted rows too)
 * @param {{ day?: string, remove?: boolean, restore?: boolean }} want  remove: the workout is skipped or gone; else the
 *   session belongs on `day`. restore: a removed session may come back (un-skip, Undo); a plain move leaves it removed.
 * @param {{ logged: boolean, now: Date }} opts  logged: a set of the session is not 'planned' any more
 * @returns {{ change: { entity: 'session', op: 'update' | 'delete', payload: Record<string, any> } } | { skip: string }}
 */
export function liftFollowChange(row, want, { logged, now }) {
  if (!row) return { skip: 'no session' };
  const s = row.payload ?? {};
  if (s.startedAt || s.finishedAt || logged) return { skip: 'started' };
  const removed = Boolean(row.deletedAt || s.deletedAt);
  const stored = [row.updatedAt, toDate(s.updatedAt)].filter(Boolean).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const at = stampAfter(stored, now);
  if (want.remove) {
    if (removed) return { skip: 'removed already' };
    return { change: { entity: 'session', op: 'delete', payload: { ...s, updatedAt: at, deletedAt: at } } };
  }
  if (!DAY.test(want.day ?? '')) return { skip: 'no day' };
  if (removed && !want.restore) return { skip: 'removed' };
  if (!removed && s.day === want.day) return { skip: 'on its day' };
  return { change: { entity: 'session', op: 'update', payload: { ...s, day: want.day, updatedAt: at, deletedAt: null } } };
}

/**
 * @typedef {(changes: { idempotencyKey: string, entity: string, op: string, rowId: string, payload: Record<string, any> }[])
 *   => Promise<{ accepted: string[], rejected: { reason: string }[] }>} PushChanges
 */

/**
 * Brings one Lift session in line with `want` (see liftFollowChange). Returns what it did.
 * @param {any} sql  a tagged template that resolves to rows
 * @param {PushChanges} pushChanges
 * @param {string | null | undefined} sessionId
 * @param {{ day?: string, remove?: boolean, restore?: boolean }} want
 */
export async function followLiftSession(sql, pushChanges, sessionId, want, now = new Date()) {
  if (!isUuid(sessionId)) return { skip: 'no session' };
  const [row] = await sql`
    SELECT payload, updated_at, deleted_at FROM lift_rows WHERE entity = 'session' AND id = ${sessionId}::uuid`;
  const [logged] = await sql`
    SELECT count(*)::int AS n FROM lift_rows st
    WHERE st.entity = 'set' AND st.deleted_at IS NULL AND coalesce(st.payload->>'status', 'planned') <> 'planned'
      AND lower(st.payload->>'sessionExerciseID') IN (
        SELECT lower(e.id::text) FROM lift_rows e
        WHERE e.entity = 'sessionExercise' AND e.deleted_at IS NULL AND lower(e.payload->>'sessionID') = lower(${sessionId}))`;
  const result = liftFollowChange(
    row ? { payload: row.payload, updatedAt: toDate(row.updated_at), deletedAt: toDate(row.deleted_at) } : null,
    want,
    { logged: Number(logged?.n ?? 0) > 0, now }
  );
  if ('skip' in result) return result;
  const { entity, op, payload } = result.change;
  const pushed = await pushChanges([{ idempotencyKey: crypto.randomUUID(), entity, op, rowId: String(payload.id), payload }]);
  if (pushed.rejected.length) return { skip: `refused: ${pushed.rejected[0].reason}` };
  return { done: op === 'delete' ? 'removed' : want.day };
}

/**
 * Brings the Lift session of one plan workout in line with the workout as stored: skipped → removed, else on its day.
 * @param {any} sql
 * @param {PushChanges} pushChanges
 * @param {string} activityId  training_plan_activities.id
 * @param {{ restore?: boolean }} [opts]  restore: the workout was un-skipped or put back, so a removed session returns
 */
export async function followWorkout(sql, pushChanges, activityId, opts = {}) {
  const [a] = await sql`SELECT lift_session_id, scheduled_date, status FROM training_plan_activities WHERE id = ${activityId}`;
  if (!a?.lift_session_id) return { skip: 'no session' };
  const want = a.status === 'skipped' ? { remove: true } : { day: toDay(a.scheduled_date) ?? undefined, restore: Boolean(opts.restore) };
  return followLiftSession(sql, pushChanges, String(a.lift_session_id), want);
}
