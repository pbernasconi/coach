/**
 * Paolo's thumbs up or down on a Coach reply (lift/APP-API.md, "Coach"), kept in the message's meta for reading the
 * chats later. Bearer LIFT_SYNC_TOKEN.
 *
 *   PUT /api/app/coach/messages/<id>/feedback   { rating: "up" | "down" | null }   → { ok: true }
 */

import { appWrite } from '@/lib/app-api/route';
import { setFeedback } from '@/lib/coach-chat/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID = /^[a-z0-9]{1,40}$/;

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return appWrite(request, 'coach feedback', async ({ userId }, body) => {
    if (!ID.test(id)) return { status: 400, body: { error: 'id must be a message id' } };
    const rating = body && typeof body === 'object' ? (body as Record<string, unknown>).rating : undefined;
    if (rating !== 'up' && rating !== 'down' && rating !== null) {
      return { status: 400, body: { error: 'rating must be "up", "down" or null' } };
    }
    return (await setFeedback(userId, id, rating))
      ? { status: 200, body: { ok: true } }
      : { status: 404, body: { error: 'not found' } };
  });
}
