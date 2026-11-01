/**
 * A photo or file on a Coach message, for the web panel, as GET /api/app/coach/files/{id}: the bytes with their type.
 *
 *   GET /api/coach/files/{id}
 */

import { readCoachFile } from '@/lib/coach-chat/files-store';
import { contentDisposition } from '@/lib/coach-chat/files.mjs';
import { COACH_ID, webOwner } from '@/lib/coach-chat/web-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await webOwner(request);
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  if (!COACH_ID.test(id)) return Response.json({ error: 'not found' }, { status: 404 });
  const file = await readCoachFile(ctx.userId, id);
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
