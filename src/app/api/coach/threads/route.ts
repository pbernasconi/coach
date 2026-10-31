/**
 * Past chats for the web Coach panel's history (GET), and a new empty chat (POST), as /api/app/coach/threads.
 *
 *   GET /api/coach/threads   POST /api/coach/threads
 */

import { listThreads, startThread } from '@/lib/coach-chat/server';
import { coachWebRoute } from '@/lib/coach-chat/web-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return coachWebRoute(request, 'threads', async ({ userId }) => ({ status: 200, body: await listThreads(userId) }));
}

export async function POST(request: Request) {
  return coachWebRoute(request, 'new chat', async ({ userId }) => ({ status: 200, body: await startThread(userId) }));
}
