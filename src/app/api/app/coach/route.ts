/**
 * The Coach tab's thread (lift/APP-API.md, "Coach"): the open conversation, whether Coach can answer, and the quick
 * prompts. Bearer LIFT_SYNC_TOKEN, as every /api/app route. After answering, it warms Claude's cache of the chat
 * prompt (`warmCoach`), so the first message doesn't wait on a cold prompt.
 *
 *   GET /api/app/coach?tz=…
 */

import { after } from 'next/server';
import { appRoute } from '@/lib/app-api/route';
import { loadCoach, warmCoach } from '@/lib/coach-chat/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return appRoute(request, 'coach', async ({ userId }) => {
    // The tab is open, so a message may follow: warm Claude's cache of the chat prompt meanwhile.
    after(() => warmCoach(userId));
    return loadCoach(userId);
  });
}
