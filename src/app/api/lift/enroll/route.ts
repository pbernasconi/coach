/**
 * Lift enrollment: POST { "code": "…" } with a one-time code from a lift://sync link (Coach Settings → Lift).
 * A valid code is used up and the answer is { "token": LIFT_SYNC_TOKEN }; anything else is 400 or 401.
 * No Clerk: the code is the credential. The code has 192 random bits, so it cannot be guessed.
 */

import { sql } from '@/db';
import { redeemEnrollmentCode } from '@/lib/lift-sync/enroll.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let code: unknown;
  try {
    code = ((await request.json()) as { code?: unknown }).code;
  } catch {
    return Response.json({ error: 'bad json' }, { status: 400 });
  }
  const token = process.env.LIFT_SYNC_TOKEN;
  if (!token) return Response.json({ error: 'sync is not set up' }, { status: 503 });
  if (!(await redeemEnrollmentCode(sql, code))) {
    return Response.json({ error: 'invalid or expired code' }, { status: 401 });
  }
  return Response.json({ token }, { headers: { 'Cache-Control': 'no-store' } });
}
