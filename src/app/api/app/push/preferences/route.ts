/**
 * The push switches (lift/PUSH.md). Bearer LIFT_SYNC_TOKEN.
 *
 *   GET /api/app/push/preferences
 *   PUT /api/app/push/preferences  { categories: { workouts: false } }
 */

import { appWrite } from '@/lib/app-api/route';
import { handlePreferences, handleSetPreferences } from '@/lib/notifications/devices.mjs';
import { neonNotificationRepository } from '@/lib/notifications/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return appWrite(request, 'push preferences', ({ userId }) => handlePreferences(userId, neonNotificationRepository));
}

export async function PUT(request: Request) {
  return appWrite(request, 'push preferences', ({ userId }, body) => handleSetPreferences(body, userId, neonNotificationRepository));
}
