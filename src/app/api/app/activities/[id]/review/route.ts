/**
 * PUT /api/app/activities/{id}/review (lift/APP-API.md, "Workout review"): makes the coach's review of a finished
 * workout when it is missing or out of date, and answers with the `review` section of the activity detail. The app calls
 * it when that section says `pending`. Bearer LIFT_SYNC_TOKEN, as every /api/app route.
 */

import { appWrite } from '@/lib/app-api/route';
import { generateReview } from '@/lib/activity/review';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id).slice(0, 40);
  return appWrite(request, 'activity review', async ({ userId, today }) => {
    const section = await generateReview(userId, id, today);
    if (!section) return { status: 404, body: { error: 'no review for this activity' } };
    return { status: 200, body: { ok: true, ...section } };
  });
}
