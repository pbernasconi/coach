/**
 * The scale bridge's heartbeat (devices/scale-bridge, COACH-API.md). Every 15 minutes and after each scale session
 * the bridge posts its health: firmware, uptime, Wi-Fi signal, the last session's result and log. Stored in
 * users.settings.scaleBridge for Settings and the status warnings. Same bearer token as POST /api/vitals/sync.
 */

import { sql } from '@/db';
import { clearCache } from '@/lib/data-cache';
import { isAuthorized } from '@/lib/lift-sync/auth.mjs';
import { ownerId } from '@/lib/plan/queries';
import { heartbeatFrom } from '@/lib/vitals/scale.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'no-store' };
const MAX_BODY_BYTES = 16_000;

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization');
  const lift = isAuthorized(authorization, process.env.LIFT_SYNC_TOKEN);
  const cron = isAuthorized(authorization, process.env.CRON_SECRET);
  if (!lift && !cron) return Response.json({ error: 'unauthorized' }, { status: 401, headers });
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return Response.json({ error: 'body too large' }, { status: 413, headers });
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return Response.json({ error: 'body is not JSON' }, { status: 400, headers });
    }
    const heartbeat = heartbeatFrom(body, new Date());
    if (!heartbeat) return Response.json({ error: 'body must be an object' }, { status: 400, headers });
    const owner = await ownerId();
    if (!owner) return Response.json({ error: 'no owner' }, { status: 409, headers });
    await sql`
      UPDATE users SET settings = jsonb_set(settings, '{scaleBridge}', ${JSON.stringify(heartbeat)}::jsonb)
      WHERE id = ${owner}`;
    clearCache('status');
    return Response.json({ ok: true, receivedAt: heartbeat.receivedAt }, { headers });
  } catch (error) {
    console.error('Scale bridge heartbeat failed:', error instanceof Error ? error.name : 'unknown error');
    return Response.json({ error: 'internal error' }, { status: 500, headers });
  }
}
