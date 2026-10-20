import { sql } from '@/db';
import { ownerForSignedInUser } from '@/lib/owner';
import { toZwo } from '@/lib/workouts/zwo.mjs';
import type { StructuredWorkout } from '@/lib/plan/queries';

/** A planned ride's steps as a Zwift workout file, to drop into Documents/Zwift/Workouts/<id>/ (the fallback). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await ownerForSignedInUser();
  if (!userId) return new Response('Not signed in', { status: 401 });
  const { id } = await params;
  const rows = (await sql`
    SELECT a.title, a.description, a.steps FROM training_plan_activities a JOIN training_plans p ON p.id = a.plan_id
    WHERE a.id = ${id} AND p.user_id = ${userId}`) as { title: string; description: string | null; steps: StructuredWorkout | null }[];
  const w = rows[0]?.steps;
  if (!w || w.sport !== 'ride') return new Response('No structured ride', { status: 404 });
  const name = String(rows[0].title).replace(/[^\p{L}\p{N} _-]+/gu, '').trim().replace(/\s+/g, '_') || 'workout';
  return new Response(toZwo({ ...w, name: `Coach ${w.name}` } as never, { description: rows[0].description ?? '' }), {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'content-disposition': `attachment; filename="${name}.zwo"` },
  });
}
