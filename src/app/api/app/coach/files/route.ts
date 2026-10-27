/**
 * A photo or file for a Coach message (lift/APP-API.md, "Coach attachments"). The phone uploads each one here first,
 * then names the ids in POST /api/app/coach/messages. The body is the file itself (not JSON), at most 4 MB; the phone
 * shrinks a photo to about 1 MB first. Bearer LIFT_SYNC_TOKEN.
 *
 *   POST /api/app/coach/files   Content-Type: image/jpeg | image/png | image/gif | image/webp | application/pdf | text/*
 *     X-File-Name: <name, percent-encoded>   X-Image-Width / X-Image-Height: <pixels, for a photo>
 *   → 201 { file: { id, kind, name, contentType, sizeBytes, width, height } }
 */

import { isAuthorized } from '@/lib/lift-sync/auth.mjs';
import { ownerId } from '@/lib/plan/queries';
import { MAX_FILE_BYTES } from '@/lib/coach-chat/files.mjs';
import { uploadFile } from '@/lib/coach-chat/files-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

function decodedName(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.LIFT_SYNC_TOKEN)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
  }
  if (Number(request.headers.get('content-length') ?? 0) > MAX_FILE_BYTES) {
    return Response.json({ error: 'the file is over 4 MB' }, { status: 413, headers: NO_STORE });
  }
  try {
    const userId = await ownerId();
    if (!userId) return Response.json({ error: 'no user' }, { status: 404, headers: NO_STORE });
    const bytes = new Uint8Array(await request.arrayBuffer());
    const h = request.headers;
    const result = await uploadFile(userId, bytes, {
      contentType: h.get('content-type') ?? '',
      name: decodedName(h.get('x-file-name')),
      width: h.get('x-image-width'),
      height: h.get('x-image-height'),
    });
    return Response.json(result.body, { status: result.status, headers: NO_STORE });
  } catch (error) {
    console.error('Coach file upload failed:', error instanceof Error ? error.message : 'unknown error');
    return Response.json({ error: 'internal error' }, { status: 500, headers: NO_STORE });
  }
}
