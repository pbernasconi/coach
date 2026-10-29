/**
 * The Coach tab's chats (lift/APP-API.md, "Coach"): the past ones for the history sheet, and a new chat (the + in the
 * top bar). Bearer LIFT_SYNC_TOKEN.
 *
 *   GET  /api/app/coach/threads   → { threads: [{ id, title, updatedAt, messageCount }] }, newest first
 *   POST /api/app/coach/threads   → a new empty chat is the open one; the same body as GET /api/app/coach
 */

import { appRoute, appWrite } from '@/lib/app-api/route';
import { listThreads, startThread } from '@/lib/coach-chat/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return appRoute(request, 'coach threads', ({ userId }) => listThreads(userId));
}

export async function POST(request: Request) {
  return appWrite(request, 'coach new chat', async ({ userId }) => ({ status: 200, body: await startThread(userId) }));
}
