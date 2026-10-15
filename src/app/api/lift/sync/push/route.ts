/**
 * Lift sync push (lift/SYNC.md). Public to Clerk; authenticated by the LIFT_SYNC_TOKEN bearer token.
 */

import { handlePush } from '@/lib/lift-sync/sync.mjs';
import { drizzleLiftRepository } from '@/lib/lift-sync/drizzle-repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const result = await handlePush(
      {
        authorization: request.headers.get('authorization'),
        rawBody: await request.text(),
        token: process.env.LIFT_SYNC_TOKEN,
      },
      drizzleLiftRepository
    );
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    console.error('Lift sync push failed:', error);
    return Response.json({ error: 'internal error' }, { status: 500 });
  }
}
