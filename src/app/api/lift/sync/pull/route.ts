/**
 * Lift sync pull (lift/SYNC.md). Public to Clerk; authenticated by the LIFT_SYNC_TOKEN bearer token.
 */

import { handlePull } from '@/lib/lift-sync/sync.mjs';
import { drizzleLiftRepository } from '@/lib/lift-sync/drizzle-repository';
import { withTiming } from '@/lib/request-timing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const { result, serverTiming } = await withTiming('GET lift sync pull', () => handlePull(
      {
        authorization: request.headers.get('authorization'),
        cursor: params.get('cursor'),
        limit: params.get('limit'),
        token: process.env.LIFT_SYNC_TOKEN,
      },
      drizzleLiftRepository
    ));
    return Response.json(result.body, { status: result.status, headers: { 'Server-Timing': serverTiming } });
  } catch (error) {
    console.error('Lift sync pull failed:', error);
    return Response.json({ error: 'internal error' }, { status: 500 });
  }
}
