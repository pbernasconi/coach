/**
 * The Garmin job's state (COACH-API.md, Health → Garmin). Public to Clerk; CRON_SECRET bearer only.
 * GET returns the encrypted Garmin tokens and where the last run stopped; PUT stores what the run did.
 * Coach never sees the plaintext tokens. Errors are logged without the request body.
 */

import { handleGarminGet, handleGarminPut } from '@/lib/vitals/garmin.mjs';
import { neonGarminRepository } from '@/lib/vitals/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'no-store' };
const tokens = () => ({ cron: process.env.CRON_SECRET });

export async function GET(request: Request) {
  try {
    const result = await handleGarminGet({ authorization: request.headers.get('authorization'), tokens: tokens() }, neonGarminRepository);
    return Response.json(result.body, { status: result.status, headers });
  } catch (error) {
    console.error('Garmin state read failed:', error instanceof Error ? error.name : 'unknown error');
    return Response.json({ error: 'internal error' }, { status: 500, headers });
  }
}

export async function PUT(request: Request) {
  try {
    const result = await handleGarminPut(
      { authorization: request.headers.get('authorization'), rawBody: await request.text(), tokens: tokens() },
      neonGarminRepository
    );
    return Response.json(result.body, { status: result.status, headers });
  } catch (error) {
    console.error('Garmin state write failed:', error instanceof Error ? error.name : 'unknown error');
    return Response.json({ error: 'internal error' }, { status: 500, headers });
  }
}
