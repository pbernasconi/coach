/** GET /api/auth/strava/start: sets a random OAuth state cookie and sends the browser to Strava's consent page. */

import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { ownerForSignedInUser } from '@/lib/owner';
import { authorizeUrl, STATE_COOKIE, stravaConfigured } from '@/lib/strava-sync/oauth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!(await ownerForSignedInUser())) return NextResponse.redirect(new URL('/sign-in', request.url));
  if (!stravaConfigured()) return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent('Strava is not set up')}`, request.url));
  const state = randomBytes(24).toString('base64url');
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/auth/strava', maxAge: 600 });
  return res;
}
