// The Strava connection and a valid access token (refreshed and saved when it expires within 5 minutes).

/** The single Strava connection and a valid access token. It refreshes and saves the token when it expires in 5 min. */
export async function connectionWithToken(sql, env = process.env, log = console.log) {
  const [conn] = await sql`SELECT id, athlete_id, refresh_token, access_token, expires_at, user_id, last_synced_at FROM strava_connections LIMIT 1`;
  if (!conn) throw new Error('No Strava connection in DB');

  let accessToken = conn.access_token;
  const now = Math.floor(Date.now() / 1000);
  if (conn.expires_at <= now + 300) {
    if (!env.STRAVA_CLIENT_ID || !env.STRAVA_CLIENT_SECRET) throw new Error('STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET are not set');
    log('Refreshing access token…');
    const res = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.STRAVA_CLIENT_ID,
        client_secret: env.STRAVA_CLIENT_SECRET,
        refresh_token: conn.refresh_token,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status} ${await res.text()}`);
    const tok = await res.json();
    accessToken = tok.access_token;
    await sql`
      UPDATE strava_connections
         SET access_token = ${tok.access_token},
             refresh_token = ${tok.refresh_token},
             expires_at = ${tok.expires_at},
             updated_at = NOW()
       WHERE id = ${conn.id}`;
    log(`Token refreshed; expires ${new Date(tok.expires_at * 1000).toISOString()}`);
  }
  return { conn, accessToken };
}
