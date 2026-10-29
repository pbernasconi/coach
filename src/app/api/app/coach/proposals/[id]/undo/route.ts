/**
 * Undoes an applied card of plan changes from Coach, last change first. 409 when it isn't applied. When Paolo changed
 * some of its workouts since, nothing is undone and the answer has `needsConfirm`: send `{ "partial": true }` to put
 * back the rest.
 * (lift/APP-API.md, "Coach"). Bearer LIFT_SYNC_TOKEN.
 *
 *   POST /api/app/coach/proposals/<id>/undo?tz=…   body (optional): { "partial": true }
 */

import { appWrite } from '@/lib/app-api/route';
import { undoProposal } from '@/lib/coach-chat/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID = /^[a-z0-9]{1,40}$/;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return appWrite(request, 'coach undo', async ({ userId, today }, body) => {
    if (!ID.test(id)) return { status: 400, body: { error: 'id must be a proposal id' } };
    return undoProposal(userId, id, today, (body as { partial?: unknown } | undefined)?.partial === true);
  });
}
