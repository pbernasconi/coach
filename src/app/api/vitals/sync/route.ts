/**
 * Vitals sync (COACH-API.md, Health). Public to Clerk. Authenticated by a bearer token: LIFT_SYNC_TOKEN (the Lift
 * app, Apple Health) or CRON_SECRET (the Garmin job in GitHub Actions). Both write to the owner's data.
 * POST stores daily values; GET says the newest stored day of each metric.
 * Errors are logged without the request body: it is health data.
 */

import { handleVitalsLatest, handleVitalsPush } from '@/lib/vitals/sync.mjs';
import { neonVitalsRepository } from '@/lib/vitals/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'no-store' };
const tokens = () => ({ lift: process.env.LIFT_SYNC_TOKEN, cron: process.env.CRON_SECRET });

export async function POST(request: Request) {
  try {
    const result = await handleVitalsPush(
      { authorization: request.headers.get('authorization'), rawBody: await request.text(), tokens: tokens() },
      neonVitalsRepository
    );
    return Response.json(result.body, { status: result.status, headers });
  } catch (error) {
    console.error('Vitals sync push failed:', error instanceof Error ? error.name : 'unknown error');
    return Response.json({ error: 'internal error' }, { status: 500, headers });
  }
}

export async function GET(request: Request) {
  try {
    const result = await handleVitalsLatest(
      { authorization: request.headers.get('authorization'), since: new URL(request.url).searchParams.get('since'), tokens: tokens() },
      neonVitalsRepository
    );
    return Response.json(result.body, { status: result.status, headers });
  } catch (error) {
    console.error('Vitals sync latest failed:', error instanceof Error ? error.name : 'unknown error');
    return Response.json({ error: 'internal error' }, { status: 500, headers });
  }
}
