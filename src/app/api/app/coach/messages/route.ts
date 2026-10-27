/**
 * A message to Coach from the Coach tab (lift/APP-API.md, "Coach"). Answers once Claude is done (5–30 s) with Paolo's
 * stored message and Coach's reply, which can carry a card of plan changes. Nothing in the plan changes here: the
 * card's Apply does that. Bearer LIFT_SYNC_TOKEN.
 *
 * The answer finishes and is stored even when the phone leaves mid-wait (the app went to the background): `after()`
 * keeps the function alive for it, and a `coach.replied` push carries the reply. GET /api/app/coach shows
 * `answering: true` until then.
 *
 *   POST /api/app/coach/messages?tz=…  { text }
 */

import { after } from 'next/server';
import { appWrite } from '@/lib/app-api/route';
import { MAX_TEXT, sendMessage } from '@/lib/coach-chat/server';
import { notifyCoachReply } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: Request) {
  return appWrite(request, 'coach message', async ({ userId, today, timeZone }, body) => {
    const raw = body && typeof body === 'object' ? (body as Record<string, unknown>).text : null;
    const text = typeof raw === 'string' ? raw.trim() : '';
    if (!text) return { status: 400, body: { error: 'text is empty' } };
    if (text.length > MAX_TEXT) return { status: 400, body: { error: `text is over ${MAX_TEXT} characters` } };
    const work = sendMessage(userId, text, today, timeZone);
    // Runs even if the phone hung up, so the reply is stored and pushed.
    after(async () => {
      const done = await work.catch(() => null);
      if (done) await notifyCoachReply(userId, done.threadId, done.reply);
    });
    return { status: 200, body: await work };
  });
}
