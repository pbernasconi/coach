/**
 * The Lift app's push device token (lift/PUSH.md). Bearer LIFT_SYNC_TOKEN, as every /api/app route.
 *
 *   POST   /api/app/push/devices  { token, environment, topic, installId, appVersion, deviceName, notificationsAuthorized }
 *   DELETE /api/app/push/devices  { token }
 *
 * A registration from another bundle id than APNS_TOPIC (a Simulator build) is refused with 422.
 */

import { appWrite } from '@/lib/app-api/route';
import { handleRegister, handleUnregister } from '@/lib/notifications/devices.mjs';
import { neonNotificationRepository } from '@/lib/notifications/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return appWrite(request, 'push register', ({ userId }, body) => handleRegister(body, userId, neonNotificationRepository, { appTopic: process.env.APNS_TOPIC }));
}

export async function DELETE(request: Request) {
  return appWrite(request, 'push unregister', ({ userId }, body) => handleUnregister(body, userId, neonNotificationRepository));
}
