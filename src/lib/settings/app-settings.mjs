// @ts-check
/**
 * GET /api/app/settings (lift/APP-API.md, "Settings"): what the phone's Settings page shows from the server. Each
 * section is `{ ok: false }` alone when its loader failed. Pure; app-settings.ts loads the inputs.
 */
import { connectionsFrom, dayText } from './connections.mjs';

/**
 * "35 km run · 4 h ride · 2 strength a week".
 * @param {{ runKm: number, rideHours: number, strength: number }} t
 */
export function targetsText(t) {
  const parts = [];
  if (t.runKm > 0) parts.push(`${t.runKm} km run`);
  if (t.rideHours > 0) parts.push(`${t.rideHours} h ride`);
  if (t.strength > 0) parts.push(`${t.strength} strength`);
  return parts.length ? `${parts.join(' · ')} a week` : 'No weekly targets';
}

/**
 * @param {{
 *   status: { ok: true, value: any } | { ok: false },
 *   bodyspec: { ok: true, value: any } | { ok: false },
 *   targets: { ok: true, value: { runKm: number, rideHours: number, strength: number } } | { ok: false },
 *   events: { ok: true, value: { name: string, date: string, priority: string, countdown: { label: string } }[] } | { ok: false },
 *   now: number,
 * }} input
 */
export function settingsResponse({ status, bodyspec, targets, events, now }) {
  const next = events.ok ? events.value[0] ?? null : null;
  return {
    generatedAt: new Date(now).toISOString(),
    connections: status.ok
      ? { ok: true, ...connectionsFrom({ status: status.value, bodyspec: bodyspec.ok ? bodyspec.value : null, now }) }
      : { ok: false },
    coach: targets.ok || events.ok
      ? {
          ok: true,
          targetsText: targets.ok ? targetsText(targets.value) : null,
          nextEvent: next
            ? { name: next.name, dateText: dayText(next.date), countdownText: next.countdown.label, priority: next.priority }
            : null,
        }
      : { ok: false },
  };
}
