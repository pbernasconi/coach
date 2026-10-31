/**
 * Dismiss of a change card from the web Coach panel, as POST /api/app/coach/proposals/{id}/dismiss (lift/APP-API.md,
 * "Coach"): the same checks, writes and calendar push.
 *
 *   POST /api/coach/proposals/{id}/dismiss?tz=…
 */

import { dismissProposal } from '@/lib/coach-chat/server';
import { COACH_ID, coachWebRoute } from '@/lib/coach-chat/web-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return coachWebRoute(request, 'dismiss', async ({ userId }) => {
    if (!COACH_ID.test(id)) return { status: 400, body: { error: 'id must be a proposal id' } };
    return dismissProposal(userId, id);
  });
}
