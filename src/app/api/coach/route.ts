/**
 * The web Coach chat (the Coach panel, src/components/coach-chat/): the open thread, whether Coach can answer, and the
 * starter prompts, as GET /api/app/coach for the iPhone. For the signed-in owner. Warms Claude's cache of the chat
 * prompt after answering, so the first message doesn't wait on a cold prompt.
 *
 *   GET /api/coach?tz=…
 */

import { after } from 'next/server';
import { loadCoach, warmCoach } from '@/lib/coach-chat/server';
import { coachWebRoute } from '@/lib/coach-chat/web-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return coachWebRoute(request, 'thread', async ({ userId }) => {
    after(() => warmCoach(userId));
    return { status: 200, body: await loadCoach(userId) };
  });
}
