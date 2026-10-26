/**
 * A message to Coach from the Coach tab (lift/APP-API.md, "Coach"). Answers once Claude is done (5–30 s) with Paolo's
 * stored message and Coach's reply, which can carry a card of plan changes. Nothing in the plan changes here: the
 * card's Apply does that. Bearer LIFT_SYNC_TOKEN.
 *
 *   POST /api/app/coach/messages?tz=…  { text }
 */

import { appWrite } from '@/lib/app-api/route';
import { MAX_TEXT, sendMessage } from '@/lib/coach-chat/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: Request) {
  return appWrite(request, 'coach message', async ({ userId, today, timeZone }, body) => {
    const raw = body && typeof body === 'object' ? (body as Record<string, unknown>).text : null;
    const text = typeof raw === 'string' ? raw.trim() : '';
    if (!text) return { status: 400, body: { error: 'text is empty' } };
    if (text.length > MAX_TEXT) return { status: 400, body: { error: `text is over ${MAX_TEXT} characters` } };
    return { status: 200, body: await sendMessage(userId, text, today, timeZone) };
  });
}
