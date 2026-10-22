/**
 * Sends a test push to every registered device (lift/PUSH.md): `POST /api/app/push/test`. Bearer LIFT_SYNC_TOKEN.
 * Answers with what APNs said, so a broken key or token shows at once.
 */

import { randomUUID } from 'node:crypto';
import { appWrite } from '@/lib/app-api/route';
import { notifier } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return appWrite(request, 'push test', async ({ userId }) => ({
    status: 200,
    body: await notifier.notify('system.test', { nonce: randomUUID() }, { userId }),
  }));
}
