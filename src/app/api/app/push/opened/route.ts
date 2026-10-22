/**
 * A push notification was tapped (lift/PUSH.md): `POST /api/app/push/opened { notificationId }`. Bearer LIFT_SYNC_TOKEN.
 */

import { appWrite } from '@/lib/app-api/route';
import { handleOpened } from '@/lib/notifications/devices.mjs';
import { neonNotificationRepository } from '@/lib/notifications/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return appWrite(request, 'push opened', ({ userId }, body) => handleOpened(body, userId, neonNotificationRepository));
}
