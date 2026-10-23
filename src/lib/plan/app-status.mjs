// @ts-check
/**
 * The bodies of the Lift app's plan writes (lift/APP-API.md, "Workout status" and "Workout Lift session"). Pure.
 */

const STATUSES = new Set(['done', 'planned', 'skipped']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `{ status: "done" | "planned" | "skipped", reason? }`: done by hand, back to planned, or skipped with why.
 * @param {unknown} body
 * @returns {{ status: 'done' | 'planned' | 'skipped', reason: string | null } | { error: string }}
 */
export function cleanPlanStatus(body) {
  const b = body && typeof body === 'object' ? /** @type {Record<string, unknown>} */ (body) : {};
  const status = typeof b.status === 'string' ? b.status : '';
  if (!STATUSES.has(status)) return { error: 'status must be done, planned or skipped' };
  const reason = status === 'skipped' && typeof b.reason === 'string' && b.reason.trim() ? b.reason.trim().slice(0, 40) : null;
  return { status: /** @type {'done' | 'planned' | 'skipped'} */ (status), reason };
}

/**
 * `{ sessionId: "<Lift session UUID>" }`: the Lift session the phone started for this workout. Lower case, as
 * lift_rows keeps it.
 * @param {unknown} body
 * @returns {{ sessionId: string } | { error: string }}
 */
export function cleanLiftLink(body) {
  const b = body && typeof body === 'object' ? /** @type {Record<string, unknown>} */ (body) : {};
  const id = typeof b.sessionId === 'string' ? b.sessionId.trim() : '';
  return UUID.test(id) ? { sessionId: id.toLowerCase() } : { error: 'sessionId must be a UUID' };
}
