import { isAuthorized } from '@/lib/lift-sync/auth.mjs';
import { ownerId } from '@/lib/plan/queries';
import { zoneOrDefault } from '@/lib/plan/week-api.mjs';
import { todayIn } from '@/lib/plan/week.mjs';

// The shared part of every /api/app route (lift/APP-API.md, "Shared rules"): the LIFT_SYNC_TOKEN bearer token, the
// owner, `tz` and today, `Cache-Control: no-store`, and the errors 400/401/404/500.

const NO_STORE = { 'Cache-Control': 'no-store' };

export type AppContext = { userId: string; timeZone: string; today: string; params: URLSearchParams };

/**
 * Runs `run` for an authorized request and returns its body as JSON. `run` returns null for a 404 ("not found").
 * `invalid`: the error text of a malformed path parameter, a 400 after the token check.
 */
export async function appRoute(
  request: Request,
  label: string,
  run: (ctx: AppContext) => Promise<object | null>,
  invalid: string | null = null
) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.LIFT_SYNC_TOKEN)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
  }
  if (invalid) return Response.json({ error: invalid }, { status: 400, headers: NO_STORE });
  try {
    const params = new URL(request.url).searchParams;
    const timeZone = zoneOrDefault(params.get('tz'));
    const userId = await ownerId();
    if (!userId) return Response.json({ error: 'no user' }, { status: 404, headers: NO_STORE });
    const body = await run({ userId, timeZone, today: todayIn(timeZone), params });
    if (!body) return Response.json({ error: 'not found' }, { status: 404, headers: NO_STORE });
    return Response.json(body, { headers: NO_STORE });
  } catch (error) {
    console.error(`App ${label} failed:`, error);
    return Response.json({ error: 'internal error' }, { status: 500, headers: NO_STORE });
  }
}
