/**
 * Saves how a workout felt from the Lift app (lift/APP-API.md, "Feedback"): the feel (1–5), the perceived effort (RPE
 * 1–10) and a comment, in the web's workout_feedback table. Bearer LIFT_SYNC_TOKEN, as every /api/app route.
 *
 *   PUT /api/app/feedback  { item: "lift:<id>" | "strava:<id>" | "plan:<id>", date, title, planActivityId, feel, rpe, comment }
 *
 * Answers with the saved block (the same shape as the pages' `feedback`). All three empty deletes the row.
 */

import { appWrite } from '@/lib/app-api/route';
import { cleanFeedback, feedbackBlock } from '@/lib/plan/feedback.mjs';
import { saveFeedback } from '@/lib/plan/feedback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
  return appWrite(request, 'feedback', async ({ userId }, body) => {
    const f = cleanFeedback(body && typeof body === 'object' ? (body as Record<string, unknown>) : {});
    if ('error' in f) return { status: 400, body: { error: String(f.error) } };
    const saved = await saveFeedback(userId, f as Parameters<typeof saveFeedback>[1]);
    const row = saved.updatedAt ? saved : null;
    return { status: 200, body: feedbackBlock({ item: f.item, date: f.date, title: f.title, planActivityId: f.planActivityId, row }) };
  });
}
