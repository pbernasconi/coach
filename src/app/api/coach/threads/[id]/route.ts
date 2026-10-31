/**
 * A past chat becomes the open one again, as POST /api/app/coach/threads/{id}. 404 when there is no such chat.
 *
 *   POST /api/coach/threads/{id}
 */

import { reopenThread } from '@/lib/coach-chat/server';
import { COACH_ID, coachWebRoute } from '@/lib/coach-chat/web-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return coachWebRoute(request, 'open chat', async ({ userId }) => {
    if (!COACH_ID.test(id)) return { status: 400, body: { error: 'id must be a chat id' } };
    const body = await reopenThread(userId, id);
    return body ? { status: 200, body } : { status: 404, body: { error: 'not found' } };
  });
}
