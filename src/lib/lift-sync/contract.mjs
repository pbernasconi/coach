// Request validation for the Lift sync contract (lift/SYNC.md). Plain ESM with JSDoc types so that
// `node --test` can import it directly and TypeScript callers still get types. No framework imports.

import { z } from 'zod';

/** @typedef {'exercise' | 'session' | 'sessionExercise' | 'set'} LiftEntity */
/** @typedef {'insert' | 'update' | 'delete'} LiftOp */

/** @type {readonly LiftEntity[]} */
export const ENTITIES = Object.freeze(['exercise', 'session', 'sessionExercise', 'set']);
/** @type {readonly LiftOp[]} */
export const OPS = Object.freeze(['insert', 'update', 'delete']);

export const MAX_CHANGES_PER_PUSH = 500;
export const MAX_PULL_LIMIT = 500;
export const DEFAULT_PULL_LIMIT = 500;
/** Largest accepted request body, in bytes (Vercel functions cap bodies at 4.5 MB anyway). */
export const MAX_PUSH_BODY_BYTES = 4 * 1024 * 1024;
/** Largest accepted single payload, serialized, in bytes. Real rows are well under 2 KB. */
export const MAX_PAYLOAD_BYTES = 64 * 1024;

// Any 8-4-4-4-12 hex UUID, either case (Swift's `uuidString` is upper case).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** @param {unknown} value */
export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

const uuidString = z.string().regex(UUID_RE);

// ISO 8601 ("2026-10-15T07:30:00.000Z", any offset) or GRDB's "2026-10-15 07:30:00.000" (UTC, no zone),
// which is what LiftStore's OutboxPayload writes today.
const TIMESTAMP_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:?\d{2})?$/;

/**
 * Parses a payload timestamp. Returns null for anything that is not a real instant.
 * @param {unknown} value
 * @returns {Date | null}
 */
export function parseTimestamp(value) {
  if (typeof value !== 'string') return null;
  const m = TIMESTAMP_RE.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, frac, zone] = m;
  const ms = frac ? Number(frac.slice(0, 3).padEnd(3, '0')) : 0;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  const utc = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  // Reject days that roll over (2026-02-30).
  const check = new Date(utc);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null;
  }
  let offsetMinutes = 0;
  if (zone && zone !== 'Z') {
    const sign = zone[0] === '-' ? -1 : 1;
    const digits = zone.slice(1).replace(':', '');
    const oh = Number(digits.slice(0, 2));
    const om = Number(digits.slice(2, 4));
    if (oh > 23 || om > 59) return null;
    offsetMinutes = sign * (oh * 60 + om);
  }
  return new Date(utc - offsetMinutes * 60_000);
}

const pushEnvelopeSchema = z.object({
  deviceId: z.string().min(1).max(200),
  changes: z.array(z.looseObject({ idempotencyKey: uuidString })).max(MAX_CHANGES_PER_PUSH),
});

/**
 * @typedef {object} ValidChange
 * @property {string} idempotencyKey lower case
 * @property {LiftEntity} entity
 * @property {string} id lower case row id
 * @property {LiftOp} op
 * @property {Record<string, unknown>} payload verbatim, as pushed
 * @property {Date} updatedAt
 * @property {Date | null} deletedAt
 */

/**
 * @typedef {{ ok: true, change: ValidChange } | { ok: false, idempotencyKey: string, reason: string }} ChangeResult
 */

/**
 * Validates the push envelope. A malformed envelope (not an object, no deviceId, more than 500 changes, a
 * change without a UUID idempotencyKey) fails the whole request; problems inside one change only reject
 * that change (see `validateChange`).
 * @param {unknown} body
 * @returns {{ ok: true, deviceId: string, changes: Record<string, unknown>[] } | { ok: false, error: string }}
 */
export function parsePushEnvelope(body) {
  const result = pushEnvelopeSchema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path?.length ? issue.path.join('.') : 'body';
    if (issue?.path?.length === 1 && issue.path[0] === 'changes' && issue.code === 'too_big') {
      return { ok: false, error: `at most ${MAX_CHANGES_PER_PUSH} changes per request` };
    }
    return { ok: false, error: `invalid ${where}` };
  }
  return { ok: true, deviceId: result.data.deviceId, changes: result.data.changes };
}

/**
 * Validates one change of a push. Assumes `parsePushEnvelope` already checked `idempotencyKey`.
 * @param {Record<string, unknown>} raw
 * @returns {ChangeResult}
 */
export function validateChange(raw) {
  const idempotencyKey = String(raw.idempotencyKey).toLowerCase();
  /** @param {string} reason @returns {ChangeResult} */
  const reject = (reason) => ({ ok: false, idempotencyKey, reason });

  if (typeof raw.entity !== 'string' || !ENTITIES.includes(/** @type {LiftEntity} */ (raw.entity))) {
    return reject('invalid entity');
  }
  if (typeof raw.op !== 'string' || !OPS.includes(/** @type {LiftOp} */ (raw.op))) return reject('invalid op');
  if (!isUuid(raw.rowId)) return reject('invalid rowId');
  const payload = raw.payload;
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return reject('invalid payload');
  const row = /** @type {Record<string, unknown>} */ (payload);
  if (!isUuid(row.id)) return reject('payload.id missing or invalid');
  const id = String(row.id).toLowerCase();
  if (id !== String(raw.rowId).toLowerCase()) return reject('payload.id does not match rowId');
  const updatedAt = parseTimestamp(row.updatedAt);
  if (!updatedAt) return reject('payload.updatedAt missing or invalid');
  let deletedAt = null;
  if (row.deletedAt !== undefined && row.deletedAt !== null) {
    deletedAt = parseTimestamp(row.deletedAt);
    if (!deletedAt) return reject('payload.deletedAt invalid');
  }
  if (new TextEncoder().encode(JSON.stringify(row)).length > MAX_PAYLOAD_BYTES) return reject('payload too large');

  return {
    ok: true,
    change: {
      idempotencyKey,
      entity: /** @type {LiftEntity} */ (raw.entity),
      id,
      op: /** @type {LiftOp} */ (raw.op),
      payload: row,
      updatedAt,
      deletedAt,
    },
  };
}

/**
 * Parses `limit` from the pull query string. Missing means the default.
 * @param {string | null | undefined} value
 * @returns {number | null} null when invalid
 */
export function parsePullLimit(value) {
  if (value === null || value === undefined || value === '') return DEFAULT_PULL_LIMIT;
  if (!/^\d{1,4}$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 && n <= MAX_PULL_LIMIT ? n : null;
}
