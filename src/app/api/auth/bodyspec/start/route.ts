/** GET /api/auth/bodyspec/start: sends the browser to BodySpec's sign-in, with a state and PKCE cookie for the callback. */

import { NextResponse, type NextRequest } from 'next/server';
import { ownerForSignedInUser } from '@/lib/owner';
import { CALLBACK_PATH, OAUTH_COOKIE, startAuthorization } from '@/lib/vitals/bodyspec-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const userId = await ownerForSignedInUser();
  if (!userId) return NextResponse.redirect(new URL('/sign-in', request.url));
  try {
    const { url, cookie } = await startAuthorization(userId, request.nextUrl.origin);
    const res = NextResponse.redirect(url);
    res.cookies.set(OAUTH_COOKIE, cookie, { httpOnly: true, secure: true, sameSite: 'lax', path: CALLBACK_PATH, maxAge: 600 });
    return res;
  } catch (error) {
    console.error('BodySpec connect failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent('Could not reach BodySpec. Try again.')}#connections`, request.url));
  }
}
