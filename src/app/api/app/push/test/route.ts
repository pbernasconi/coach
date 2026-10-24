/**
 * Sends a test push to every registered device (lift/PUSH.md): `POST /api/app/push/test`. Bearer LIFT_SYNC_TOKEN.
 * With no body it sends `system.test`. With `{ "replay": "lift" | "strava" | "weigh_in" }` it sends the real notice
 * for the latest Lift session, Strava activity or weigh-in, with its deep link. Answers with what APNs said, so a
 * broken key or token shows at once.
 *
 * `GET /api/app/push/test` reads the push state without sending: the devices (on or off, and why) and the last
 * notices with their status and APNs codes. No notice text, which is health data.
 */

import { randomUUID } from 'node:crypto';
import { appRoute, appWrite } from '@/lib/app-api/route';
import { loadPushOverview } from '@/lib/notifications/repository';
import { notifier, REPLAY_KINDS, replayLatest, type ReplayKind } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return appWrite(request, 'push test', async ({ userId }, body) => {
    const replay = (body as { replay?: unknown } | undefined)?.replay;
    if (replay === undefined) {
      return { status: 200, body: await notifier.notify('system.test', { nonce: randomUUID() }, { userId }) };
    }
    if (!REPLAY_KINDS.includes(replay as ReplayKind)) {
      return { status: 400, body: { error: `replay must be one of ${REPLAY_KINDS.join(', ')}` } };
    }
    return { status: 200, body: await replayLatest(replay as ReplayKind, userId, randomUUID()) };
  });
}

export async function GET(request: Request) {
  return appRoute(request, 'push status', async ({ userId }) => {
    const { devices, recent } = await loadPushOverview(userId);
    return { devices, recent: recent.map((n) => ({ id: n.id, type: n.type, title: n.title, status: n.status, createdAt: n.createdAt, openedAt: n.openedAt, codes: n.codes })) };
  });
}
