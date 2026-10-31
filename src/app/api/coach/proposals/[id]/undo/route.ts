/**
 * Undo of a change card from the web Coach panel, as POST /api/app/coach/proposals/{id}/undo (lift/APP-API.md,
 * "Coach"): the same checks, writes and calendar push.
 *
 *   POST /api/coach/proposals/{id}/undo?tz=…
 */

import { undoProposal } from '@/lib/coach-chat/server';
import { COACH_ID, coachWebRoute } from '@/lib/coach-chat/web-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return coachWebRoute(request, 'undo', async ({ userId, today }, body) => {
    if (!COACH_ID.test(id)) return { status: 400, body: { error: 'id must be a proposal id' } };
    return undoProposal(userId, id, today, (body as { partial?: unknown } | undefined)?.partial === true);
  });
}
