/**
 * Strava OAuth: the authorize URL, the code exchange, and the stored connection. The state is a random value in a
 * short-lived cookie (GET /api/auth/strava/start sets it), so a callback that this browser did not start is refused.
 */

import { sql } from '@/db';

export const STATE_COOKIE = 'strava_oauth_state';
const SCOPE = 'read,activity:read_all,activity:write,profile:read_all';

export function stravaConfigured() {
  return Boolean(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_REDIRECT_URI);
}

export function authorizeUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID ?? '',
    redirect_uri: process.env.STRAVA_REDIRECT_URI ?? '',
    response_type: 'code',
    scope: SCOPE,
    approval_prompt: 'auto',
    state,
  });
  return `https://www.strava.com/oauth/authorize?${params}`;
}

type TokenResponse = { access_token: string; refresh_token: string; expires_at: number; scope?: string; athlete: { id: number } };

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Strava code exchange failed: ${res.status}`);
  return res.json();
}

/** Stores the connection (one per user) and turns it on again after a deauthorization. */
export async function saveConnection(userId: string, t: TokenResponse, scope: string) {
  await sql`
    INSERT INTO strava_connections (id, user_id, athlete_id, access_token, refresh_token, expires_at, scope, is_active, updated_at)
    VALUES (md5(random()::text), ${userId}, ${t.athlete.id}, ${t.access_token}, ${t.refresh_token}, ${t.expires_at}, ${scope}, true, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      athlete_id = EXCLUDED.athlete_id, access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token,
      expires_at = EXCLUDED.expires_at, scope = EXCLUDED.scope, is_active = true, updated_at = NOW()`;
}
