/** GET /api/vitals/dexa/files/{id}: one uploaded DEXA file (a report PDF or an image). Bearer CRON_SECRET. */

import { isAuthorized } from '@/lib/lift-sync/auth.mjs';
import { ownerId } from '@/lib/plan/queries';
import { fileResponse } from '@/lib/vitals/dexa-files-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const userId = await ownerId();
  if (!userId) return Response.json({ error: 'no owner' }, { status: 500 });
  return fileResponse(userId, (await params).id, request);
}
