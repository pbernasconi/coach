/**
 * Applies a card of plan changes from Coach: the same writes as the Week tab and the Edit sheet, then Google
 * Calendar. 409 when the card isn't open or the plan changed since Coach proposed it (the card is then stale).
 * (lift/APP-API.md, "Coach"). Bearer LIFT_SYNC_TOKEN.
 *
 *   POST /api/app/coach/proposals/<id>/apply?tz=…
 */

import { appWrite } from '@/lib/app-api/route';
import { applyProposal } from '@/lib/coach-chat/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID = /^[a-z0-9]{1,40}$/;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return appWrite(request, 'coach apply', async ({ userId, today }) => {
    if (!ID.test(id)) return { status: 400, body: { error: 'id must be a proposal id' } };
    return applyProposal(userId, id, today);
  });
}
