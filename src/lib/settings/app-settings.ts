import { load } from '@/lib/safe';
import { loadStatus, loadTargets } from '@/lib/status';
import { loadBodyspecStatus } from '@/lib/vitals/bodyspec-api';
import { loadUpcomingEvents } from '@/lib/performance/events';
import { settingsResponse } from './app-settings.mjs';

/** GET /api/app/settings: the connections and the coach's targets and next event, each section on its own. */
export async function loadAppSettings(userId: string, today: string, now = Date.now()) {
  const [status, bodyspec, targets, events] = await Promise.all([
    load('Status', () => loadStatus(userId, now)),
    load('BodySpec', () => loadBodyspecStatus(userId)),
    load('Targets', () => loadTargets(userId)),
    load('Events', () => loadUpcomingEvents(userId, today, 365)),
  ]);
  return settingsResponse({ status, bodyspec, targets, events, now });
}
