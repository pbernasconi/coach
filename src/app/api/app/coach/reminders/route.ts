/**
 * The Coach chat's reminders still to come (lift/APP-API.md, "Reminders"), for the iPhone to schedule as local
 * notifications. Bearer LIFT_SYNC_TOKEN.
 *
 *   GET /api/app/coach/reminders → { reminders: [{ id, at: "2026-11-04T02:00:00Z", text }] }
 */

import { appRoute } from '@/lib/app-api/route';
import { loadReminders } from '@/lib/coach-chat/reminders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return appRoute(request, 'coach reminders', async ({ userId }) => ({ reminders: await loadReminders(userId) }));
}
