/** GET /api/auth/strava/callback: Strava's OAuth redirect. Checks the state cookie, stores the tokens. */

import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { ownerForSignedInUser } from '@/lib/owner';
import { exchangeCode, saveConnection, STATE_COOKIE } from '@/lib/strava-sync/oauth';

export const dynamic = 'force-dynamic';

const back = (request: NextRequest, query: string) => {
  const res = NextResponse.redirect(new URL(`/settings?${query}`, request.url));
  res.cookies.delete({ name: STATE_COOKIE, path: '/api/auth/strava' });
  return res;
};
const fail = (request: NextRequest, text: string) => back(request, `error=${encodeURIComponent(text)}`);

function sameState(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function GET(request: NextRequest) {
  const userId = await ownerForSignedInUser();
  if (!userId) return NextResponse.redirect(new URL('/sign-in', request.url));
  const q = request.nextUrl.searchParams;
  if (q.get('error')) return fail(request, 'Strava authorization was denied');
  if (!sameState(q.get('state'), request.cookies.get(STATE_COOKIE)?.value)) return fail(request, 'The Strava login expired or did not start here. Try again.');
  const code = q.get('code');
  if (!code) return fail(request, 'No authorization code received');
  try {
    const tokens = await exchangeCode(code);
    await saveConnection(userId, tokens, tokens.scope || q.get('scope') || 'read,activity:read_all');
    return back(request, 'success=strava_connected');
  } catch (error) {
    console.error('Strava OAuth callback failed:', error instanceof Error ? error.message : 'unknown error');
    return fail(request, 'Failed to connect Strava account');
  }
}
