/**
 * Runs the context read tools (context-tools.mjs has the definitions and the text): the plan and calendar for any
 * days, health days, labs and DEXA scans. Database reads only, owner-scoped, through the pages' own loaders.
 */

import { sql } from '@/db';
import { homeEvents } from '@/lib/calendar-sync/events';
import { loadDexa } from '@/lib/vitals/dexa-queries';
import { loadLabs, loadReadiness } from '@/lib/vitals/queries';
import { addDays } from '@/lib/plan/week.mjs';
import { planText } from './changes.mjs';
import { calendarText, checkContextCall, dexaText, healthText, HEALTH_METRICS, labsText } from './context-tools.mjs';
import { planRowsBetween } from './writes';

const DEFAULT_ZONE = 'America/Los_Angeles';

export async function runContextTool(userId: string, today: string, name: string, input: unknown, ctx?: { timeZone?: string }): Promise<{ ok: boolean; text: string }> {
  const c = checkContextCall(name, input, today);
  if (!c.ok) return { ok: false, text: c.problem };
  const call = c.value;
  if (call.tool === 'get_plan') {
    const rows = await planRowsBetween(userId, today, call.from, call.to);
    return { ok: true, text: `Plan ${call.from} to ${call.to}:\n${planText(rows, today)}` };
  }
  if (call.tool === 'get_calendar') {
    const timeZone = zoneOr(ctx?.timeZone);
    // Start a day early and end a day late, so events in his zone at the edges are in; the text cuts nothing.
    const start = new Date(`${addDays(call.from, -1)}T00:00:00Z`);
    const days = Math.round((Date.parse(`${call.to}T00:00:00Z`) - start.getTime()) / 86_400_000) + 2;
    const events = (await homeEvents(userId, start, days)).filter((e) => {
      const day = e.allDay ? e.start.slice(0, 10) : new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(e.start));
      const last = e.allDay ? addDays(e.end.slice(0, 10), -1) : day;
      return last >= call.from && day <= call.to;
    });
    return { ok: true, text: calendarText(events, call, timeZone) };
  }
  if (call.tool === 'get_health') {
    const [rows, readiness] = await Promise.all([
      sql`SELECT to_char(date, 'YYYY-MM-DD') AS date, metric, value FROM health_samples
           WHERE user_id = ${userId} AND date >= ${call.from}::date AND date <= ${call.to}::date
             AND metric = ANY(${HEALTH_METRICS}::text[])
           ORDER BY date` as unknown as Promise<{ date: string; metric: string; value: number }[]>,
      loadReadiness(userId, today),
    ]);
    const band = (b: { baseline: number | null; sd: number | null } | null) =>
      b && b.baseline !== null && b.sd !== null ? { mean: b.baseline, sd: b.sd } : null;
    return { ok: true, text: healthText(rows, call, { hrv: band(readiness.hrv), restingHr: band(readiness.restingHr) }) };
  }
  if (call.tool === 'get_labs') {
    const labs = await loadLabs(userId);
    return { ok: true, text: labsText(labs.categories.flatMap((c) => c.biomarkers), labs.draws, call.marker) };
  }
  return { ok: true, text: dexaText(await loadDexa(userId)) };
}

/** A valid IANA zone, or Paolo's home zone. */
function zoneOr(zone: string | undefined): string {
  try {
    if (zone) new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return zone || DEFAULT_ZONE;
  } catch {
    return DEFAULT_ZONE;
  }
}
