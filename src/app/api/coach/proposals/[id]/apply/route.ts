/**
 * Apply of a change card from the web Coach panel, as POST /api/app/coach/proposals/{id}/apply (lift/APP-API.md,
 * "Coach"): the same checks, writes and calendar push.
 *
 *   POST /api/coach/proposals/{id}/apply?tz=…
 */

import { applyProposal } from '@/lib/coach-chat/server';
import { COACH_ID, coachWebRoute } from '@/lib/coach-chat/web-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return coachWebRoute(request, 'apply', async ({ userId, today }) => {
    if (!COACH_ID.test(id)) return { status: 400, body: { error: 'id must be a proposal id' } };
    return applyProposal(userId, id, today);
  });
}
