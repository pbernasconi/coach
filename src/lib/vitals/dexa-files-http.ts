/** The HTTP answer for one DEXA file, shared by the owner's route and the CRON_SECRET route. */

import { readFile } from './dexa-store';

export async function fileResponse(userId: string, id: string, request: Request): Promise<Response> {
  const file = id.length <= 64 ? await readFile(userId, id) : null;
  if (!file) return Response.json({ error: 'not found' }, { status: 404 });
  const download = new URL(request.url).searchParams.has('download');
  const name = file.name.replace(/["\\\r\n]/g, '');
  return new Response(new Uint8Array(file.data), {
    headers: {
      'Content-Type': file.contentType,
      'Content-Length': String(file.data.byteLength),
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${name}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'Cache-Control': 'private, max-age=86400, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
