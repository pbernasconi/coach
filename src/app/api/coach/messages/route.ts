/**
 * A message to Coach from the web Coach panel. Always streams (Server-Sent Events, lift/APP-API.md "Coach answer
 * stream"): `message`, `status`, `thinking`, `text`, then `done` or `error`. The answer is finished and stored even if
 * the page closes. No push: the reply shows in the panel.
 *
 *   POST /api/coach/messages?tz=…  { text, files?: [id] }
 */

import { coachAnswerStream, jsonBody, messageOf } from '@/lib/coach-chat/stream';
import { webOwner } from '@/lib/coach-chat/web-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: Request) {
  const ctx = await webOwner(request);
  if (ctx instanceof Response) return ctx;
  const read = await jsonBody(request);
  if ('response' in read) return read.response;
  const message = messageOf(read.body);
  if ('error' in message) return Response.json({ error: message.error }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  return coachAnswerStream(ctx.userId, message, ctx.timeZone, { push: false });
}
