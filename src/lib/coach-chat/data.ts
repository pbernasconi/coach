/**
 * The Coach chat's read tools on the server (data-tools.mjs has the definitions and the text): one activity in full,
 * a list of activities, his bests, his load by week. Database reads only (through the activity page's own loaders),
 * owner-scoped. A failed read answers with an error line, so the chat says what it couldn't see instead of failing.
 */

import { sql } from '@/db';
import { loadActivity, loadActivityContext } from '@/lib/activity/queries';
import { loadPeakPerformances } from '@/lib/performance/peaks';
import { addDays } from '@/lib/plan/week.mjs';
import {
  activityBrief, activitiesList, bestsText, checkDataCall, loadText, peakRanks, sportMatches,
  type DataCall, type FoundRow, type LoadAct, type LoadDay, type PeakRow,
} from './data-tools.mjs';

type Row = Record<string, unknown>;

/** Answers one read tool call. `{ ok: false }` goes back to Claude as a tool error. */
export async function runDataTool(userId: string, today: string, name: string, input: unknown): Promise<{ ok: boolean; text: string }> {
  const c = checkDataCall(name, input, today);
  if (!c.ok) return { ok: false, text: c.problem };
  try {
    return { ok: true, text: await answer(userId, today, c.value) };
  } catch (e) {
    console.error('[coach-chat] read tool failed', name, e);
    return { ok: false, text: `The read failed (${String((e as Error)?.message ?? e).slice(0, 120)}). Say you couldn't look it up.` };
  }
}

async function answer(userId: string, today: string, call: DataCall): Promise<string> {
  if (call.tool === 'get_activity') return activityText(userId, today, call.ref, call.sport);
  if (call.tool === 'find_activities') {
    const rows = (await sql`
      SELECT strava_activity_id, to_char(start_date_local, 'YYYY-MM-DD') AS day, to_char(start_date_local, 'HH24:MI') AS time,
             name, sport_type, distance, moving_time, average_speed, average_heartrate, weighted_average_watts, average_watts,
             tss, total_elevation_gain
        FROM strava_activities
       WHERE user_id = ${userId} AND start_date_local >= ${call.from}::date AND start_date_local < ${addDays(call.to, 1)}::date
       ORDER BY start_date_local DESC`) as FoundRow[];
    return activitiesList(rows, call);
  }
  if (call.tool === 'get_bests') return bestsText(await loadPeakPerformances(userId, today));
  const from = addDays(today, -7 * call.weeks - 14);
  const [days, acts] = await Promise.all([
    sql`SELECT to_char(date, 'YYYY-MM-DD') AS date, ctl, atl, tsb, tss FROM daily_training_load
         WHERE user_id = ${userId} AND date >= ${from}::date ORDER BY date` as Promise<Row[]>,
    sql`SELECT to_char(start_date_local, 'YYYY-MM-DD') AS day, sport_type, moving_time FROM strava_activities
         WHERE user_id = ${userId} AND start_date_local >= ${from}::date AND COALESCE(commute, false) = false` as Promise<Row[]>,
  ]);
  const load: LoadDay[] = days.map((d) => ({ date: String(d.date), ctl: Number(d.ctl), atl: Number(d.atl), tsb: Number(d.tsb), tss: Number(d.tss ?? 0) }));
  return loadText(load, acts as unknown as LoadAct[], today, call.weeks);
}

/** The activity a ref names: an id, 'latest', or a day (that day's longest of the sport). */
async function activityId(userId: string, ref: string, sport: string | null): Promise<string | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ref)) return ref;
  const rows = (await sql`
    SELECT strava_activity_id, sport_type FROM strava_activities
     WHERE user_id = ${userId} AND start_date_local >= ${ref}::date AND start_date_local < ${ref}::date + 1
     ORDER BY moving_time DESC NULLS LAST`) as Row[];
  const hit = rows.find((r) => sportMatches(String(r.sport_type ?? ''), sport));
  return hit ? String(hit.strava_activity_id) : null;
}

async function activityText(userId: string, today: string, ref: string, sport: string | null): Promise<string> {
  const id = await activityId(userId, ref, sport);
  const v = id ? await loadActivity(userId, id) : null;
  if (!v) return `No activity ${ref}${sport ? ` (${sport})` : ''}. find_activities lists the ids.`;
  const [ctx, peaks] = await Promise.all([
    loadActivityContext(userId, v, today),
    sql`
      SELECT p.metric, p.span, p.value, p.strava_activity_id, to_char(a.start_date_local, 'YYYY-MM-DD') AS day
        FROM activity_peaks p
        JOIN strava_activities a ON a.user_id = p.user_id AND a.strava_activity_id = p.strava_activity_id
       WHERE p.user_id = ${userId}
         AND (p.metric, p.span) IN (SELECT metric, span FROM activity_peaks WHERE user_id = ${userId} AND strava_activity_id = ${v.stravaId})` as Promise<Row[]>,
  ]);
  const all: PeakRow[] = peaks.map((r) => ({ metric: String(r.metric), span: Number(r.span), value: Number(r.value), day: String(r.day), activityId: String(r.strava_activity_id) }));
  const own = all.filter((r) => r.activityId === v.stravaId);
  const thresholdHr = v.hrZones[2]?.max && v.hrZones[2].max > 0 ? v.hrZones[2].max : null;
  return activityBrief(v, ctx, peakRanks(own, all, v.day), { thresholdHr });
}
