/**
 * POST /api/activities/{id}/review: makes the coach's review of a finished workout when it is missing or out of date
 * (src/lib/activity/review.ts) and answers with the review section, as the activity page shows it. The page calls it
 * when its section says `pending`. Signed-in owner only.
 */

import { cookies } from 'next/headers';
import { generateReview } from '@/lib/activity/review';
import { ownerForSignedInUser } from '@/lib/owner';
import { zoneOrDefault } from '@/lib/plan/week-api.mjs';
import { todayIn } from '@/lib/plan/week.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await ownerForSignedInUser();
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const id = decodeURIComponent((await params).id).slice(0, 40);
  try {
    const today = todayIn(zoneOrDefault((await cookies()).get('tz')?.value ?? null));
    const section = await generateReview(userId, id, today);
    if (!section) return Response.json({ error: 'no review for this activity' }, { status: 404 });
    return Response.json(section, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Review route failed:', error instanceof Error ? error.message : 'unknown error');
    return Response.json({ error: 'internal error' }, { status: 500 });
  }
}
