/**
 * GET /api/app/coach/files/{id}: a photo or file on a Coach message, as uploaded (lift/APP-API.md, "Coach
 * attachments"). The phone shows it in the conversation. Bearer LIFT_SYNC_TOKEN.
 */

import { isAuthorized } from '@/lib/lift-sync/auth.mjs';
import { ownerId } from '@/lib/plan/queries';
import { readCoachFile } from '@/lib/coach-chat/files-store';
import { contentDisposition } from '@/lib/coach-chat/files.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.LIFT_SYNC_TOKEN)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const userId = await ownerId();
  if (!userId) return Response.json({ error: 'no user' }, { status: 404 });
  const file = await readCoachFile(userId, (await params).id);
  if (!file) return Response.json({ error: 'not found' }, { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      'Content-Type': file.contentType,
      'Content-Length': String(file.data.byteLength),
      'Content-Disposition': contentDisposition(file.name),
      'Cache-Control': 'private, max-age=86400, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
