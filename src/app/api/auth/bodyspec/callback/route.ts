/** GET /api/auth/bodyspec/callback: BodySpec's OAuth redirect. Checks the state, stores the tokens, pulls the scans. */

import { timingSafeEqual } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { ownerForSignedInUser } from '@/lib/owner';
import { BodyspecError, CALLBACK_PATH, finishAuthorization, OAUTH_COOKIE, readPending, syncBodyspec } from '@/lib/vitals/bodyspec-api';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const back = (request: NextRequest, query: string) => {
  const res = NextResponse.redirect(new URL(`/settings?${query}#connections`, request.url));
  res.cookies.delete({ name: OAUTH_COOKIE, path: CALLBACK_PATH });
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
  if (q.get('error')) return fail(request, 'BodySpec sign-in was cancelled');
  const pending = readPending(request.cookies.get(OAUTH_COOKIE)?.value);
  if (!pending || !sameState(q.get('state'), pending.state)) return fail(request, 'The BodySpec sign-in expired or did not start here. Try again.');
  const code = q.get('code');
  if (!code) return fail(request, 'No authorization code from BodySpec');
  try {
    await finishAuthorization(userId, pending, code);
  } catch (error) {
    console.error('BodySpec OAuth callback failed:', error instanceof Error ? error.message : 'unknown error');
    return fail(request, error instanceof BodyspecError ? error.message : 'Failed to connect BodySpec');
  }
  // Connected. Pull the scans now, so /health has them; a failure here shows in Settings and the daily sync retries.
  try {
    const r = await syncBodyspec(userId);
    revalidatePath('/', 'layout');
    return back(request, `success=bodyspec_connected&scans=${r.scans}`);
  } catch (error) {
    return fail(request, `BodySpec connected, but the first sync failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}
