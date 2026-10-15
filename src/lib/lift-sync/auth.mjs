// Bearer token check for the Lift sync routes. Constant time: both sides are hashed to equal-length digests
// before `timingSafeEqual`, so neither the content nor the length of the secret leaks through timing.

import { createHash, timingSafeEqual } from 'node:crypto';

/** @param {string} value */
function digest(value) {
  return createHash('sha256').update(value, 'utf8').digest();
}

/**
 * True when `authorization` is exactly `Bearer <expectedToken>`. An unset or empty expected token rejects
 * every request.
 * @param {string | null | undefined} authorization the request's Authorization header
 * @param {string | null | undefined} expectedToken usually process.env.LIFT_SYNC_TOKEN
 * @returns {boolean}
 */
export function isAuthorized(authorization, expectedToken) {
  if (!expectedToken) return false;
  const match = /^Bearer (.+)$/.exec(authorization ?? '');
  const presented = match ? match[1] : '';
  const ok = timingSafeEqual(digest(presented), digest(expectedToken));
  return ok && match !== null;
}
