// One-time enrollment codes for connecting the Lift app (lift://sync?code=…). The link and its QR code carry a
// short-lived, single-use code, never the sync token: any app can claim a custom URL scheme, so whatever the link
// carries can leak. Lift trades the code for the token over HTTPS (POST /api/lift/enroll). Only a SHA-256 of each
// code is stored.

import { createHash, randomBytes } from 'node:crypto';

export const CODE_TTL_MINUTES = 15;

const hash = (code) => createHash('sha256').update(code, 'utf8').digest('hex');

/**
 * Makes a new code, valid for CODE_TTL_MINUTES, and deletes expired or used ones.
 * @param {import('@neondatabase/serverless').NeonQueryFunction<false, false>} sql
 * @returns {Promise<{ code: string, expiresAt: Date }>}
 */
export async function createEnrollmentCode(sql, now = new Date()) {
  const code = randomBytes(24).toString('base64url');
  const expiresAt = new Date(now.getTime() + CODE_TTL_MINUTES * 60_000);
  await sql`DELETE FROM lift_enrollments WHERE expires_at < ${now} OR used_at IS NOT NULL`;
  await sql`INSERT INTO lift_enrollments (code_hash, expires_at) VALUES (${hash(code)}, ${expiresAt})`;
  return { code, expiresAt };
}

/**
 * Uses up `code` and returns true when it was valid: known, unused and unexpired. One atomic UPDATE, so a code
 * works once even when two requests race.
 */
export async function redeemEnrollmentCode(sql, code, now = new Date()) {
  if (typeof code !== 'string' || code.length < 16 || code.length > 128) return false;
  const rows = await sql`
    UPDATE lift_enrollments SET used_at = ${now}
    WHERE code_hash = ${hash(code)} AND used_at IS NULL AND expires_at > ${now}
    RETURNING code_hash`;
  return rows.length === 1;
}
