/**
 * A message to Coach from the Coach tab (lift/APP-API.md, "Coach"). Stores Paolo's message and Coach's reply, which
 * can carry a card of plan changes. Nothing in the plan changes here: the card's Apply does that. Bearer
 * LIFT_SYNC_TOKEN.
 *
 * Two ways to answer, chosen by the Accept header:
 * - `text/event-stream`: the answer streams as it is made (lift/APP-API.md, "Coach answer stream"): `message` (the
 *   stored message), `status` (reading, thinking, writing, proposing, card, fixing), `thinking` (a summary of
 *   Claude's thinking, in pieces), `text` (the reply's words, in pieces), then `done` with the same body as the JSON
 *   answer, or `error`. The first event comes within a second; words follow a few seconds later.
 * - anything else: one JSON answer once Claude is done (5–30 s), as older app builds expect.
 *
 * The answer finishes and is stored even when the phone leaves mid-wait (the app went to the background): `after()`
 * keeps the function alive for it, and a `coach.replied` push carries the reply. GET /api/app/coach shows
 * `answering: true` until then.
 *
 * `files` names photos and files uploaded first (POST /api/app/coach/files); Claude sees them with the text, which can
 * then be empty.
 *
 *   POST /api/app/coach/messages?tz=…  { text, files?: [id] }
 */

import { after } from 'next/server';
import { appWrite } from '@/lib/app-api/route';
import { isAuthorized } from '@/lib/lift-sync/auth.mjs';
import { ownerId } from '@/lib/plan/queries';
import { zoneOrDefault } from '@/lib/plan/week-api.mjs';
import { sendMessage } from '@/lib/coach-chat/server';
import { coachAnswerStream, jsonBody, messageOf } from '@/lib/coach-chat/stream';
import { notifyCoachReply } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  if ((request.headers.get('accept') ?? '').includes('text/event-stream')) return stream(request);
  return appWrite(request, 'coach message', async ({ userId, today, timeZone }, body) => {
    const t = messageOf(body);
    if ('error' in t) return { status: 400, body: { error: t.error } };
    const work = sendMessage(userId, t.text, today, timeZone, undefined, t.files);
    // Runs even if the phone hung up, so the reply is stored and pushed.
    after(async () => {
      const done = await work.catch(() => null);
      if (done) await notifyCoachReply(userId, done.threadId, done.reply);
    });
    return { status: 200, body: await work };
  });
}

/** The streaming answer: Server-Sent Events, one JSON object per event (src/lib/coach-chat/stream.ts). */
async function stream(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.LIFT_SYNC_TOKEN)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
  }
  const read = await jsonBody(request);
  if ('response' in read) return read.response;
  const t = messageOf(read.body);
  if ('error' in t) return Response.json({ error: t.error }, { status: 400, headers: NO_STORE });
  const userId = await ownerId();
  if (!userId) return Response.json({ error: 'no user' }, { status: 404, headers: NO_STORE });
  return coachAnswerStream(userId, t, zoneOrDefault(new URL(request.url).searchParams.get('tz')));
}
