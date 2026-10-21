/** GET /api/dexa/files/{id}: one uploaded DEXA file for the signed-in owner (the /health/dexa pages show them). */

import { ownerForSignedInUser } from '@/lib/owner';
import { fileResponse } from '@/lib/vitals/dexa-files-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await ownerForSignedInUser();
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });
  return fileResponse(userId, (await params).id, request);
}
