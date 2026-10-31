/**
 * The streaming answer to a message to Coach, shared by the iPhone's POST /api/app/coach/messages and the web's POST
 * /api/coach/messages: Server-Sent Events, one JSON object per event (lift/APP-API.md, "Coach answer stream"). The
 * answer finishes and is stored even when the client hangs up: `after()` keeps the function alive for it, and a
 * `coach.replied` push carries the reply.
 */

import { after } from 'next/server';
import { notifyCoachReply } from '@/lib/notifications';
import { todayIn } from '@/lib/plan/week.mjs';
import { fileIds } from './files.mjs';
import { MAX_TEXT, sendMessage, type CoachEvent } from './server';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** The message's words and file ids, or what is wrong with the body. */
export function messageOf(body: unknown): { text: string; files: string[] } | { error: string } {
  const fields = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const text = typeof fields.text === 'string' ? fields.text.trim() : '';
  const files = fileIds(fields.files);
  if ('error' in files) return { error: files.error };
  if (!text && !files.ids.length) return { error: 'text is empty' };
  if (text.length > MAX_TEXT) return { error: `text is over ${MAX_TEXT} characters` };
  return { text, files: files.ids };
}

/** Reads a JSON body of at most 16 KB, or answers the error. */
export async function jsonBody(request: Request): Promise<{ body: unknown } | { response: Response }> {
  const raw = await request.text();
  if (raw.length > 16 * 1024) return { response: Response.json({ error: 'body too large' }, { status: 413, headers: NO_STORE }) };
  try {
    return { body: raw ? JSON.parse(raw) : undefined };
  } catch {
    return { response: Response.json({ error: 'body is not JSON' }, { status: 400, headers: NO_STORE }) };
  }
}

/** The SSE answer to `message` from `userId`. `push`: send the `coach.replied` push (the web, on screen, doesn't). */
export function coachAnswerStream(
  userId: string, message: { text: string; files: string[] }, timeZone: string, { push = true }: { push?: boolean } = {},
): Response {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let open = true;
  const send = (event: string, data: object) => {
    if (!open || !controller) return;
    try {
      controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    } catch {
      open = false;  // the client hung up; the answer goes on
    }
  };
  const close = () => {
    if (!open) return;
    open = false;
    try { controller?.close(); } catch { /* already closed */ }
  };
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
      // Padding and a first comment so proxies start passing the stream on at once.
      c.enqueue(encoder.encode(`: ${' '.repeat(2048)}\n\n`));
    },
    cancel() { open = false; },
  });

  const onEvent = (e: CoachEvent) => send(e.type, e);
  const work = sendMessage(userId, message.text, todayIn(timeZone), timeZone, onEvent, message.files);
  // The stream ends when the answer is stored (not in `after()`, which waits for the response to finish). `after()`
  // only keeps the function alive for the push when the client already left.
  const finished = work
    .catch((error: unknown) => {
      console.error('Coach stream failed:', error instanceof Error ? error.message : 'unknown error');
      return null;
    })
    .then(async (done) => {
      if (done) send('done', done);
      else send('error', { error: 'Coach could not answer. Try again.' });
      close();
      if (done && push) await notifyCoachReply(userId, done.threadId, done.reply);
    });
  after(() => finished);

  return new Response(body, {
    headers: {
      ...NO_STORE,
      'Cache-Control': 'no-cache, no-transform',
      'Content-Type': 'text/event-stream; charset=utf-8',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  });
}
