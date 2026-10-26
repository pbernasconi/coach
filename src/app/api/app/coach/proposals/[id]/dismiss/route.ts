/**
 * Dismisses an open card of plan changes from Coach. Nothing in the plan changes.
 * (lift/APP-API.md, "Coach"). Bearer LIFT_SYNC_TOKEN.
 *
 *   POST /api/app/coach/proposals/<id>/dismiss?tz=…
 */

import { appWrite } from '@/lib/app-api/route';
import { dismissProposal } from '@/lib/coach-chat/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID = /^[a-z0-9]{1,40}$/;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return appWrite(request, 'coach dismiss', async ({ userId }) => {
    if (!ID.test(id)) return { status: 400, body: { error: 'id must be a proposal id' } };
    return dismissProposal(userId, id);
  });
}
