/**
 * Reopens a past Coach chat from the history sheet: it becomes the open one, and the next message continues it
 * (lift/APP-API.md, "Coach"). Bearer LIFT_SYNC_TOKEN.
 *
 *   POST /api/app/coach/threads/<id>   → the same body as GET /api/app/coach; 404 when there is no such chat
 */

import { appWrite } from '@/lib/app-api/route';
import { reopenThread } from '@/lib/coach-chat/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID = /^[a-z0-9]{1,40}$/;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return appWrite(request, 'coach open chat', async ({ userId }) => {
    if (!ID.test(id)) return { status: 400, body: { error: 'id must be a chat id' } };
    const body = await reopenThread(userId, id);
    return body ? { status: 200, body } : { status: 404, body: { error: 'not found' } };
  });
}
