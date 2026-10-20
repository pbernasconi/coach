// Push and pull orchestration for Lift sync (lift/SYNC.md), written against a small repository interface so
// it runs the same against Postgres (drizzle-repository.ts) and the in-memory fake (memory-repository.mjs).
// The `handle*` functions are transport-agnostic: the route handlers pass in the header, body/query and the
// configured token, and send back `{ status, body }` as JSON.

import { MAX_PUSH_BODY_BYTES, parsePullLimit, parsePushEnvelope, validateChange } from './contract.mjs';
import { decodeCursor, encodeCursor } from './cursor.mjs';
import { isAuthorized } from './auth.mjs';

/** @typedef {import('./contract.mjs').ValidChange} ValidChange */
/** @typedef {import('./contract.mjs').LiftEntity} LiftEntity */

/**
 * 'applied': the row was written. 'stale': recorded, but older than (or as old as) the stored row.
 * 'duplicate': the idempotency key was already applied; nothing happened.
 * @typedef {'applied' | 'stale' | 'duplicate'} ApplyOutcome
 */

/**
 * @typedef {object} PulledRow
 * @property {number} seq
 * @property {LiftEntity} entity
 * @property {string} id
 * @property {Record<string, unknown>} payload
 */

/**
 * @typedef {object} LiftRepository
 * @property {(change: ValidChange) => Promise<ApplyOutcome>} applyChange Atomically: record the idempotency
 *   key (or report 'duplicate' if present), then upsert the row if it is newer, giving it a fresh seq.
 * @property {(afterSeq: number, limit: number) => Promise<PulledRow[]>} listSince Rows with seq > afterSeq,
 *   ascending, at most `limit`.
 */

/**
 * @typedef {object} PushResponse
 * @property {string[]} accepted
 * @property {{ idempotencyKey: string, reason: string }[]} rejected
 */

/**
 * Applies the changes in order. Invalid changes are rejected with a reason; everything else is accepted
 * (applied, stale or duplicate). Repository errors propagate so the route answers 5xx and the iPhone keeps
 * its outbox; changes applied before the error are safe to resend thanks to the idempotency keys.
 * @param {LiftRepository} repo
 * @param {Record<string, unknown>[]} rawChanges
 * @param {{ applied?: ValidChange[] }} [opts]  applied: gets each change that was written (not stale, not a duplicate)
 * @returns {Promise<PushResponse>}
 */
export async function push(repo, rawChanges, opts = {}) {
  /** @type {PushResponse} */
  const response = { accepted: [], rejected: [] };
  for (const raw of rawChanges) {
    const result = validateChange(raw);
    if (!result.ok) {
      response.rejected.push({ idempotencyKey: String(raw.idempotencyKey), reason: result.reason });
      continue;
    }
    const outcome = await repo.applyChange(result.change);
    if (outcome === 'applied') opts.applied?.push(result.change);
    // Echo the key as the client sent it, so it can match its outbox entry.
    response.accepted.push(String(raw.idempotencyKey));
  }
  return response;
}

/**
 * @param {LiftRepository} repo
 * @param {number} afterSeq
 * @param {number} limit
 * @returns {Promise<{ changes: { entity: LiftEntity, rowId: string, payload: Record<string, unknown> }[], cursor: string, hasMore: boolean }>}
 */
export async function pull(repo, afterSeq, limit) {
  const rows = await repo.listSince(afterSeq, limit + 1);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.length ? page[page.length - 1].seq : afterSeq;
  return {
    changes: page.map((row) => ({ entity: row.entity, rowId: row.id, payload: row.payload })),
    cursor: encodeCursor(last),
    hasMore,
  };
}

/**
 * @typedef {{ status: number, body: unknown }} HandlerResult
 */

const UNAUTHORIZED = Object.freeze({ status: 401, body: { error: 'unauthorized' } });

/**
 * POST /api/lift/sync/push
 * @param {{ authorization: string | null, rawBody: string, token: string | undefined }} request
 * @param {LiftRepository} repo
 * @param {{ applied?: ValidChange[] }} [opts]  see push
 * @returns {Promise<HandlerResult>}
 */
export async function handlePush(request, repo, opts = {}) {
  if (!isAuthorized(request.authorization, request.token)) return UNAUTHORIZED;
  if (new TextEncoder().encode(request.rawBody).length > MAX_PUSH_BODY_BYTES) {
    return { status: 400, body: { error: 'body too large' } };
  }
  let body;
  try {
    body = JSON.parse(request.rawBody);
  } catch {
    return { status: 400, body: { error: 'body is not JSON' } };
  }
  const envelope = parsePushEnvelope(body);
  if (!envelope.ok) return { status: 400, body: { error: envelope.error } };
  return { status: 200, body: await push(repo, envelope.changes, opts) };
}

/**
 * GET /api/lift/sync/pull?cursor=&limit=
 * @param {{ authorization: string | null, cursor: string | null, limit: string | null, token: string | undefined }} request
 * @param {LiftRepository} repo
 * @returns {Promise<HandlerResult>}
 */
export async function handlePull(request, repo) {
  if (!isAuthorized(request.authorization, request.token)) return UNAUTHORIZED;
  const afterSeq = decodeCursor(request.cursor);
  if (afterSeq === null) return { status: 400, body: { error: 'invalid cursor' } };
  const limit = parsePullLimit(request.limit);
  if (limit === null) return { status: 400, body: { error: 'limit must be an integer from 1 to 500' } };
  return { status: 200, body: await pull(repo, afterSeq, limit) };
}
