/**
 * A photo or file for the next message, from the web Coach panel, as POST /api/app/coach/files (lift/APP-API.md,
 * "Coach attachments"): the file itself is the body, with `Content-Type`, `X-File-Name` (percent-encoded) and, for a
 * photo, `X-Image-Width` and `X-Image-Height`. At most 4 MB.
 *
 *   POST /api/coach/files → 201 { file }
 */

import { MAX_FILE_BYTES } from '@/lib/coach-chat/files.mjs';
import { uploadFile } from '@/lib/coach-chat/files-store';
import { webOwner } from '@/lib/coach-chat/web-route';

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
  const ctx = await webOwner(request);
  if (ctx instanceof Response) return ctx;
  if (Number(request.headers.get('content-length') ?? 0) > MAX_FILE_BYTES) {
    return Response.json({ error: 'the file is over 4 MB' }, { status: 413, headers: NO_STORE });
  }
  try {
    const bytes = new Uint8Array(await request.arrayBuffer());
    const h = request.headers;
    const result = await uploadFile(ctx.userId, bytes, {
      contentType: h.get('content-type') ?? '',
      name: decodedName(h.get('x-file-name')),
      width: h.get('x-image-width'),
      height: h.get('x-image-height'),
    });
    return Response.json(result.body, { status: result.status, headers: NO_STORE });
  } catch (error) {
    console.error('Web coach file upload failed:', error instanceof Error ? error.message : 'unknown error');
    return Response.json({ error: 'internal error' }, { status: 500, headers: NO_STORE });
  }
}
