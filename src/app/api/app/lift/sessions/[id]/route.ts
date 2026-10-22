/**
 * One Lift session as the web's /lift/sessions/[id] shows it, for the Lift iPhone app (lift/APP-API.md, "Lift").
 * Read-only; Bearer LIFT_SYNC_TOKEN.
 *
 *   GET /api/app/lift/sessions/ca4f651b-98c7-4765-83a9-07ab74435d69?tz=America/Los_Angeles
 *   GET /api/app/lift/sessions/latest
 */

import { appLiftSessionResponse } from '@/lib/lift-dashboard/app-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return appLiftSessionResponse(request, id);
}
