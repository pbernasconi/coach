// What makes a notice: pure functions from the data a trigger already has (a Lift sync push, a Strava activity row,
// a vitals push) to the payloads of catalog events. The wiring in index.ts reads the database and calls notify().

import { toDate } from '../db-time.mjs';

/** A notice is for something that just happened: a workout older than this (a backfill, an edit of an old session
 * synced late) sends nothing. */
export const RECENT_MS = 12 * 3600_000;

/**
 * A Lift or Strava stamp as a Date: ISO 8601, or GRDB text ("2026-10-15 07:30:00.000", UTC with no zone).
 * @param {unknown} v
 */
export function parseStamp(v) {
  return toDate(v);
}

const isRecent = (d, nowMs) => d !== null && d.getTime() <= nowMs + 5 * 60_000 && nowMs - d.getTime() <= RECENT_MS;

/**
 * The Lift sessions a sync push finished: a session row written with `finishedAt` set, not deleted, and finished in
 * the last 12 hours. Lower-case ids, each once.
 * @param {{ entity: string, id: string, payload: Record<string, unknown>, deletedAt: Date | null }[]} applied
 *   the push's applied changes (sync.mjs push, `applied`)
 * @param {number} nowMs
 */
export function finishedLiftSessions(applied, nowMs) {
  const ids = new Set();
  for (const c of applied) {
    if (c.entity !== 'session' || c.deletedAt || c.payload?.deletedAt) continue;
    if (isRecent(parseStamp(c.payload?.finishedAt), nowMs)) ids.add(String(c.id).toLowerCase());
  }
  return [...ids];
}

/**
 * The `workout.completed` payload of a Lift session (stats.mjs sessionDetail), or null when nothing was logged.
 * @param {{ id: string, title: string, minutes: number | null, setsLogged: number, volume: number, unit: 'kg' | 'lb', finishedAt: string | null }} s
 * @param {number} prs  new e1RM records set in the session
 */
export function liftWorkoutPayload(s, prs) {
  if (!s.finishedAt || s.setsLogged === 0) return null;
  return {
    source: 'lift',
    id: s.id,
    name: s.title || 'Workout',
    sportType: null,
    durationS: s.minutes == null ? null : s.minutes * 60,
    distanceM: null,
    sets: s.setsLogged,
    volume: s.volume > 0 ? Math.round(s.volume) : null,
    unit: s.unit,
    prs: prs || null,
    tss: null,
    endedAt: s.finishedAt,
  };
}

/** Strava types that Lift logs better: a strength session recorded on the watch as well as in Lift. */
export const STRAVA_STRENGTH = new Set(['WeightTraining', 'Crossfit', 'Workout']);

/**
 * The `workout.completed` payload of a new Strava activity row, or null when it is not news: it ended more than
 * 12 hours ago (a first sync, a late upload), or it is a strength activity while a Lift session finished within an
 * hour of it (the same workout; Lift's notice is the one with the sets).
 * @param {{ strava_activity_id: string, name: string | null, sport_type: string | null, type: string | null,
 *   moving_time: number | null, elapsed_time: number | null, distance: number | null, tss: number | null,
 *   start_date: Date | string }} a
 * @param {{ nowMs: number, liftFinishedAt: Date[] }} context
 */
export function stravaWorkoutPayload(a, { nowMs, liftFinishedAt }) {
  const start = parseStamp(a.start_date);
  if (!start) return null;
  const ended = new Date(start.getTime() + (Number(a.elapsed_time) || 0) * 1000);
  if (!isRecent(ended, nowMs)) return null;
  const sportType = a.sport_type || a.type || null;
  if (sportType && STRAVA_STRENGTH.has(sportType) && liftFinishedAt.some((t) => Math.abs(t.getTime() - ended.getTime()) <= 3600_000)) {
    return null;
  }
  const distance = Number(a.distance) || 0;
  return {
    source: 'strava',
    id: String(a.strava_activity_id),
    name: (a.name || '').trim() || sportType || 'Activity',
    sportType,
    durationS: a.moving_time == null ? null : Math.round(Number(a.moving_time)),
    distanceM: distance > 0 ? distance : null,
    sets: null,
    volume: null,
    unit: null,
    prs: null,
    tss: a.tss == null ? null : Math.round(Number(a.tss)),
    endedAt: ended.toISOString(),
  };
}

/**
 * The weigh-in a vitals push carries: its last `weight_kg` sample from today or yesterday (the scale sends the oldest
 * reading first), with the body fat of the same day. Null when there is none.
 * @param {{ date: string, metric: string, value: number, source: string }[]} rows  the push's valid samples
 * @param {string} today  the UTC day
 */
export function weighInFromSamples(rows, today) {
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 864e5).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 864e5).toISOString().slice(0, 10);
  const weight = rows.filter((r) => r.metric === 'weight_kg' && r.date >= yesterday && r.date <= tomorrow).at(-1);
  if (!weight) return null;
  const fat = rows.filter((r) => r.metric === 'body_fat_pct' && r.date === weight.date).at(-1);
  return { date: weight.date, weightKg: weight.value, bodyFatPct: fat ? fat.value : null, source: weight.source };
}

/**
 * The `weigh_in.recorded` payload.
 * @param {{ date: string, weightKg: number, bodyFatPct: number | null, source: string }} reading
 * @param {{ previous: { date: string, weightKg: number } | null, change4wKg: number | null }} history
 */
export function weighInPayload(reading, history) {
  return {
    date: reading.date,
    weightKg: Math.round(reading.weightKg * 100) / 100,
    bodyFatPct: reading.bodyFatPct == null ? null : Math.round(reading.bodyFatPct * 10) / 10,
    previous: history.previous,
    change4wKg: history.change4wKg == null ? null : Math.round(history.change4wKg * 10) / 10,
    source: reading.source,
  };
}
