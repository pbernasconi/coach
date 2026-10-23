import { load, safe } from '@/lib/safe';
import { healthResponse } from './app-health.mjs';
import { loadDexa } from './dexa-queries';
import { loadBoard } from './garmin-pages';
import { loadGarminStatus, loadLabs, loadReadiness } from './queries';

/**
 * GET /api/app/health (lift/APP-API.md, "Health"): the loaders of the web's Health page
 * (src/app/(dashboard)/health/page.tsx), each section on its own, shaped by app-health.mjs. Clinician notes and the
 * full lab report stay on the web.
 */
export async function loadAppHealth(userId: string, today: string, days: number, now = Date.now()) {
  // The Garmin line is optional, as on the web: the board only needs its last synced day.
  const garminP = safe('garmin status', () => loadGarminStatus(userId, now), null);
  const [garmin, readiness, board, dexa, labs] = await Promise.all([
    garminP,
    load('Readiness', () => loadReadiness(userId, today)),
    garminP.then((g) => load('Health board', () => loadBoard(userId, today, days, g?.syncedThrough ?? null))),
    load('Body composition', () => loadDexa(userId)),
    load('Labs', () => loadLabs(userId)),
  ]);
  return healthResponse({ now, days, today, garmin, readiness, board, dexa, labs });
}

/** `days`: 90 when asked for, else 30 (the web's two ranges). */
export const healthDays = (raw: string | null) => (raw === '90' ? 90 : 30);
