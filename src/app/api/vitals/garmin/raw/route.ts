/**
 * The Garmin raw archive (COACH-API.md, Health → Garmin). Public to Clerk; CRON_SECRET bearer only.
 * POST stores Garmin Connect responses in garmin_raw. Errors are logged without the body: it is health data.
 */

import { handleGarminRawPush } from '@/lib/vitals/garmin.mjs';
import { neonGarminRawRepository } from '@/lib/vitals/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  try {
    const result = await handleGarminRawPush(
      { authorization: request.headers.get('authorization'), rawBody: await request.text(), tokens: { cron: process.env.CRON_SECRET } },
      neonGarminRawRepository
    );
    return Response.json(result.body, { status: result.status, headers });
  } catch (error) {
    console.error('Garmin raw archive failed:', error instanceof Error ? error.name : 'unknown error');
    return Response.json({ error: 'internal error' }, { status: 500, headers });
  }
}
