/**
 * Paolo's thumbs on one of Coach's replies, from the web panel, as PUT /api/app/coach/messages/{id}/feedback.
 *
 *   PUT /api/coach/messages/{id}/feedback  { rating: "up" | "down" | null }
 */

import { setFeedback } from '@/lib/coach-chat/server';
import { COACH_ID, coachWebRoute } from '@/lib/coach-chat/web-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return coachWebRoute(request, 'feedback', async ({ userId }, body) => {
    if (!COACH_ID.test(id)) return { status: 400, body: { error: 'id must be a message id' } };
    const rating = body && typeof body === 'object' ? (body as Record<string, unknown>).rating : undefined;
    if (rating !== 'up' && rating !== 'down' && rating !== null) {
      return { status: 400, body: { error: 'rating must be "up", "down" or null' } };
    }
    return (await setFeedback(userId, id, rating)) ? { status: 200, body: { ok: true } } : { status: 404, body: { error: 'not found' } };
  });
}
