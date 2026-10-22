/**
 * Push notifications, wired: the notifier over Postgres and APNs, and the triggers each data path calls after its own
 * work is stored. A route runs them after its response (`after(() => notifyLiftWorkouts(applied))`). They never throw,
 * so a push problem never fails the sync that caused it, and they log no content.
 *
 *   - notifyLiftWorkouts: after a Lift sync push (sessions finished on the iPhone)
 *   - notifyStravaWorkouts: after a Strava sync (new activities)
 *   - notifyWeighIn: after a vitals push from the scale or the Lift app
 *
 * The rules for a new event are in catalog.mjs; the phone side is lift/PUSH.md.
 */

import { sql } from '@/db';
import { COACH_URL } from '@/lib/calendar-sync/push.mjs';
import { personalRecords } from '@/lib/lift-dashboard/overview.mjs';
import { loadLiftModel } from '@/lib/lift-dashboard/queries';
import { sessionDetail } from '@/lib/lift-dashboard/stats.mjs';
import { ownerId } from '@/lib/plan/queries';
import { loadBody } from '@/lib/vitals/garmin-pages';
import { apnsFromEnv } from './apns.mjs';
import { createNotifier } from './notifier.mjs';
import { neonNotificationRepository } from './repository';
import {
  finishedLiftSessions,
  liftWorkoutPayload,
  parseStamp,
  stravaWorkoutPayload,
  weighInFromSamples,
  weighInPayload,
} from './triggers.mjs';

export const notifier = createNotifier({
  repo: neonNotificationRepository,
  transport: apnsFromEnv(),
  origin: process.env.COACH_ORIGIN || COACH_URL,
});

type Row = Record<string, unknown>;

/** Runs `job`; an error is logged by message only (the data is health data), never thrown. */
async function guarded(label: string, job: () => Promise<void>) {
  try {
    await job();
  } catch (error) {
    console.error(`Notifications (${label}) failed:`, error instanceof Error ? error.message : 'unknown error');
  }
}

/**
 * After a Lift sync push: a `workout.completed` notice for each session the push finished.
 * @param applied the push's applied changes (sync.mjs push, `applied`)
 */
export async function notifyLiftWorkouts(applied: { entity: string; id: string; payload: Record<string, unknown>; deletedAt: Date | null }[]) {
  const ids = finishedLiftSessions(applied, Date.now());
  if (ids.length === 0) return;
  await guarded('lift', async () => {
    const userId = await ownerId();
    if (!userId) return;
    const { model, unit } = await loadLiftModel();
    const records = personalRecords(model, unit);
    for (const id of ids) {
      const detail = sessionDetail(model, id, unit);
      if (!detail) continue;
      const prs = records.filter((r: { sessionId: string }) => r.sessionId === id).length;
      const payload = liftWorkoutPayload(detail, prs);
      if (payload) await notifier.notify('workout.completed', payload, { userId });
    }
  });
}

/**
 * After a Strava sync: a `workout.completed` notice for each new activity that ended in the last 12 hours.
 * @param created the rows the sync inserted (syncStrava's `created`)
 */
export async function notifyStravaWorkouts(created: { id: string }[]) {
  if (created.length === 0) return;
  await guarded('strava', async () => {
    const rows = (await sql`
      SELECT user_id, strava_activity_id, name, type, sport_type, moving_time, elapsed_time, distance, tss, start_date
      FROM strava_activities WHERE id = ANY(${created.map((c) => c.id)})`) as Row[];
    if (rows.length === 0) return;
    const nowMs = Date.now();
    // A strength activity from the watch is the same workout as a Lift session finished near it.
    const lift = (await sql`
      SELECT payload->>'finishedAt' AS finished_at FROM lift_rows
      WHERE entity = 'session' AND payload->>'finishedAt' IS NOT NULL AND deleted_at IS NULL
        AND updated_at > now() - interval '2 days'`) as Row[];
    const liftFinishedAt = lift.map((r) => parseStamp(r.finished_at)).filter((d): d is Date => d !== null);
    for (const row of rows) {
      const payload = stravaWorkoutPayload(row as Parameters<typeof stravaWorkoutPayload>[0], { nowMs, liftFinishedAt });
      if (payload) await notifier.notify('workout.completed', payload, { userId: String(row.user_id) });
    }
  });
}

/**
 * After a vitals push made with the Lift token (the scale bridge, or Apple Health from the phone): a
 * `weigh_in.recorded` notice for its weigh-in. Garmin's batch job (CRON_SECRET) never notifies.
 * @param rows the push's valid samples
 */
export async function notifyWeighIn(rows: { date: string; metric: string; value: number; source: string }[]) {
  const reading = weighInFromSamples(rows, new Date().toISOString().slice(0, 10));
  if (!reading) return;
  await guarded('weigh-in', async () => {
    const userId = await ownerId();
    if (!userId) return;
    const [prev] = (await sql`
      SELECT to_char(date, 'YYYY-MM-DD') AS date, value FROM health_samples
      WHERE user_id = ${userId} AND metric = 'weight_kg' AND date < ${reading.date}::date
      ORDER BY date DESC LIMIT 1`) as Row[];
    const body = await loadBody(userId, reading.date);
    const payload = weighInPayload(reading, {
      previous: prev ? { date: String(prev.date), weightKg: Math.round(Number(prev.value) * 100) / 100 } : null,
      change4wKg: body.change4w,
    });
    await notifier.notify('weigh_in.recorded', payload, { userId });
  });
}
