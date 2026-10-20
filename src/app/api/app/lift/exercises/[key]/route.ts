/**
 * One exercise's history as the web's /lift/exercises/[key] shows it, for the Lift iPhone app (lift/APP-API.md,
 * "Lift"). Read-only; Bearer LIFT_SYNC_TOKEN. The key is URL-encoded (`name-…` keys can hold spaces).
 *
 *   GET /api/app/lift/exercises/id-3f2a…
 */

import { appRoute } from '@/lib/app-api/route';
import { EXERCISE_KEY, loadAppLiftExercise } from '@/lib/lift-dashboard/app-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key: raw } = await params;
  let key = '';
  try {
    key = decodeURIComponent(raw);
  } catch {}
  const invalid = EXERCISE_KEY.test(key) ? null : 'key must be an exercise key';
  return appRoute(request, 'lift exercise', () => loadAppLiftExercise(key), invalid);
}
