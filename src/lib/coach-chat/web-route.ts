/**
 * The shared part of the web's Coach chat routes (/api/coach/…): the same handlers as the iPhone's /api/app/coach/…
 * (lift/APP-API.md, "Coach"), for the signed-in owner (a Clerk session, src/lib/owner.ts) instead of the
 * LIFT_SYNC_TOKEN bearer. `tz` and today as in the app routes; `Cache-Control: no-store`; 400/401/413/500.
 */

import { ownerForSignedInUser } from '@/lib/owner';
import { zoneOrDefault } from '@/lib/plan/week-api.mjs';
import { todayIn } from '@/lib/plan/week.mjs';
import { jsonBody } from './stream';

const NO_STORE = { 'Cache-Control': 'no-store' };

export type WebContext = { userId: string; timeZone: string; today: string };

/** The id in a Coach path (a cuid2). */
export const COACH_ID = /^[a-z0-9]{1,40}$/;

/** The signed-in owner and their time zone, or the 401 to answer. */
export async function webOwner(request: Request): Promise<WebContext | Response> {
  const userId = await ownerForSignedInUser();
  if (!userId) return Response.json({ error: 'Not signed in' }, { status: 401, headers: NO_STORE });
  const timeZone = zoneOrDefault(new URL(request.url).searchParams.get('tz'));
  return { userId, timeZone, today: todayIn(timeZone) };
}

/**
 * Runs `run` for the signed-in owner and answers its status and body as JSON. A body is read (JSON, up to 16 KB) for
 * any method but GET.
 */
export async function coachWebRoute(
  request: Request,
  label: string,
  run: (ctx: WebContext, body: unknown) => Promise<{ status: number; body: object }>,
): Promise<Response> {
  try {
    const ctx = await webOwner(request);
    if (ctx instanceof Response) return ctx;
    let body: unknown;
    if (request.method !== 'GET') {
      const read = await jsonBody(request);
      if ('response' in read) return read.response;
      body = read.body;
    }
    const result = await run(ctx, body);
    return Response.json(result.body, { status: result.status, headers: NO_STORE });
  } catch (error) {
    console.error(`Web coach ${label} failed:`, error instanceof Error ? error.message : 'unknown error');
    return Response.json({ error: 'internal error' }, { status: 500, headers: NO_STORE });
  }
}
