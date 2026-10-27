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
 *   POST /api/app/coach/messages?tz=…  { text }
 */

import { after } from 'next/server';
import { appWrite } from '@/lib/app-api/route';
import { isAuthorized } from '@/lib/lift-sync/auth.mjs';
import { ownerId } from '@/lib/plan/queries';
import { zoneOrDefault } from '@/lib/plan/week-api.mjs';
import { todayIn } from '@/lib/plan/week.mjs';
import { MAX_TEXT, sendMessage, type CoachEvent } from '@/lib/coach-chat/server';
import { notifyCoachReply } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const NO_STORE = { 'Cache-Control': 'no-store' };

function textOf(body: unknown): { text: string } | { error: string } {
  const raw = body && typeof body === 'object' ? (body as Record<string, unknown>).text : null;
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return { error: 'text is empty' };
  if (text.length > MAX_TEXT) return { error: `text is over ${MAX_TEXT} characters` };
  return { text };
}

export async function POST(request: Request) {
  if ((request.headers.get('accept') ?? '').includes('text/event-stream')) return stream(request);
  return appWrite(request, 'coach message', async ({ userId, today, timeZone }, body) => {
    const t = textOf(body);
    if ('error' in t) return { status: 400, body: { error: t.error } };
    const work = sendMessage(userId, t.text, today, timeZone);
    // Runs even if the phone hung up, so the reply is stored and pushed.
    after(async () => {
      const done = await work.catch(() => null);
      if (done) await notifyCoachReply(userId, done.threadId, done.reply);
    });
    return { status: 200, body: await work };
  });
}

/** The streaming answer: Server-Sent Events, one JSON object per event. */
async function stream(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.LIFT_SYNC_TOKEN)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
  }
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 16 * 1024) return Response.json({ error: 'body too large' }, { status: 413, headers: NO_STORE });
    body = raw ? JSON.parse(raw) : undefined;
  } catch {
    return Response.json({ error: 'body is not JSON' }, { status: 400, headers: NO_STORE });
  }
  const t = textOf(body);
  if ('error' in t) return Response.json({ error: t.error }, { status: 400, headers: NO_STORE });
  const userId = await ownerId();
  if (!userId) return Response.json({ error: 'no user' }, { status: 404, headers: NO_STORE });
  const timeZone = zoneOrDefault(new URL(request.url).searchParams.get('tz'));

  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let open = true;
  const send = (event: string, data: object) => {
    if (!open || !controller) return;
    try {
      controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    } catch {
      open = false;  // the phone hung up; the answer goes on
    }
  };
  const close = () => {
    if (!open) return;
    open = false;
    try { controller?.close(); } catch { /* already closed */ }
  };
  const body$ = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
      // Padding and a first comment so proxies start passing the stream on at once.
      c.enqueue(encoder.encode(`: ${' '.repeat(2048)}\n\n`));
    },
    cancel() { open = false; },
  });

  const onEvent = (e: CoachEvent) => send(e.type, e);
  const work = sendMessage(userId, t.text, todayIn(timeZone), timeZone, onEvent);
  // The stream ends when the answer is stored (not in `after()`, which waits for the response to finish). `after()`
  // only keeps the function alive for the push when the phone already left.
  const finished = work
    .catch((error: unknown) => {
      console.error('Coach stream failed:', error instanceof Error ? error.message : 'unknown error');
      return null;
    })
    .then(async (done) => {
      if (done) send('done', done);
      else send('error', { error: 'Coach could not answer. Try again.' });
      close();
      if (done) await notifyCoachReply(userId, done.threadId, done.reply);
    });
  after(() => finished);

  return new Response(body$, {
    headers: {
      ...NO_STORE,
      'Cache-Control': 'no-cache, no-transform',
      'Content-Type': 'text/event-stream; charset=utf-8',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  });
}
